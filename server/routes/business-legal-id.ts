/**
 * business-legal-id.ts — API routes for businessLegalIdDocuments
 *
 * SECURITY RULES (enforced by this router, not just schema):
 *   1. Normal customer accounts CANNOT access this router at all.
 *      The `requireComplianceRole` guard blocks them before any handler runs.
 *   2. Only accounts with the "compliance" or "super_admin" role can
 *      create, read, or update legal ID documents.
 *   3. Every read and write creates an audit log entry.
 *   4. legalReason is mandatory on every INSERT.
 *   5. Documents are never physically deleted from this endpoint.
 *      The lifecycle is managed via retentionStatus transitions only.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { businessLegalIdDocuments } from '@shared/schema';
import { logAuditEvent } from '../middleware/auditLog';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

// Tombstone value written over PII fields when a document is anonymised.
// Using a constant ensures consistent detection in downstream processing.
const ANONYMISED_TOMBSTONE = '[ANONYMISED]';

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_COLLECTION_REASONS = [
  'business_verified',
  'high_risk_payment',
  'compliance_hold',
] as const;

const ALLOWED_DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'drivers_license',
  'company_registration',
] as const;

const ALLOWED_RETENTION_STATUSES = [
  'active',
  'deletion_requested',
  'deletion_blocked_by_legal_retention',
  'anonymised',
  'retained_for_legal_obligation',
] as const;

// ── Validation schemas ───────────────────────────────────────────────────────

const createDocumentSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  collectionReason: z.enum(ALLOWED_COLLECTION_REASONS),
  legalReason: z.string().min(20, 'legalReason must be at least 20 characters describing the legal basis'),
  documentType: z.enum(ALLOWED_DOCUMENT_TYPES),
  documentCountry: z.string().length(2, 'documentCountry must be an ISO 2-letter country code').transform(val => val.toUpperCase()),
  documentStorageUrl: z.string().url('documentStorageUrl must be a valid URL'),
  documentFileHash: z.string().length(64, 'documentFileHash must be a 64-char SHA-256 hex string').regex(/^[a-f0-9]{64}$/i),
  documentExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateRetentionSchema = z.object({
  retentionStatus: z.enum(ALLOWED_RETENTION_STATUSES),
  retentionExpiresAt: z.string().datetime().optional().nullable(),
  deletionBlockedReason: z.string().min(10).optional().nullable(),
});

// ── Middleware ───────────────────────────────────────────────────────────────

/**
 * Require "compliance" or "super_admin" role.
 * Normal customer/provider/pet_parent accounts are blocked.
 *
 * Relies on Firebase custom claims set during staff onboarding.
 * Falls back to SUPER_ADMIN_EMAILS env var for super admins.
 */
async function requireComplianceRole(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const email = req.firebaseUser.email?.toLowerCase() || '';

    // Super admins always have compliance access
    if (isSuperAdmin(email)) {
      (req as any).actorRole = 'super_admin';
      return next();
    }

    // Check custom claims on the Firebase token
    const claims = (req.firebaseUser as any).claims || {};
    const role: string = claims.role || claims.accountType || '';

    const COMPLIANCE_ROLES = ['compliance', 'compliance_officer', 'auditor', 'legal'];
    if (COMPLIANCE_ROLES.includes(role.toLowerCase())) {
      (req as any).actorRole = role;
      return next();
    }

    // Block everyone else — including customers, providers, and regular staff
    logger.warn('[BusinessLegalId] Access denied — insufficient role', {
      uid: req.firebaseUser.uid,
      email,
      role,
    });
    return res.status(403).json({
      error: 'Access denied',
      message: 'Legal ID documents are restricted to compliance officers only. Normal users cannot upload or view government identity documents.',
    });
  } catch (err) {
    logger.error('[BusinessLegalId] Auth check failed', err);
    return res.status(500).json({ error: 'Failed to verify access level' });
  }
}

// Helper to mask the last octet of an IPv4 address
function maskIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const parts = ip.split('.');
  if (parts.length === 4) {
    parts[3] = 'xxx';
    return parts.join('.');
  }
  // IPv6 — mask last segment
  const v6parts = ip.split(':');
  if (v6parts.length > 1) {
    v6parts[v6parts.length - 1] = 'xxxx';
    return v6parts.join(':');
  }
  return ip;
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/business-legal-id
 * Create a new legal ID document record.
 *
 * Blocked for normal users. Compliance role required.
 * legalReason is mandatory.
 * Every creation is audit-logged.
 */
router.post(
  '/',
  validateFirebaseToken,
  requireComplianceRole,
  async (req: Request, res: Response) => {
    const traceId = (req as any).traceId;
    const actorUid = req.firebaseUser!.uid;
    const actorRole = (req as any).actorRole || 'compliance';

    try {
      const parsed = createDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors,
        });
      }

      const data = parsed.data;
      const maskedIp = maskIp(
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress
      );

      const [inserted] = await db
        .insert(businessLegalIdDocuments)
        .values({
          userId: data.userId,
          collectionReason: data.collectionReason,
          legalReason: data.legalReason,
          documentType: data.documentType,
          documentCountry: data.documentCountry,
          documentStorageUrl: data.documentStorageUrl,
          documentFileHash: data.documentFileHash,
          documentExpiresAt: data.documentExpiresAt || null,
          uploaderMaskedIp: maskedIp,
          retentionStatus: 'active',
        })
        .returning({ id: businessLegalIdDocuments.id });

      await logAuditEvent({
        actorUserId: actorUid,
        actorRole,
        actionType: 'LEGAL_ID_DOCUMENT_CREATED',
        targetType: 'business_legal_id_documents',
        targetId: String(inserted.id),
        ip: maskedIp,
        userAgent: req.headers['user-agent'],
        traceId,
        metadata: {
          subjectUserId: data.userId,
          documentType: data.documentType,
          collectionReason: data.collectionReason,
        },
      });

      logger.info('[BusinessLegalId] Document created', {
        documentId: inserted.id,
        subjectUserId: data.userId,
        documentType: data.documentType,
        actorUid,
        traceId,
      });

      // Return only the ID — never echo back document URLs or hashes in the response
      return res.status(201).json({
        success: true,
        documentId: inserted.id,
        message: 'Legal ID document record created successfully',
      });
    } catch (err) {
      logger.error('[BusinessLegalId] Error creating document', err);
      return res.status(500).json({ error: 'Failed to create legal ID document' });
    }
  }
);

/**
 * GET /api/business-legal-id/:userId
 * List legal ID documents for a subject user.
 *
 * Compliance role required. Every read is audit-logged.
 * Response NEVER includes documentStorageUrl or documentFileHash.
 */
router.get(
  '/:userId',
  validateFirebaseToken,
  requireComplianceRole,
  async (req: Request, res: Response) => {
    const traceId = (req as any).traceId;
    const actorUid = req.firebaseUser!.uid;
    const actorRole = (req as any).actorRole || 'compliance';
    const { userId } = req.params;

    try {
      const docs = await db
        .select({
          id: businessLegalIdDocuments.id,
          userId: businessLegalIdDocuments.userId,
          collectionReason: businessLegalIdDocuments.collectionReason,
          documentType: businessLegalIdDocuments.documentType,
          documentCountry: businessLegalIdDocuments.documentCountry,
          documentExpiresAt: businessLegalIdDocuments.documentExpiresAt,
          verificationStatus: businessLegalIdDocuments.verificationStatus,
          verifiedAt: businessLegalIdDocuments.verifiedAt,
          retentionStatus: businessLegalIdDocuments.retentionStatus,
          retentionExpiresAt: businessLegalIdDocuments.retentionExpiresAt,
          deletionBlockedReason: businessLegalIdDocuments.deletionBlockedReason,
          anonymisedAt: businessLegalIdDocuments.anonymisedAt,
          createdAt: businessLegalIdDocuments.createdAt,
          // NOTE: documentStorageUrl, documentFileHash intentionally excluded
        })
        .from(businessLegalIdDocuments)
        .where(eq(businessLegalIdDocuments.userId, userId));

      await logAuditEvent({
        actorUserId: actorUid,
        actorRole,
        actionType: 'LEGAL_ID_DOCUMENT_READ',
        targetType: 'business_legal_id_documents',
        targetId: userId,
        ip: maskIp(
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress
        ),
        userAgent: req.headers['user-agent'],
        traceId,
        metadata: { subjectUserId: userId, resultCount: docs.length },
      });

      return res.json({ documents: docs });
    } catch (err) {
      logger.error('[BusinessLegalId] Error reading documents', err);
      return res.status(500).json({ error: 'Failed to read legal ID documents' });
    }
  }
);

/**
 * PATCH /api/business-legal-id/:documentId/retention
 * Update the retention status of a legal ID document.
 *
 * Compliance role required. Physical deletion is NOT permitted.
 * Use retentionStatus = "anonymised" when PII can be removed.
 * Every update is audit-logged.
 */
router.patch(
  '/:documentId/retention',
  validateFirebaseToken,
  requireComplianceRole,
  async (req: Request, res: Response) => {
    const traceId = (req as any).traceId;
    const actorUid = req.firebaseUser!.uid;
    const actorRole = (req as any).actorRole || 'compliance';
    const documentId = parseInt(req.params.documentId, 10);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'documentId must be a number' });
    }

    try {
      const parsed = updateRetentionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });
      }

      const { retentionStatus, retentionExpiresAt, deletionBlockedReason } = parsed.data;

      const updateValues: Record<string, unknown> = { retentionStatus };
      if (retentionExpiresAt !== undefined) {
        updateValues.retentionExpiresAt = retentionExpiresAt ? new Date(retentionExpiresAt) : null;
      }
      if (deletionBlockedReason !== undefined) {
        updateValues.deletionBlockedReason = deletionBlockedReason;
      }
      if (retentionStatus === 'anonymised') {
        updateValues.anonymisedAt = new Date();
        // Overwrite sensitive fields with tombstone values
        updateValues.documentStorageUrl = ANONYMISED_TOMBSTONE;
        updateValues.documentFileHash = ANONYMISED_TOMBSTONE;
      }

      await db
        .update(businessLegalIdDocuments)
        .set(updateValues as any)
        .where(eq(businessLegalIdDocuments.id, documentId));

      await logAuditEvent({
        actorUserId: actorUid,
        actorRole,
        actionType: 'LEGAL_ID_RETENTION_UPDATED',
        targetType: 'business_legal_id_documents',
        targetId: String(documentId),
        ip: maskIp(
          (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress
        ),
        userAgent: req.headers['user-agent'],
        traceId,
        metadata: { retentionStatus, deletionBlockedReason },
      });

      return res.json({ success: true, retentionStatus });
    } catch (err) {
      logger.error('[BusinessLegalId] Error updating retention', err);
      return res.status(500).json({ error: 'Failed to update retention status' });
    }
  }
);

/**
 * DELETE /api/business-legal-id/:documentId
 * Physical deletion is NOT permitted for legal/compliance documents.
 * Returns 405 with an explanation.
 */
router.delete(
  '/:documentId',
  validateFirebaseToken,
  requireComplianceRole,
  async (req: Request, res: Response) => {
    const actorUid = req.firebaseUser!.uid;
    logger.warn('[BusinessLegalId] Physical deletion attempt blocked', {
      documentId: req.params.documentId,
      actorUid,
    });

    await logAuditEvent({
      actorUserId: actorUid,
      actorRole: (req as any).actorRole || 'compliance',
      actionType: 'LEGAL_ID_DELETE_BLOCKED',
      targetType: 'business_legal_id_documents',
      targetId: req.params.documentId,
      ip: maskIp(
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress
      ),
      userAgent: req.headers['user-agent'],
      traceId: (req as any).traceId,
      metadata: { reason: 'Physical deletion blocked by legal retention policy' },
    });

    return res.status(405).json({
      error: 'Method not allowed',
      message:
        'Legal/compliance documents cannot be physically deleted. ' +
        'Use PATCH /:documentId/retention to set retentionStatus = "anonymised" ' +
        'or "deletion_blocked_by_legal_retention" per your legal obligation.',
    });
  }
);

export default router;

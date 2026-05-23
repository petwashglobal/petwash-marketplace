/**
 * Admin Suppliers — list + classify (Osek Murshe / Patur / Chevra).
 *
 * Closes the loop on PR-S5c: the column suppliers.osek_classification
 * exists with a CHECK constraint and the screening pipeline already
 * emits an osek_classification_unknown warning for every unclassified
 * supplier — but until this PR there was no UI to set the value, so
 * every supplier stayed 'unknown' forever.
 *
 * Routes (all admin-gated, all audited):
 *   GET   /api/admin/suppliers
 *   GET   /api/admin/suppliers/:id
 *   PATCH /api/admin/suppliers/:id/osek-classification
 *
 * Gated by ff.supplier_invoice_control.enabled (the same flag as the
 * supplier-invoice routes — these are operationally a pair). Default OFF.
 *
 * No money mutation. No SUMIT call. Pure classification metadata.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq, ilike, and } from 'drizzle-orm';
import { db } from '../db';
import { suppliers } from '../../shared/schema-corporate';
import { systemConfig } from '../services/SystemConfig';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { loadUserRole, checkAccessLevel, type AuthenticatedRequest } from '../middleware/rbac';
import { recordAuditEvent } from '../utils/auditSignature';
import { logger } from '../lib/logger';

const router = Router();

const ALLOWED_CLASSIFICATIONS = ['unknown', 'patur', 'murshe', 'chevra'] as const;
type OsekClassification = typeof ALLOWED_CLASSIFICATIONS[number];

function isValidClassification(v: unknown): v is OsekClassification {
  return typeof v === 'string' && (ALLOWED_CLASSIFICATIONS as readonly string[]).includes(v);
}

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!systemConfig.get('ff.supplier_invoice_control.enabled')) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}

const requireFinanceOrAdmin = [
  flagGate,
  validateFirebaseToken,
  loadUserRole,
  checkAccessLevel(8),
];

function readActorEmail(authReq: AuthenticatedRequest): string {
  const f = (authReq as unknown as { firebaseUser?: { email?: string; uid?: string } }).firebaseUser;
  return f?.email ?? f?.uid ?? 'unknown';
}

// GET /api/admin/suppliers — list with optional filters.
router.get('/', ...requireFinanceOrAdmin, async (req: Request, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const classification = typeof req.query.osekClassification === 'string'
      ? req.query.osekClassification
      : undefined;
    const nameSearch = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const conditions = [] as any[];
    if (isValidClassification(classification)) {
      conditions.push(eq(suppliers.osekClassification, classification));
    }
    if (nameSearch) {
      conditions.push(ilike(suppliers.companyName, `%${nameSearch}%`));
    }

    const baseQuery = db.select().from(suppliers).$dynamic();
    const filtered = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const rows = await filtered.limit(limit).offset(offset);

    // Newest first for predictable UI; cheap in-app sort, no index hop.
    rows.sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bT - aT;
    });

    return res.json({ rows, limit, offset });
  } catch (err) {
    logger.error('[AdminSuppliers] list failed', err);
    return res.status(500).json({ error: 'List failed' });
  }
});

// GET /api/admin/suppliers/:id — single supplier read.
router.get('/:id', ...requireFinanceOrAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: 'Not found' });
    return res.json(row);
  } catch (err) {
    logger.error('[AdminSuppliers] get failed', err);
    return res.status(500).json({ error: 'Read failed' });
  }
});

// PATCH /api/admin/suppliers/:id/osek-classification
// Body: { osekClassification: 'patur'|'murshe'|'chevra'|'unknown', certificateUrl?: string }
// Every classification change writes an audit-event row (per platform §2).
router.patch(
  '/:id/osek-classification',
  ...requireFinanceOrAdmin,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const uid = authReq.firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const newClassification = req.body?.osekClassification;
    if (!isValidClassification(newClassification)) {
      return res.status(400).json({
        error: 'Invalid osekClassification',
        allowed: ALLOWED_CLASSIFICATIONS,
      });
    }
    const certificateUrl =
      typeof req.body?.certificateUrl === 'string' && req.body.certificateUrl.trim()
        ? req.body.certificateUrl.trim()
        : null;

    try {
      const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const now = new Date();
      const [updated] = await db
        .update(suppliers)
        .set({
          osekClassification: newClassification,
          // Only overwrite cert URL when explicitly provided (so the
          // admin can fix the classification without re-uploading proof).
          ...(certificateUrl != null ? { osekCertificateUrl: certificateUrl } : {}),
          osekClassificationVerifiedAt: now,
          osekClassificationVerifiedBy: readActorEmail(authReq),
          updatedAt: now,
        })
        .where(eq(suppliers.id, id))
        .returning();

      await recordAuditEvent({
        eventType: 'supplier_osek_classification_changed',
        customerUid: uid,
        metadata: {
          supplierId: id,
          supplierName: existing.companyName,
          previousClassification: existing.osekClassification,
          newClassification,
          certificateUrlProvided: certificateUrl != null,
          actorEmail: readActorEmail(authReq),
        },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
      });

      return res.json(updated);
    } catch (err) {
      logger.error('[AdminSuppliers] osek-classification PATCH failed', err);
      return res.status(500).json({ error: 'Update failed' });
    }
  },
);

export default router;

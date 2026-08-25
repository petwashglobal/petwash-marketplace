/**
 * Legal acceptance endpoints — the ONE server surface every client legal
 * page uses to persist a user's acceptance to the canonical
 * `legal_acceptances` evidence ledger (migration 0127).
 *
 * Created 2026-08-25 as the wiring layer between the ~30 passive-display
 * legal pages the audit surfaced and the new canonical service.
 *
 *   POST /api/legal/accept
 *     body: { documentKey, docVersion, language, snapshotText? }
 *     auth: Firebase Bearer (requireAuth)
 *     → 200 { ok, acceptance: { id, docVersion, acceptedAt, ... } }
 *
 *   GET /api/legal/my-acceptances
 *     auth: Firebase Bearer
 *     → 200 { acceptances: LegalAcceptanceRow[] }
 *
 *   GET /api/admin/legal-acceptances/:userId
 *     auth: super_admin (isSuperAdmin(req.firebaseUser.email))
 *     → 200 { userId, acceptances: LegalAcceptanceRow[] }
 *
 * The writer service (LegalAcceptanceService) is idempotent per
 * (userId, documentKey, docVersion) so a client that re-submits on
 * refresh does not create duplicate rows.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  recordLegalAcceptance,
  listUserLegalAcceptances,
} from '../services/LegalAcceptanceService';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

// Whitelisted document keys — matches the docs in the 2026-08-25 legal
// audit report (short forms). Adding a new legal page requires adding the
// key here, so an accidental client-side typo can't insert a garbage
// document_key into the evidence ledger.
const KNOWN_DOCUMENT_KEYS = new Set<string>([
  // Customer
  'customer_tos',
  'privacy_policy',
  'cancellation_refund_14g',
  'marketing_consent',
  'booking_rules',
  'pet_owner_responsibility',
  'emergency_vet_authorisation',
  'wallet_egift_terms',
  'reviews_content_policy',
  'community_guidelines',
  'home_access_property_authority',
  // Provider
  'provider_agreement',
  'provider_independent_status',
  'provider_no_franchise_no_agency',
  'provider_safety_manual',
  'provider_insurance_disclosure',
  'provider_tax_business_status',
  'provider_privacy_data',
  'provider_off_platform_payment',
  'provider_incident_reporting',
  'provider_home_hosting',
  'provider_owner_home_visit',
  'provider_dog_walking_safety',
  'provider_academy_trainer',
  'provider_pettrek_transport',
  'provider_self_declaration_no_convictions',
  'provider_background_check_consent',
  'provider_reconfirmation',
  'provider_truth_declaration',
  'provider_confidentiality',
  'provider_brand_use',
  'provider_payout_rules',
  'provider_cancellation',
  'provider_no_circumvention',
]);

const acceptSchema = z.object({
  documentKey: z.string().min(1).max(80),
  docVersion: z.string().min(1).max(40),
  language: z.enum(['he', 'en', 'ar', 'ru', 'fr', 'es']),
  snapshotText: z.string().max(200_000).optional(),
  snapshotUrl: z.string().url().max(2000).optional(),
  deviceFingerprint: z.string().max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

router.post('/accept', async (req: Request, res: Response) => {
  const userId = (req as any).firebaseUser?.uid;
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false, error: 'Invalid input',
      details: parsed.error.flatten(),
    });
  }
  const { documentKey, docVersion, language, snapshotText, snapshotUrl, deviceFingerprint, metadata } = parsed.data;

  if (!KNOWN_DOCUMENT_KEYS.has(documentKey)) {
    logger.warn('[LegalAccept] Rejected unknown documentKey', { userId, documentKey });
    return res.status(400).json({ ok: false, error: 'Unknown document', hint: 'Add the key to KNOWN_DOCUMENT_KEYS.' });
  }

  const acceptance = await recordLegalAcceptance({
    userId,
    documentKey,
    docVersion,
    language,
    // Trust ONLY req.ip (Express + trust proxy). Raw X-Forwarded-For is
    // caller-controlled — same rule as PR #2158 for signed provider IPs.
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.get('user-agent') || null,
    deviceFingerprint: deviceFingerprint ?? null,
    snapshotText,
    snapshotUrl: snapshotUrl ?? null,
    source: 'client',
    actorRole: 'self',
    metadata,
  });

  if (!acceptance) {
    return res.status(500).json({ ok: false, error: 'Could not record acceptance' });
  }

  return res.json({
    ok: true,
    acceptance: {
      id: acceptance.id,
      documentKey: acceptance.documentKey,
      docVersion: acceptance.docVersion,
      language: acceptance.language,
      acceptedAt: acceptance.acceptedAt.toISOString(),
    },
  });
});

router.get('/my-acceptances', async (req: Request, res: Response) => {
  const userId = (req as any).firebaseUser?.uid;
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  const rows = await listUserLegalAcceptances(userId);
  return res.json({
    ok: true,
    acceptances: rows.map((r) => ({
      documentKey: r.documentKey,
      docVersion: r.docVersion,
      language: r.language,
      acceptedAt: r.acceptedAt.toISOString(),
      source: r.source,
    })),
  });
});

// Admin — full evidence view for one user.
router.get('/admin/legal-acceptances/:userId', async (req: Request, res: Response) => {
  const callerEmail = (req as any).firebaseUser?.email || '';
  if (!isSuperAdmin(callerEmail)) {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });

  const rows = await listUserLegalAcceptances(userId);
  return res.json({
    ok: true,
    userId,
    acceptances: rows.map((r) => ({
      id: r.id,
      documentKey: r.documentKey,
      docVersion: r.docVersion,
      language: r.language,
      acceptedAt: r.acceptedAt.toISOString(),
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      snapshotHash: r.snapshotHash,
      snapshotUrl: r.snapshotUrl,
      source: r.source,
      actorRole: r.actorRole,
    })),
  });
});

export default router;

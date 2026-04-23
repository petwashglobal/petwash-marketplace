/**
 * Finance — Treasury Settings Routes
 * =====================================
 * Admin-only endpoints for viewing and managing the company treasury bank account.
 *
 * SECURITY:
 *  ▸ Requires Firebase auth + role 'super_admin' or 'finance'.
 *  ▸ All responses return MASKED values only — no raw IBAN, account number, or SWIFT.
 *  ▸ Every request is logged in treasury_access_log.
 *  ▸ MUST NOT be imported or mounted in any non-admin router.
 *
 * Endpoints:
 *   GET  /api/admin/finance/treasury          — view masked treasury settings
 *   POST /api/admin/finance/treasury/verify   — mark account as verified (finance officer)
 *   POST /api/admin/finance/treasury/suspend  — suspend the treasury account
 *   PATCH /api/admin/finance/treasury/metadata — update provenance metadata
 *   GET  /api/admin/finance/treasury/log      — paginated access audit log
 *
 * Israeli regulatory note:
 *   Access to company bank account details is restricted under the Israeli
 *   Banking Law (חוק הבנקאות), the Privacy Protection Law (חוק הגנת הפרטיות),
 *   and the Bank of Israel's Cyber Directive 06/2017.
 *   Audit logs must be retained for 7 years per the Accounting Records Law.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TreasuryConfigService } from '../../services/TreasuryConfigService';
import type { TreasuryActor } from '../../services/TreasuryConfigService';
import { logger } from '../../lib/logger';

const router = Router();

// ── Role guard ────────────────────────────────────────────────────────────────
// Applied to every route in this router.
// Requires Firebase auth (already applied by the outer mount in routes.ts via adminLimiter).
// Additionally restricts to 'super_admin' and 'finance' roles only.

const TREASURY_ROLES = new Set<string>(['super_admin', 'finance', 'ceo']);

function requireTreasuryRole(req: Request, res: Response, next: () => void): void {
  const fbUser = (req as any).firebaseUser;
  if (!fbUser?.uid) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const role: string = fbUser?.claims?.role ?? fbUser?.role ?? '';
  if (!TREASURY_ROLES.has(role)) {
    // Log the rejected attempt (no sensitive data)
    logger.warn('[TreasurySettings] Access denied — insufficient role', {
      uid: fbUser.uid,
      role,
      requiredRoles: Array.from(TREASURY_ROLES),
    });
    res.status(403).json({
      error: 'TREASURY_ACCESS_DENIED',
      message: 'Access to treasury settings requires super_admin, finance, or ceo role.',
    });
    return;
  }
  next();
}

/** Build a TreasuryActor from the verified Firebase user on the request. */
function actorFromReq(req: Request): TreasuryActor {
  const fbUser = (req as any).firebaseUser;
  return {
    uid: fbUser.uid,
    email: fbUser.email ?? fbUser.claims?.email ?? 'unknown',
    role: fbUser?.claims?.role ?? fbUser?.role ?? 'unknown',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

// Apply role guard to all routes in this router
router.use((req, res, next) => requireTreasuryRole(req, res, next));

// ── GET /api/admin/finance/treasury ──────────────────────────────────────────
// Returns masked treasury settings for admin display.

router.get('/', async (req: Request, res: Response) => {
  try {
    const actor = actorFromReq(req);
    const masked = await TreasuryConfigService.getMasked(actor);

    if (!masked) {
      return res.status(404).json({
        error: 'TREASURY_NOT_CONFIGURED',
        message: 'Treasury settings have not been configured. Ensure COMPANY_BANK_* environment variables are set.',
      });
    }

    return res.json({ treasury: masked });
  } catch (err) {
    logger.error('[TreasurySettings] GET / failed', err);
    return res.status(500).json({ error: 'Failed to retrieve treasury settings' });
  }
});

// ── POST /api/admin/finance/treasury/verify ───────────────────────────────────
// Mark the treasury account as verified. Enables it as active payout source.

const verifySchema = z.object({
  note: z.string().max(500).optional(),
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const actor = actorFromReq(req);
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const masked = await TreasuryConfigService.markVerified(actor, { note: parsed.data.note });
    if (!masked) {
      return res.status(404).json({
        error: 'TREASURY_NOT_CONFIGURED',
        message: 'No treasury settings found to verify.',
      });
    }

    return res.json({
      success: true,
      message: 'Treasury account verified and activated as payout source.',
      treasury: masked,
    });
  } catch (err) {
    logger.error('[TreasurySettings] POST /verify failed', err);
    return res.status(500).json({ error: 'Failed to verify treasury account' });
  }
});

// ── POST /api/admin/finance/treasury/suspend ──────────────────────────────────
// Suspend the treasury account — immediately blocks all outgoing payouts.

const suspendSchema = z.object({
  reason: z.string().min(10).max(500),
});

router.post('/suspend', async (req: Request, res: Response) => {
  try {
    const actor = actorFromReq(req);
    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const masked = await TreasuryConfigService.suspend(actor, parsed.data.reason);
    if (!masked) {
      return res.status(404).json({
        error: 'TREASURY_NOT_CONFIGURED',
        message: 'No treasury settings found to suspend.',
      });
    }

    return res.json({
      success: true,
      message: 'Treasury account suspended. All outgoing payouts are now blocked.',
      treasury: masked,
    });
  } catch (err) {
    logger.error('[TreasurySettings] POST /suspend failed', err);
    return res.status(500).json({ error: 'Failed to suspend treasury account' });
  }
});

// ── PATCH /api/admin/finance/treasury/metadata ────────────────────────────────
// Update document provenance metadata (non-sensitive fields only).

const metadataSchema = z.object({
  verificationNote: z.string().max(1000).optional(),
  certificateStoragePath: z.string().max(500).optional(),
  accountOpenedAt: z.string().datetime().optional(),
  sourceDocumentDate: z.string().datetime().optional(),
});

router.patch('/metadata', async (req: Request, res: Response) => {
  try {
    const actor = actorFromReq(req);
    const parsed = metadataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const fields: Parameters<typeof TreasuryConfigService.updateMetadata>[1] = {};
    if (parsed.data.verificationNote !== undefined) fields.verificationNote = parsed.data.verificationNote;
    if (parsed.data.certificateStoragePath !== undefined) fields.certificateStoragePath = parsed.data.certificateStoragePath;
    if (parsed.data.accountOpenedAt) fields.accountOpenedAt = new Date(parsed.data.accountOpenedAt);
    if (parsed.data.sourceDocumentDate) fields.sourceDocumentDate = new Date(parsed.data.sourceDocumentDate);

    const masked = await TreasuryConfigService.updateMetadata(actor, fields);
    if (!masked) {
      return res.status(404).json({
        error: 'TREASURY_NOT_CONFIGURED',
        message: 'No treasury settings found to update.',
      });
    }

    return res.json({ success: true, treasury: masked });
  } catch (err) {
    logger.error('[TreasurySettings] PATCH /metadata failed', err);
    return res.status(500).json({ error: 'Failed to update treasury metadata' });
  }
});

// ── GET /api/admin/finance/treasury/log ──────────────────────────────────────
// Returns paginated treasury access audit log.

router.get('/log', async (req: Request, res: Response) => {
  try {
    const actor = actorFromReq(req);
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);

    const entries = await TreasuryConfigService.getAccessLog(actor, { limit, offset });
    return res.json({ entries, limit, offset });
  } catch (err) {
    logger.error('[TreasurySettings] GET /log failed', err);
    return res.status(500).json({ error: 'Failed to retrieve access log' });
  }
});

// ── GET /api/admin/finance/treasury/payout-status ────────────────────────────
// Quick check: is the treasury ready for outgoing bank transfers?
// Used by ProviderPayoutService health-check and the admin dashboard widget.

router.get('/payout-status', async (req: Request, res: Response) => {
  try {
    const actor = actorFromReq(req);
    const validation = await TreasuryConfigService.validatePayoutSource();
    await TreasuryConfigService.auditPayoutValidation(
      actor,
      'admin-payout-status-check',
      validation,
    );
    return res.json({
      readyForTransfer: validation.readyForTransfer,
      reason: validation.reason,
    });
  } catch (err) {
    logger.error('[TreasurySettings] GET /payout-status failed', err);
    return res.status(500).json({ error: 'Failed to check payout status' });
  }
});

export default router;

/**
 * READ-ONLY fiscal endpoints — CEO 2026-08-27 fiscal directive
 * §65 (routes), §71 (security), §94 items 20-24.
 *
 * All GET. No mutation. Every route derives viewer identity from
 * validateFirebaseToken; §72/§74 discipline — customer identity NEVER
 * comes from req.body/query.
 *
 * Endpoints:
 *   GET /api/fiscal/my/transactions
 *     Customer's own transaction list across the seven sources
 *     (SHOP / K9000 / eGift purchase / wallet / sitter / walk /
 *     academy).
 *
 *   GET /api/fiscal/transactions/by-source/:source/:sourceId
 *     One transaction as a full FiscalTransactionPassport. Customer
 *     path: viewer participant scope enforced by the composer.
 *
 *   GET /api/admin/fiscal-transactions/by-source/:source/:sourceId
 *     Same shape as above but for staff — surfaces external ids and
 *     provider money. Admin-only (isSuperAdmin gate).
 */
import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger';
import { isSuperAdminVerified } from '../middleware/rbac';
import { composeFiscalPassport, type FiscalSourceHint } from '../services/fiscalPassport/composer';
import { listCustomerTransactions } from '../services/fiscalPassport/customerLister';
import type { FiscalActor } from '@shared/lib/fiscalPassport/FiscalTransactionPassport';

const router = Router();

const KNOWN_SOURCES: FiscalSourceHint[] = [
  'shop_orders',
  'k9000_wash_events',
  'egift_guest_orders_purchase',
  'egift_guest_orders_redemption',
  'wallet_topup',
  'sitter_bookings',
  'walk_bookings',
  'trainer_bookings',
  'pettrek_trips',
];

function resolveViewer(req: Request): FiscalActor | null {
  const uid = (req as any).firebaseUser?.uid;
  const email = (req as any).firebaseUser?.email || '';
  if (!uid) return null;
  // #240 migration: paired shape — allowlist + email_verified. An unverified
  // Firebase account with an allowlisted email is treated as CUSTOMER, not
  // PETWASH_STAFF, so it cannot see the staff-scoped fiscal envelope.
  return {
    kind: isSuperAdminVerified(req as any) ? 'PETWASH_STAFF' : 'CUSTOMER',
    uid,
    // Non-standard — kept for the eGift-purchase composer's email match.
    ...(email ? { ['email' as any]: email } : {}),
  } as FiscalActor;
}

// ─── Customer transaction list (§27, §94.20-21) ──────────────────────

router.get('/my/transactions', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const email = (viewer as any).email;
  try {
    const rows = await listCustomerTransactions({
      customerUid: viewer.uid,
      customerEmail: typeof email === 'string' ? email : undefined,
    });
    return res.json({
      ok: true,
      composedAt: new Date().toISOString(),
      transactions: rows,
    });
  } catch (err: any) {
    logger.error('[FiscalRoute] listCustomerTransactions failed', {
      viewerUidTail: viewer.uid.slice(-6), error: err?.message,
    });
    return res.status(500).json({ ok: false, error: 'LIST_FAILED' });
  }
});

// ─── Transaction detail (customer or admin) ──────────────────────────

router.get('/transactions/by-source/:source/:sourceId', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || !viewer.uid) {
    return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  }
  const source = String(req.params.source) as FiscalSourceHint;
  const sourceId = String(req.params.sourceId);
  if (!KNOWN_SOURCES.includes(source)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_SOURCE' });
  }
  // Try the viewer as CUSTOMER first; the composer's participant scope
  // will accept only owner uid. Non-owner falls through to 404
  // (privacy §34).
  const result = await composeFiscalPassport({
    sourceHint: source, sourceId, viewer,
  });
  if (result) return res.json({ ok: true, ...result });

  // If viewer is a PROVIDER (booking sources), retry with that kind.
  if (viewer.kind !== 'PETWASH_STAFF' && ['sitter_bookings', 'walk_bookings', 'trainer_bookings', 'pettrek_trips'].includes(source)) {
    const asProvider = await composeFiscalPassport({
      sourceHint: source, sourceId, viewer: { ...viewer, kind: 'PROVIDER' },
    });
    if (asProvider) return res.json({ ok: true, ...asProvider });
  }
  return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
});

// ─── Admin transaction explorer (§59, §94.24) ────────────────────────
// Same source lookup, admin-scoped viewer. isSuperAdmin gate is
// enforced by the customer path already (staff kind), but the admin
// route below returns a richer projection (external ids visible per
// showsExternalIds).

router.get('/admin/by-source/:source/:sourceId', async (req: Request, res: Response) => {
  const viewer = resolveViewer(req);
  if (!viewer || viewer.kind !== 'PETWASH_STAFF') {
    return res.status(403).json({ ok: false, error: 'ADMIN_ONLY' });
  }
  const source = String(req.params.source) as FiscalSourceHint;
  const sourceId = String(req.params.sourceId);
  if (!KNOWN_SOURCES.includes(source)) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_SOURCE' });
  }
  const result = await composeFiscalPassport({
    sourceHint: source, sourceId, viewer,
  });
  if (!result) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  return res.json({ ok: true, ...result });
});

export default router;

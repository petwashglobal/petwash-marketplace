/**
 * READ-ONLY eGift balance projection routes.
 *
 * Route: GET /api/egift/:egiftId/balance
 *   Consumes the append-only egift_events ledger + open
 *   egift_reservations and returns the honest
 *   Available / Reserved / Redeemed / Restored breakdown.
 *
 * §31 UI: reserved value MUST be visible (not hidden as if it vanished).
 * §71 Auth: mounted behind validateFirebaseToken; the projection itself
 * doesn't leak owner identity because it's keyed by an opaque egiftId —
 * only somebody who already has the id can query it. Follow-up will
 * add per-egift ACL when the wallet-scoped owner check lands.
 */
import { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger';
import { projectEgiftBalance } from '../services/egift/egiftBalanceProjection';
import {
  reserveFromEgift,
  commitReservation,
  releaseByReservationId,
} from '../services/egift/egiftReservationService';
import { pool } from '../db';
import { isSuperAdmin } from '../middleware/rbac';

const router = Router();

/**
 * CEO §30 audit (2026-08-28) — money-safety ACL.
 *
 * Prior state: authenticated user + a known egiftId could query any
 * eGift's balance AND move funds between AVAILABLE / RESERVED /
 * COMMITTED. The doc-comment at file top said "opaque id is only
 * placeholder ACL, follow-up will add owner check" — this is that
 * follow-up. Every route below now confirms the caller owns the
 * eGift before acting.
 *
 * Ownership rule matches the schema: caller uid must equal ownerUid
 * (bound after claim) OR purchaserUid (before claim). Super-admins
 * pass through for ops.
 *
 * Fail-safe: unknown eGift OR non-owner → 404 (not 403), so the
 * endpoint never confirms whether a specific id exists to a caller
 * who has no claim on it.
 */
async function assertEgiftOwnership(
  egiftId: string,
  callerUid: string,
  callerEmail: string | undefined,
): Promise<{ ok: true } | { ok: false; status: 404 | 500 }> {
  try {
    if (callerEmail && isSuperAdmin(callerEmail)) return { ok: true };
    const r = await pool.query<{ owner_uid: string | null; purchaser_uid: string | null }>(
      `SELECT owner_uid, purchaser_uid FROM e_vouchers WHERE id = $1 LIMIT 1`,
      [egiftId],
    );
    const row = r.rows[0];
    if (!row) return { ok: false, status: 404 };
    if (row.owner_uid === callerUid || row.purchaser_uid === callerUid) {
      return { ok: true };
    }
    return { ok: false, status: 404 };
  } catch (err: any) {
    logger.error('[EgiftBalance] ownership lookup failed', {
      egiftIdTail: egiftId.slice(-6), error: err?.message,
    });
    // Fail-closed: on unknown DB state we do NOT let the caller
    // through — money moves must never happen under uncertainty.
    return { ok: false, status: 500 };
  }
}

router.get('/:egiftId/balance', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  const email = (req as any).firebaseUser?.email as string | undefined;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const egiftId = String(req.params.egiftId ?? '').trim();
  if (!egiftId) return res.status(400).json({ ok: false, error: 'EGIFT_ID_REQUIRED' });
  const acl = await assertEgiftOwnership(egiftId, uid, email);
  if (!acl.ok) return res.status(acl.status).json({ ok: false, error: acl.status === 500 ? 'ACL_LOOKUP_FAILED' : 'NOT_FOUND' });
  try {
    const projection = await projectEgiftBalance(egiftId);
    return res.json({ ok: true, projection });
  } catch (err: any) {
    logger.error('[EgiftBalance] route failed', {
      egiftIdTail: egiftId.slice(-6), error: err?.message,
    });
    return res.status(500).json({ ok: false, error: 'PROJECTION_FAILED' });
  }
});

/**
 * POST /:egiftId/reservations
 *
 * Body: { amountCents, intendedCommercial, intendedSourceType?,
 *         intendedSourceId?, ttlSeconds?, idempotencyKey? }
 *
 * Atomic AVAILABLE → RESERVED. §22-23 CEO 2026-08-27. NO commercial
 * flow calls this yet — MARKETPLACE_EGIFT_FISCAL_ACTIVATION is CEO-
 * gated. Standalone endpoint so the eGift infrastructure can be
 * exercised end-to-end before activation.
 */
router.post('/:egiftId/reservations', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  const email = (req as any).firebaseUser?.email as string | undefined;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const egiftId = String(req.params.egiftId ?? '').trim();
  if (!egiftId) return res.status(400).json({ ok: false, error: 'EGIFT_ID_REQUIRED' });
  const acl = await assertEgiftOwnership(egiftId, uid, email);
  if (!acl.ok) return res.status(acl.status).json({ ok: false, error: acl.status === 500 ? 'ACL_LOOKUP_FAILED' : 'NOT_FOUND' });

  const result = await reserveFromEgift({
    egiftId,
    amountCents: Number(req.body?.amountCents ?? 0),
    intendedCommercial: String(req.body?.intendedCommercial ?? '').trim(),
    intendedSourceType: req.body?.intendedSourceType,
    intendedSourceId: req.body?.intendedSourceId,
    userId: uid,
    ttlSeconds: Number(req.body?.ttlSeconds ?? 900),
    idempotencyKey: req.body?.idempotencyKey,
  });
  if (!result.ok) return res.status(400).json({ ok: false, errorCode: result.errorCode });
  return res.json({ ok: true, reservation: result.reservation });
});

router.post('/:egiftId/reservations/:reservationId/commit', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  const email = (req as any).firebaseUser?.email as string | undefined;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const egiftId = String(req.params.egiftId ?? '').trim();
  const reservationId = String(req.params.reservationId ?? '').trim();
  if (!egiftId) return res.status(400).json({ ok: false, error: 'EGIFT_ID_REQUIRED' });
  const acl = await assertEgiftOwnership(egiftId, uid, email);
  if (!acl.ok) return res.status(acl.status).json({ ok: false, error: acl.status === 500 ? 'ACL_LOOKUP_FAILED' : 'NOT_FOUND' });
  const result = await commitReservation({
    reservationId,
    externalRef: req.body?.externalRef,
  });
  if (!result.ok) return res.status(400).json({ ok: false, errorCode: result.errorCode });
  return res.json({ ok: true, reservation: result.reservation });
});

router.post('/:egiftId/reservations/:reservationId/release', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  const email = (req as any).firebaseUser?.email as string | undefined;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const egiftId = String(req.params.egiftId ?? '').trim();
  const reservationId = String(req.params.reservationId ?? '').trim();
  if (!egiftId) return res.status(400).json({ ok: false, error: 'EGIFT_ID_REQUIRED' });
  const acl = await assertEgiftOwnership(egiftId, uid, email);
  if (!acl.ok) return res.status(acl.status).json({ ok: false, error: acl.status === 500 ? 'ACL_LOOKUP_FAILED' : 'NOT_FOUND' });
  const result = await releaseByReservationId(reservationId);
  if (!result.ok) return res.status(400).json({ ok: false, errorCode: result.errorCode });
  return res.json({ ok: true, reservation: result.reservation });
});

export default router;

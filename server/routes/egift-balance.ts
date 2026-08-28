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

const router = Router();

router.get('/:egiftId/balance', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const egiftId = String(req.params.egiftId ?? '').trim();
  if (!egiftId) return res.status(400).json({ ok: false, error: 'EGIFT_ID_REQUIRED' });
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
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const egiftId = String(req.params.egiftId ?? '').trim();
  if (!egiftId) return res.status(400).json({ ok: false, error: 'EGIFT_ID_REQUIRED' });

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
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const reservationId = String(req.params.reservationId ?? '').trim();
  const result = await commitReservation({
    reservationId,
    externalRef: req.body?.externalRef,
  });
  if (!result.ok) return res.status(400).json({ ok: false, errorCode: result.errorCode });
  return res.json({ ok: true, reservation: result.reservation });
});

router.post('/:egiftId/reservations/:reservationId/release', async (req: Request, res: Response) => {
  const uid = (req as any).firebaseUser?.uid;
  if (!uid) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });
  const reservationId = String(req.params.reservationId ?? '').trim();
  const result = await releaseByReservationId(reservationId);
  if (!result.ok) return res.status(400).json({ ok: false, errorCode: result.errorCode });
  return res.json({ ok: true, reservation: result.reservation });
});

export default router;

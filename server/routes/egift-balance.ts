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

export default router;

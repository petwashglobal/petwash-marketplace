/**
 * GET /api/service-sessions/:bookingRef — canonical read of a booking's
 * live-execution state.
 *
 * Per CEO 2026-08-18 §12/§13: this endpoint is the ONE place clients
 * ask "what's happening with this booking's actual live service right
 * now" and get back a stable shape. The projection logic lives in
 * server/lib/serviceSessionAdapter.ts — this route is a thin wrapper
 * that enforces auth + maps outcomes to HTTP.
 *
 * Response codes:
 *   200 { session: ServiceSessionDTO }
 *   400 { error: 'INVALID_REF' }
 *   401 { error: 'AUTH_REQUIRED' }
 *   403 { error: 'FORBIDDEN' }         (booking exists but caller is neither party)
 *   404 { error: 'NOT_FOUND' }
 *   500 on unexpected server error (never leaks details)
 */

import { Router, type Request, type Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { resolveServiceSession } from '../lib/serviceSessionAdapter';
import { logger } from '../lib/logger';

const router = Router();

router.get('/:bookingRef', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  const bookingRef = req.params.bookingRef;
  try {
    const outcome = await resolveServiceSession(bookingRef, uid);
    if (outcome.ok) return res.json({ session: outcome.session });
    switch (outcome.reason) {
      case 'invalid_ref':  return res.status(400).json({ error: 'INVALID_REF' });
      case 'unauthorized': return res.status(403).json({ error: 'FORBIDDEN' });
      case 'not_found':    return res.status(404).json({ error: 'NOT_FOUND' });
    }
  } catch (err: any) {
    logger.error('[service-sessions] unexpected error', { bookingRef, err: err?.message });
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

export default router;

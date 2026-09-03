/**
 * GET /api/me/capabilities — canonical capabilities for the authed user.
 *
 * Per CEO 2026-08-18 §35.4 + §6: ONE stable capabilities endpoint the client
 * uses for mode-switch, Become Provider routing, and any UI branch that
 * asks "can this user do X?". Server is authority — client never invents.
 *
 * Additive: does NOT replace /api/me/status. Both live; me-status keeps
 * shipping its shape (which some pages read directly), and this new
 * endpoint exposes the canonical capabilities shape derived from the
 * same authoritative reads via server/lib/userCapabilities.ts.
 *
 * The response is a UserCapabilities object (see shared/lib/userCapabilities.ts).
 */

import { Router, type Request, type Response } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { isSuperAdminVerified } from '../middleware/rbac';
import { getUserCapabilities } from '../lib/userCapabilities';
import { logger } from '../lib/logger';

const router = Router();

router.get('/capabilities', validateFirebaseToken, async (req: Request, res: Response) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) {
    return res.status(401).json({ error: 'AUTH_REQUIRED' });
  }
  try {
    const superAdminVerified = isSuperAdminVerified(req);
    const caps = await getUserCapabilities(uid, { superAdminVerified });
    return res.json(caps);
  } catch (err: any) {
    // Release-blocker B8 (CEO 2026-09-02): distinguish INFRA FAILURE
    // from "this user genuinely has no elevated capabilities." Returning
    // emptyCapabilities on error would silently demote an admin or
    // provider to member-only in the UI during any DB blip. Instead
    // return a 503 with an explicit unavailable state so the client can
    // render an error/retry surface and fail privileged actions closed.
    logger.error('[me/capabilities] infra failure — returning 503', {
      uid,
      err: err?.message || String(err),
    });
    return res.status(503).json({
      unavailable: true,
      error: 'capabilities_unavailable',
      message: 'Capabilities could not be loaded; please retry.',
    });
  }
});

export default router;

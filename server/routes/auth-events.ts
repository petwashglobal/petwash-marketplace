/**
 * GET /api/account/security/recent-logins
 *
 * Returns the authenticated user's own recent auth events.
 *
 * Security:
 *   - Requires a valid Firebase session (validateFirebaseToken is applied at the
 *     app.use() mount point in routes.ts — consistent with the rest of the codebase)
 *   - User can only access their own events — enforced by querying by userId
 *   - Never returns: raw IP, hashes, tokens, passwords, internal IDs
 *   - Masked IP is included (e.g. 1.2.3.xxx) for informational display only
 */

import { Router } from 'express';
import { getRecentLoginsForUser } from '../services/AuthEventService';
import { logger } from '../lib/logger';

const router = Router();

router.get('/recent-logins', async (req, res) => {
  try {
    // userId is guaranteed by validateFirebaseToken at the mount point.
    // The null-check is kept as a defense-in-depth safety net.
    const userId = req.firebaseUser?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const limit = Math.min(
      parseInt((req.query.limit as string) || '20', 10) || 20,
      50,
    );

    const events = await getRecentLoginsForUser(userId, limit);

    return res.json({ events });
  } catch (err) {
    logger.error('[auth-events] Failed to fetch recent logins', { error: String(err) });
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;

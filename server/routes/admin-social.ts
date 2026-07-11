/**
 * Admin Social Growth API — read-only insights for PetWash's own social accounts.
 * Mounted at /api/admin/social under the global /api/admin/ guard stack
 * (requireRole + requireStaffApproved + requireMfaEnrolled + rate-limit), so no
 * extra auth is needed here. Backed by SocialInsightsService (dark until tokens).
 */
import { Router, type Request, type Response } from 'express';
import {
  getOverview,
  snapshotPlatform,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '../services/SocialInsightsService';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/admin/social/overview — per-platform followers, 7d delta, connect state.
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const overview = await getOverview();
    return res.json(overview);
  } catch (err: any) {
    logger.error('[AdminSocial] overview failed', { err: err?.message });
    return res.status(500).json({ error: 'Failed to load social overview' });
  }
});

// POST /api/admin/social/snapshot/:platform — pull live metrics now (a no-op with
// a clear reason when that platform is not wired). ?all=1 snapshots every platform.
router.post('/snapshot/:platform', async (req: Request, res: Response) => {
  try {
    if (req.query.all === '1' || req.params.platform === 'all') {
      const results = await Promise.all(SOCIAL_PLATFORMS.map((p) => snapshotPlatform(p)));
      return res.json({ results });
    }
    const platform = req.params.platform as SocialPlatform;
    if (!SOCIAL_PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `unknown platform: ${platform}` });
    }
    const result = await snapshotPlatform(platform);
    return res.json(result);
  } catch (err: any) {
    logger.error('[AdminSocial] snapshot failed', { err: err?.message });
    return res.status(500).json({ error: 'Snapshot failed' });
  }
});

export default router;

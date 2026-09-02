/**
 * Cloud-Scheduler social snapshot — daily auto-capture of PetWash's own social
 * metrics (@petwashltd IG/TikTok/Facebook) into social_metric_snapshots, so the
 * /admin/social dashboard's week-over-week trend fills itself with no manual step.
 *
 * SAFE TO SCHEDULE NOW: SocialInsightsService is dark until each platform's API
 * token is set — this cron is a complete NO-OP for any unwired platform (returns
 * {wired:false}), never throws, never writes fake data. Read-only against the
 * social APIs; it only appends a metrics row per wired platform.
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — identical to
 * cron-nayax-sumit.ts. CSRF-exempt via the /api/cron mount.
 *
 * Cloud Scheduler setup (ops, after tokens are set — once a day is plenty):
 *   gcloud scheduler jobs create http petwash-social-snapshot \
 *     --location=me-west1 --schedule="30 2 * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/social-snapshot" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { isSuperAdminVerified } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { snapshotPlatform, SOCIAL_PLATFORMS } from '../services/SocialInsightsService';

const router = Router();

async function authorized(req: Request): Promise<boolean> {
  const provided = (req.headers['x-cron-secret'] as string) || '';
  const expected = process.env.CRON_SECRET || '';
  const { timingSafeEqual } = await import('crypto');
  const secretOk =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (secretOk) return true;
  // #240 migration: allowlist + email_verified. Cron secret handled above; UID path is the only one that can bypass without a shared secret.
  return isSuperAdminVerified(req as any);
}

// POST /api/cron/social-snapshot — snapshot every wired platform (no-op for dark ones).
router.post('/social-snapshot', async (req: Request, res: Response) => {
  if (!(await authorized(req))) {
    logger.warn('[CronSocial] Unauthorized trigger', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  const results = await Promise.all(SOCIAL_PLATFORMS.map((p) => snapshotPlatform(p)));
  const captured = results.filter((r) => r.ok).length;
  const wired = results.filter((r) => r.wired).length;
  logger.info('[CronSocial] snapshot run', { captured, wired });
  return res.json({ success: true, captured, wired, results });
});

export default router;

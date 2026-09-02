/**
 * Cloud-Scheduler backup trigger — the RELIABLE replacement for in-process cron.
 *
 * Backups were scheduled only via in-process node-cron (backgroundJobs.ts). On
 * Cloud Run that is fragile (instance restarts, deploys, scaling), and the GCS
 * backup buckets showed the nightly jobs had effectively stopped (postgres dump
 * NEVER landed; firestore/code stale since 2025-11). An external Cloud Scheduler
 * job hitting this HTTP endpoint cannot silently die the way an in-process timer
 * can, and it lets an admin run a backup ON DEMAND to verify the pipeline.
 *
 * Auth: the same x-cron-secret convention already used by credit-wallet's cron
 * trigger (timing-safe compare vs CRON_SECRET) OR a super-admin Firebase user.
 * CSRF-exempt (machine-to-machine; see server/index.ts cron allowlist). No money.
 *
 * Cloud Scheduler setup (ops, after CRON_SECRET is set + this deploys):
 *   gcloud scheduler jobs create http petwash-backup-postgres \
 *     --location=me-west1 --schedule="0 3 * * *" --time-zone="Asia/Jerusalem" \
 *     --uri="https://<run-url>/api/cron/backup/postgres" --http-method=POST \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 *   (repeat for /firestore at "0 1 * * *" and /code at "0 2 * * 0")
 */
import { Router, type Request, type Response } from 'express';
import { isSuperAdminVerified } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

const VALID_TYPES = ['postgres', 'firestore', 'code'] as const;
type BackupType = (typeof VALID_TYPES)[number];

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

// POST /api/cron/backup/:type  (type = postgres | firestore | code)
router.post('/backup/:type', async (req: Request, res: Response) => {
  const type = String(req.params.type || '') as BackupType;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: `type must be one of ${VALID_TYPES.join(', ')}` });
  }
  if (!(await authorized(req))) {
    logger.warn('[CronBackup] Unauthorized trigger', { ip: req.ip, type });
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const svc = await import('../services/gcsBackupService');
    if (!svc.isGcsConfigured()) {
      return res.status(503).json({ success: false, error: 'GCS not configured' });
    }
    logger.info('[CronBackup] Triggered', { type });
    const result =
      type === 'postgres' ? await svc.performPostgresBackup()
      : type === 'firestore' ? await svc.performFirestoreExport()
      : await svc.performWeeklyCodeBackup();
    const ok = (result as any)?.success !== false;
    logger.info('[CronBackup] Completed', { type, ok });
    return res.status(ok ? 200 : 500).json({ triggeredType: type, ...result });
  } catch (err: any) {
    logger.error('[CronBackup] Failed', { type, error: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'backup_failed' });
  }
});

export default router;

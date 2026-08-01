/**
 * Cron: synthetic money-path check (CTO P0-7, 2026-07-31).
 *
 * Cloud Scheduler pings this on a schedule. It runs the REAL production money code and
 * asserts the VAT/commission invariants (SyntheticMoneyPathMonitor). On any failure it
 * PAGES (sendSecurityAlert) AND returns 500 so the Scheduler run is marked failed — a
 * "healthy but financially wrong" prod state is caught immediately, not silently.
 *
 * Auth: x-cron-secret (timing-safe vs CRON_SECRET) OR super-admin — same as sibling crons.
 *   gcloud scheduler jobs create http petwash-synthetic-money \
 *     --schedule="* / 15 * * * *" --http-method=POST \
 *     --uri="https://petwash.co.il/api/cron/synthetic-money-check" \
 *     --headers="x-cron-secret=<CRON_SECRET>"
 */
import { Router, type Request, type Response } from 'express';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';
import { SyntheticMoneyPathMonitor } from '../services/SyntheticMoneyPathMonitor';
import { sendCriticalAlert } from '../services/alerts';

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
  const email = (req as any).firebaseUser?.email || (req as any).user?.email || '';
  return isSuperAdmin(email);
}

async function handler(req: Request, res: Response) {
  if (!(await authorized(req))) {
    logger.warn('[CronSyntheticMoney] Unauthorized trigger', { ip: req.ip });
    return res.status(403).json({ ok: false, error: 'Unauthorized' });
  }
  const report = await SyntheticMoneyPathMonitor.runChecks();
  if (!report.ok) {
    const failed = report.checks.filter((c) => !c.ok);
    logger.error('[CronSyntheticMoney] MONEY-PATH INVARIANT FAILED IN PROD', { failed });
    try {
      await sendCriticalAlert(
        'money-path invariant FAILED in production',
        `<p>The synthetic money-path monitor found <b>${failed.length}</b> failing invariant(s) — production money math may be WRONG. Investigate before more transactions clear:</p><ul>${failed
          .map((c) => `<li><b>${c.name}</b>: ${c.detail}</li>`)
          .join('')}</ul>`,
        `${failed.length} money invariant(s) FAILED: ${failed.map((c) => c.name).join(', ')}`,
      );
    } catch (e: any) {
      logger.error('[CronSyntheticMoney] alert send failed', { err: e?.message });
    }
    // 500 → Cloud Scheduler marks the run failed → GCP alerting (a second channel).
    return res.status(500).json({ ok: false, ...report });
  }
  return res.status(200).json(report);
}

router.get('/synthetic-money-check', handler);
router.post('/synthetic-money-check', handler);

export default router;

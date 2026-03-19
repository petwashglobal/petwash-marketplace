/**
 * WIN-BACK CRON SCHEDULE
 *
 * Two nightly jobs (Israel time UTC+2/3):
 *   01:00 — Populator: scans for dormant owners → inserts winback_queue rows
 *   01:30 — Processor: processes pending queue → awards credit + notifies
 *
 * Both jobs are safe to re-run manually (idempotent).
 */

import cron from 'node-cron';
import { logger } from '../lib/logger';
import { runWinbackPopulator } from '../jobs/winback-populator';
import { runWinbackProcessor } from '../jobs/winback-processor';

export function startWinbackCron(): void {
  // 01:00 Israel time ≈ 23:00 UTC (winter) / 22:00 UTC (summer)
  // Using UTC 23:00 daily — acceptable drift of 1h during DST
  cron.schedule('0 23 * * *', async () => {
    logger.info('[WinbackCron] Populator triggered');
    try {
      await runWinbackPopulator();
    } catch (err: any) {
      logger.error('[WinbackCron] Populator failed', { error: err.message });
    }
  }, { timezone: 'UTC' });

  // 01:30 Israel time ≈ 23:30 UTC
  cron.schedule('30 23 * * *', async () => {
    logger.info('[WinbackCron] Processor triggered');
    try {
      await runWinbackProcessor();
    } catch (err: any) {
      logger.error('[WinbackCron] Processor failed', { error: err.message });
    }
  }, { timezone: 'UTC' });

  logger.info('[WinbackCron] Scheduled — populator 23:00 UTC, processor 23:30 UTC');
}

export default startWinbackCron;

/**
 * WIN-BACK CRON SCHEDULE
 *
 * Three daily jobs (Israel time ≈ UTC+2):
 *
 *   23:00 UTC / 01:00 IL  — Populator: scans dormant owners → inserts winback_queue rows
 *   23:30 UTC / 01:30 IL  — Processor (night): initial pass, mostly schedules rows to 18:00 IL
 *   16:30 UTC / 18:30 IL  — Processor (evening window): picks up timing-deferred rows that
 *                            have scheduled_at ≤ now AND are inside the 18:00–21:00 IL window.
 *
 * WHY TWO PROCESSOR RUNS?
 *   Phase 6.13 smart-timing defers rows to 18:00 IL when the processor runs outside the
 *   optimal send window. Without an evening run the same day, those rows would sit until
 *   the next night's 01:30 run, get deferred again, and never be sent. The 16:30 UTC run
 *   catches them 30 minutes after the window opens.
 *
 * Both jobs are idempotent — safe to re-run manually.
 */

import cron from 'node-cron';
import { logger } from '../lib/logger';
import { runWinbackPopulator } from '../jobs/winback-populator';
import { runWinbackProcessor } from '../jobs/winback-processor';

async function runPopulator() {
  logger.info('[WinbackCron] Populator triggered');
  try {
    await runWinbackPopulator();
  } catch (err: any) {
    logger.error('[WinbackCron] Populator failed', { error: err.message });
  }
}

async function runProcessor(label: 'night' | 'evening') {
  logger.info(`[WinbackCron] Processor triggered (${label})`);
  try {
    await runWinbackProcessor();
  } catch (err: any) {
    logger.error(`[WinbackCron] Processor failed (${label})`, { error: err.message });
  }
}

export function startWinbackCron(): void {
  // 01:00 IL ≈ 23:00 UTC (non-DST)
  cron.schedule('0 23 * * *', () => runPopulator(), { timezone: 'UTC' });

  // 01:30 IL ≈ 23:30 UTC — night run (queues rows, mostly defers them to 18:00 IL)
  cron.schedule('30 23 * * *', () => runProcessor('night'), { timezone: 'UTC' });

  // 18:30 IL ≈ 16:30 UTC — evening window run (processes timing-deferred rows)
  cron.schedule('30 16 * * *', () => runProcessor('evening'), { timezone: 'UTC' });

  logger.info('[WinbackCron] Scheduled — populator 23:00 UTC, processor 23:30 UTC + 16:30 UTC (evening window)');
}

export default startWinbackCron;

/**
 * NextBestActionFeedback pruner cron — Journey Brain Phase 6
 * (post-release 2026-09-04).
 *
 * The `next_best_action_feedback` table records ONE row per user tap
 * on a NextBestActionCard action (verdict: act | dismiss |
 * not_interested | fewer_like_this). The composer's suppression
 * read (recentFeedback) only ever looks back at most 7 days, and
 * the analytics rollup job aggregates older data into its own
 * table. So rows older than 90 days serve no runtime purpose and
 * can be physically deleted to keep the table lean.
 *
 * Mirror of server/cron/journey-checkpoints-prune.ts:
 *   * hourly sweep, first run 5 minutes after boot.
 *   * timer.unref() so shutdown is clean.
 *   * pruneOldFeedback is fail-soft (returns 0 on any pg error).
 *   * Disable with NBA_FEEDBACK_PRUNER_DISABLED=true.
 */
import { pool, isDatabaseAvailable } from '../db';
import { pruneOldFeedback } from '../services/nextBestActionFeedback';
import { logger } from '../lib/logger';

const INTERVAL_MS = 60 * 60 * 1000;   // every hour
const FIRST_RUN_MS = 5 * 60 * 1000;   // first sweep 5min after boot
const RETENTION_DAYS = 90;

async function tick(): Promise<void> {
  if (!isDatabaseAvailable) return;
  try {
    const deleted = await pruneOldFeedback(pool, { olderThanDays: RETENTION_DAYS });
    if (deleted > 0) {
      logger.info('[NextBestActionFeedbackPruner] swept old rows', { deleted });
    }
  } catch (err) {
    // pruneOldFeedback already fails-soft internally — belt-and-braces.
    logger.warn('[NextBestActionFeedbackPruner] tick error (non-fatal)', {
      err: (err as Error)?.message,
    });
  }
}

export function startNextBestActionFeedbackPrunerCron(): void {
  if (process.env.NBA_FEEDBACK_PRUNER_DISABLED === 'true') {
    logger.info(
      '[NextBestActionFeedbackPruner] disabled via NBA_FEEDBACK_PRUNER_DISABLED=true',
    );
    return;
  }
  const timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  setTimeout(tick, FIRST_RUN_MS);
  logger.info(
    '[NextBestActionFeedbackPruner] started — hourly sweep of rows older than 90 days',
  );
}

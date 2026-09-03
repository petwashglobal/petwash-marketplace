/**
 * JourneyCheckpoints pruner cron — Lane C.2 (post-release 2026-09-03).
 *
 * The `journey_checkpoints` table stores in-flight wizard state with an
 * `expires_at` column (72h TTL by default). Reads already refuse
 * `expires_at <= now()` rows, so a stale row is INVISIBLE to callers.
 * But the row itself lives on disk until something deletes it, and
 * `saveCheckpoint` upserts a row per (user_uid, domain) — the same
 * pair may be re-abandoned dozens of times over months.
 *
 * This cron periodically calls `pruneExpiredCheckpoints(pool)` to
 * physically delete expired rows. That keeps the table lean, keeps
 * the partial expiry index efficient, and closes the "abandoned
 * rows accumulate forever" hygiene gap without changing runtime
 * behaviour.
 *
 * Safe by construction:
 *   • The pruner service itself is fail-soft (log-and-swallow).
 *   • The interval is in-process and .unref()'d so it never keeps
 *     the event loop alive on shutdown.
 *   • Disable with JOURNEY_CHECKPOINTS_PRUNER_DISABLED=true.
 */
import { pool, isDatabaseAvailable } from '../db';
import { pruneExpiredCheckpoints } from '../services/journeyCheckpoints';
import { logger } from '../lib/logger';

const INTERVAL_MS = 60 * 60 * 1000;   // every hour
const FIRST_RUN_MS = 5 * 60 * 1000;   // first sweep 5min after boot (avoid startup pressure)

async function tick(): Promise<void> {
  if (!isDatabaseAvailable) return;
  try {
    const deleted = await pruneExpiredCheckpoints(pool);
    if (deleted > 0) {
      logger.info('[JourneyCheckpointsPruner] swept expired rows', { deleted });
    }
  } catch (err) {
    // pruneExpiredCheckpoints already fails-soft internally, but keep
    // this belt-and-braces so a wrapper-level throw can't crash the
    // scheduler.
    logger.warn('[JourneyCheckpointsPruner] tick error (non-fatal)', {
      err: (err as Error)?.message,
    });
  }
}

export function startJourneyCheckpointsPrunerCron(): void {
  if (process.env.JOURNEY_CHECKPOINTS_PRUNER_DISABLED === 'true') {
    logger.info('[JourneyCheckpointsPruner] disabled via JOURNEY_CHECKPOINTS_PRUNER_DISABLED=true');
    return;
  }
  const timer = setInterval(tick, INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  setTimeout(tick, FIRST_RUN_MS);
  logger.info('[JourneyCheckpointsPruner] started — hourly sweep of expired journey_checkpoints rows');
}

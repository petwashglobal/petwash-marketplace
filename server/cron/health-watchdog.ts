/**
 * Health Watchdog — FREE self-monitoring (no paid vendor).
 *
 * The 2026-06-17 production DB outage went unnoticed because nothing watched
 * /api/health. This closes that gap using ONLY infrastructure we already have:
 * an in-process timer runs `SELECT 1` against the pool and, on sustained failure,
 * fires sendAlert() — which emails (SendGrid) + Slacks (webhook) the team. No
 * external API calls, no cost. Pairs with Sentry (set SENTRY_DSN, free tier or
 * self-hosted GlitchTip) and GCP Error Reporting (free, native to Cloud Run).
 *
 * Safe by construction: never throws, alerts only on a healthy→down transition
 * after 2 consecutive failures (no blip spam), and one recovery notice.
 * Disable with HEALTH_WATCHDOG_DISABLED=true.
 */
import { pool, isDatabaseAvailable } from '../db';
import { sendAlert } from '../monitoring';
import { logger } from '../lib/logger';

const INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes
const FIRST_CHECK_MS = 30 * 1000;  // first check 30s after boot

let lastDbOk: boolean | null = null;
let consecutiveFailures = 0;

async function checkDb(): Promise<boolean> {
  if (!isDatabaseAvailable) return false;
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

async function tick(): Promise<void> {
  try {
    const ok = await checkDb();
    consecutiveFailures = ok ? 0 : consecutiveFailures + 1;

    if (lastDbOk !== false && consecutiveFailures >= 2) {
      // healthy (or unknown) -> down
      await sendAlert({
        type: 'system_error',
        severity: 'critical',
        message: 'PetWash production DB health check is FAILING — sign-in, balances, and the shop will break.',
        details:
          `pool "SELECT 1" failed ${consecutiveFailures} consecutive times. ` +
          'Most likely DATABASE_URL is not the Neon POOLED endpoint (host must contain "-pooler"), ' +
          'or the Neon project is suspended / at its connection limit. Verify via GET /api/health (db.ok).',
      });
      lastDbOk = false;
      logger.error('[HealthWatchdog] DB DOWN — alert sent');
    } else if (ok && lastDbOk === false) {
      // down -> recovered
      await sendAlert({
        type: 'system_error',
        severity: 'info',
        message: 'PetWash production DB has RECOVERED — health check passing again.',
      });
      lastDbOk = true;
      logger.info('[HealthWatchdog] DB recovered — alert sent');
    } else if (ok && lastDbOk === null) {
      lastDbOk = true;
    }
  } catch (err) {
    // The watchdog must never crash the process.
    logger.warn('[HealthWatchdog] tick error (non-fatal)', { err: (err as Error)?.message });
  }
}

export function startHealthWatchdogCron(): void {
  if (process.env.HEALTH_WATCHDOG_DISABLED === 'true') {
    logger.info('[HealthWatchdog] disabled via HEALTH_WATCHDOG_DISABLED=true');
    return;
  }
  const timer = setInterval(tick, INTERVAL_MS);
  // Don't keep the event loop alive solely for the watchdog (clean shutdown).
  if (typeof timer.unref === 'function') timer.unref();
  setTimeout(tick, FIRST_CHECK_MS);
  logger.info('[HealthWatchdog] started — DB health alerts via sendAlert (email/Slack) every 3min, $0.');
}

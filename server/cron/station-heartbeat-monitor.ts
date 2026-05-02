/**
 * STATION HEARTBEAT MONITOR (PR-5)
 *
 * Scans kiosk_machines every 2 minutes for stations whose last_heartbeat is
 * older than the staleness threshold (15 minutes by default). For each
 * stale kiosk:
 *   1. Tries to write an 'offline' alert via stationAlertWriter (which
 *      bridges kiosk_machines → pet_wash_stations via nayax_terminal_id).
 *   2. Flips kiosk_machines.is_online = false so subsequent runs do not
 *      re-fire the same alert every 2 minutes.
 *
 * Recovery — handled separately in the heartbeat handler at
 * server/routes/k9000.ts: when a previously-stale kiosk reports in, it
 * calls resolveStationAlerts(kioskId, 'offline') which sets the open
 * alerts to status='resolved'.
 *
 * Hard rules
 * ───────────────────────────────────────────────────────────────────────────
 * - DOES NOT touch K9000 runtime semantics. Only reads kiosk_machines and
 *   flips is_online (a status flag). Heartbeats themselves are written by
 *   the K9000 controller via /api/k9000/heartbeat — untouched.
 * - All inserts wrapped in try/catch via stationAlertWriter.
 * - Bounded: scans at most 200 stale stations per run; each handled
 *   independently so one DB error does not abort the rest.
 * - No schema migration. No FK change.
 */
import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { writeStationAlert } from '../lib/stationAlertWriter';

/**
 * Threshold for "this kiosk is offline". Heartbeats are expected at least
 * every few minutes when a kiosk is online. 15 minutes is the same window
 * the Brain Dashboard uses for `heartbeatStale` — keep them in sync.
 */
const STALE_HEARTBEAT_MINUTES = 15;

/**
 * Per-run cap. Production fleet should be small enough that this never
 * matters — if it ever does, ops needs to know about it anyway.
 */
const MAX_STATIONS_PER_RUN = 200;

interface StaleKioskRow {
  kiosk_id: string;
  name: string | null;
  last_heartbeat: string | Date | null;
}

async function scanStaleHeartbeats(): Promise<void> {
  let staleRows: StaleKioskRow[] = [];

  try {
    const result = await db.execute(sql`
      SELECT kiosk_id, name, last_heartbeat
      FROM kiosk_machines
      WHERE is_online = true
        AND last_heartbeat IS NOT NULL
        AND last_heartbeat < NOW() - INTERVAL '${sql.raw(String(STALE_HEARTBEAT_MINUTES))} minutes'
      ORDER BY last_heartbeat ASC
      LIMIT ${MAX_STATIONS_PER_RUN}
    `);
    staleRows = ((result as any).rows as StaleKioskRow[]) ?? [];
  } catch (err: any) {
    logger.error('[HeartbeatMonitor] scan query failed', {
      error: err?.message ?? String(err),
    });
    return;
  }

  if (staleRows.length === 0) {
    logger.debug('[HeartbeatMonitor] no stale kiosks');
    return;
  }

  logger.info('[HeartbeatMonitor] stale kiosks detected', { count: staleRows.length });

  for (const row of staleRows) {
    const kioskId = row.kiosk_id;
    const lastHb = row.last_heartbeat ? new Date(row.last_heartbeat) : null;
    const minutesStale = lastHb
      ? Math.round((Date.now() - lastHb.getTime()) / 60_000)
      : null;

    // 1. Write the alert (idempotent — duplicates are skipped by the helper).
    const writeResult = await writeStationAlert({
      kioskId,
      alertType: 'offline',
      severity: 'critical',
      title: `Station offline — ${row.name ?? kioskId}`,
      message:
        minutesStale !== null
          ? `No heartbeat received from ${kioskId} in ${minutesStale} minutes (threshold ${STALE_HEARTBEAT_MINUTES}m)`
          : `No heartbeat record on file for ${kioskId}; threshold ${STALE_HEARTBEAT_MINUTES}m exceeded`,
      triggerValue: lastHb ? lastHb.toISOString() : null,
      thresholdValue: `${STALE_HEARTBEAT_MINUTES}min`,
      metadata: { stationName: row.name, minutesStale },
    });

    if (!writeResult.inserted && writeResult.reason !== 'duplicate') {
      // Real failure (not_mapped, no_terminal_id, kiosk_not_found, db_error).
      // Log and continue — one kiosk's failure must not stop the rest.
      logger.warn('[HeartbeatMonitor] alert insert skipped', {
        kioskId, reason: writeResult.reason, detail: writeResult.detail,
      });
    }

    // 2. Mark is_online = false so we do not re-scan and re-fire on next tick.
    // Best-effort. If this fails the duplicate-detection in writeStationAlert
    // protects us against re-firing the same alert.
    try {
      await db.execute(sql`
        UPDATE kiosk_machines
        SET is_online = false, updated_at = NOW()
        WHERE kiosk_id = ${kioskId}
      `);
    } catch (err: any) {
      logger.warn('[HeartbeatMonitor] is_online flip failed (non-fatal)', {
        kioskId, error: err?.message ?? String(err),
      });
    }
  }
}

/**
 * Initialise cron job. Runs every 2 minutes. Match the auto-void cron
 * pattern from server/cron/auto-void-expired-payments.ts: schedule +
 * delayed initial scan post-deployment.
 */
export function startHeartbeatMonitorCron(): void {
  logger.info('[HeartbeatMonitor] Initializing heartbeat-monitor cron (every 2 min, threshold 15 min)');

  cron.schedule('*/2 * * * *', async () => {
    await scanStaleHeartbeats();
  });

  // Delay the first scan by 90s so deploy health checks finish before the
  // cron starts hitting the DB.
  setTimeout(async () => {
    logger.info('[HeartbeatMonitor] Running delayed initial scan (post-deployment)');
    await scanStaleHeartbeats();
  }, 90_000);

  logger.info('[HeartbeatMonitor] Cron job started successfully');
}

export default startHeartbeatMonitorCron;

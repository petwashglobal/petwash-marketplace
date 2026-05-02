/**
 * stationAlertWriter — single entry point for inserting station_alerts rows.
 *
 * Why a helper exists
 * ───────────────────────────────────────────────────────────────────────────
 * The station_alerts.station_id column references pet_wash_stations.id.
 * The K9000 runtime writes its live state to a different table —
 * kiosk_machines (per server/routes/k9000.ts:104, k9000.ts:1321) — and
 * pw_payments.machine_id stores the kiosk_machines.kiosk_id varchar.
 *
 * In production today these two tables share NO common rows. The
 * enterprise/franchise seed (scripts/seed-enterprise.ts) populates
 * pet_wash_stations with demo entries that do not match the live K9000
 * fleet. Direct inserts into station_alerts would therefore violate the
 * NOT NULL FK for any real kiosk.
 *
 * This helper bridges the two by nayax_terminal_id (a column present on
 * BOTH tables): we look up kiosk_machines.nayax_terminal_id for the given
 * kioskId, then SELECT pet_wash_stations.id WHERE the same value matches.
 * If a matching pet_wash_stations row exists, we INSERT the alert against
 * that id. If not, we DROP the alert and return a structured "not_mapped"
 * reason so the caller can log it for ops backfill — never fake parent
 * rows, never violate the FK, never throw.
 *
 * Hard rules
 * ───────────────────────────────────────────────────────────────────────────
 * - Read-only on kiosk_machines + pet_wash_stations (lookups only).
 * - Append-only on station_alerts.
 * - All DB ops in try/catch, never throws — failure returns
 *   { inserted: false, reason: '...' }.
 * - No schema migration. No FK change.
 *
 * Future
 * ───────────────────────────────────────────────────────────────────────────
 * When the schema is fixed (station_alerts.station_id → kiosk_machines.id,
 * or split into kiosk_id text + pet_station_id int), this is the only file
 * that needs to change to pick up the new mapping.
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

export type StationAlertSeverity = 'info' | 'warning' | 'critical';

export interface WriteStationAlertParams {
  /** kiosk_machines.kiosk_id — e.g. 'KIOSK-TLV-001' */
  kioskId: string;
  /** Free-form alert type string (varchar). Common values:
   *  offline | low_supplies | equipment_failure | maintenance_due |
   *  high_usage | temperature_warning | payment_declined |
   *  payment_reversed | chargeback */
  alertType: string;
  severity: StationAlertSeverity;
  title: string;
  message: string;
  /** Optional: the raw value that triggered the alert (e.g. last_heartbeat) */
  triggerValue?: string | null;
  /** Optional: the threshold that was crossed (e.g. '15min') */
  thresholdValue?: string | null;
  /** Optional: structured extra context, JSONB-safe */
  metadata?: Record<string, any>;
}

export interface WriteStationAlertResult {
  inserted: boolean;
  /** When inserted=true: the id of the new station_alerts row */
  alertId?: number;
  /** When inserted=false: a short machine-readable reason */
  reason?:
    | 'not_mapped' // kiosk has no pet_wash_stations FK match
    | 'kiosk_not_found' // kiosk_machines lookup returned 0 rows
    | 'no_terminal_id' // kiosk has no nayax_terminal_id to bridge on
    | 'duplicate' // alert already exists (open/acknowledged) for same type
    | 'db_error'; // DB threw
  /** When inserted=false: human-readable detail for the log line */
  detail?: string;
}

/**
 * Insert a station_alerts row for a given kiosk_machines.kiosk_id.
 * See file-level doc for the bridge-mapping rule.
 *
 * Idempotency: skips insert when an OPEN or ACKNOWLEDGED alert already
 * exists for the same (station_id, alert_type) pair. Returns
 * { inserted: false, reason: 'duplicate' } in that case so the caller
 * can decide whether to bump severity or simply move on.
 *
 * Never throws. All DB errors are returned as
 * { inserted: false, reason: 'db_error', detail }.
 */
export async function writeStationAlert(
  params: WriteStationAlertParams,
): Promise<WriteStationAlertResult> {
  const { kioskId, alertType, severity, title, message } = params;

  try {
    // Step 1 — find the kiosk and read its nayax_terminal_id (the bridge column).
    const kioskRows = await db.execute(sql`
      SELECT id, nayax_terminal_id
      FROM kiosk_machines
      WHERE kiosk_id = ${kioskId}
      LIMIT 1
    `);
    const kioskRow = ((kioskRows as any).rows as any[])[0];

    if (!kioskRow) {
      return { inserted: false, reason: 'kiosk_not_found', detail: `kioskId=${kioskId}` };
    }
    if (!kioskRow.nayax_terminal_id) {
      return {
        inserted: false,
        reason: 'no_terminal_id',
        detail: `kioskId=${kioskId} has no nayax_terminal_id; cannot bridge to pet_wash_stations`,
      };
    }

    // Step 2 — look up the matching pet_wash_stations row by nayax_terminal_id.
    const stationRows = await db.execute(sql`
      SELECT id
      FROM pet_wash_stations
      WHERE nayax_terminal_id = ${kioskRow.nayax_terminal_id}
      LIMIT 1
    `);
    const stationRow = ((stationRows as any).rows as any[])[0];

    if (!stationRow) {
      return {
        inserted: false,
        reason: 'not_mapped',
        detail:
          `kioskId=${kioskId} terminal=${kioskRow.nayax_terminal_id} has no ` +
          `pet_wash_stations row. Backfill the enterprise registry to enable alerts.`,
      };
    }

    const stationId: number = Number(stationRow.id);

    // Step 3 — idempotency check. Skip if an open/acknowledged alert of the
    // same type already exists for this station.
    const dupRows = await db.execute(sql`
      SELECT id
      FROM station_alerts
      WHERE station_id = ${stationId}
        AND alert_type = ${alertType}
        AND status IN ('open', 'acknowledged')
      LIMIT 1
    `);
    const dupRow = ((dupRows as any).rows as any[])[0];
    if (dupRow) {
      return {
        inserted: false,
        reason: 'duplicate',
        detail: `existing alertId=${dupRow.id} for stationId=${stationId} type=${alertType}`,
      };
    }

    // Step 4 — insert. Bound metadata to a JSON value defensively.
    const metadataJson = params.metadata ? JSON.stringify({
      kioskId,
      ...params.metadata,
    }) : JSON.stringify({ kioskId });

    const insertRes = await db.execute(sql`
      INSERT INTO station_alerts (
        station_id, alert_type, severity, title, message,
        triggered_at, status, trigger_value, threshold_value,
        notifications_sent
      )
      VALUES (
        ${stationId}, ${alertType}, ${severity}, ${title}, ${message},
        NOW(), 'open', ${params.triggerValue ?? null}, ${params.thresholdValue ?? null},
        ${metadataJson}::jsonb
      )
      RETURNING id
    `);
    const insertedRow = ((insertRes as any).rows as any[])[0];
    const alertId = Number(insertedRow?.id);

    logger.info('[StationAlertWriter] alert inserted', {
      kioskId, stationId, alertType, severity, alertId,
    });
    return { inserted: true, alertId };
  } catch (err: any) {
    logger.error('[StationAlertWriter] insert failed', {
      kioskId, alertType, error: err?.message ?? String(err),
    });
    return {
      inserted: false,
      reason: 'db_error',
      detail: String(err?.message ?? err).slice(0, 200),
    };
  }
}

/**
 * Auto-resolve all OPEN alerts of a given type for a kiosk. Used by the
 * heartbeat handler when a previously-stale kiosk reports in again.
 *
 * Sets status = 'resolved', resolved_at = NOW(). Does NOT throw on error.
 */
export async function resolveStationAlerts(
  kioskId: string,
  alertType: string,
): Promise<{ resolvedCount: number; reason?: string; detail?: string }> {
  try {
    const kioskRows = await db.execute(sql`
      SELECT nayax_terminal_id FROM kiosk_machines WHERE kiosk_id = ${kioskId} LIMIT 1
    `);
    const kioskRow = ((kioskRows as any).rows as any[])[0];
    if (!kioskRow?.nayax_terminal_id) {
      return { resolvedCount: 0, reason: 'no_terminal_id' };
    }

    const stationRows = await db.execute(sql`
      SELECT id FROM pet_wash_stations WHERE nayax_terminal_id = ${kioskRow.nayax_terminal_id} LIMIT 1
    `);
    const stationRow = ((stationRows as any).rows as any[])[0];
    if (!stationRow) {
      return { resolvedCount: 0, reason: 'not_mapped' };
    }

    const stationId = Number(stationRow.id);
    const updateRes = await db.execute(sql`
      UPDATE station_alerts
      SET status = 'resolved', resolved_at = NOW()
      WHERE station_id = ${stationId}
        AND alert_type = ${alertType}
        AND status IN ('open', 'acknowledged')
      RETURNING id
    `);
    const rows = ((updateRes as any).rows as any[]) ?? [];
    if (rows.length > 0) {
      logger.info('[StationAlertWriter] alerts auto-resolved', {
        kioskId, stationId, alertType, resolvedCount: rows.length,
      });
    }
    return { resolvedCount: rows.length };
  } catch (err: any) {
    logger.error('[StationAlertWriter] resolve failed', {
      kioskId, alertType, error: err?.message ?? String(err),
    });
    return { resolvedCount: 0, reason: 'db_error', detail: String(err?.message ?? err).slice(0, 200) };
  }
}

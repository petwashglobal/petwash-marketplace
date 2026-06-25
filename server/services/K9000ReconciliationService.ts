/**
 * K9000 reconciliation engine — the daily integrity diff for pre-paid Cortina
 * redemptions, per docs/design/2026-06-25-k9000-closedloop-prepaid-redemption.md.
 *
 * It writes exceptions into k9000_reconciliation_breaks (migration 0076) so
 * finance/ops can triage. Phase 1 checks what we OWN end-to-end (reservation
 * ledger ↔ bay sessions) — no external API needed, so it runs today:
 *
 *   • bay_hang               — committed, but the bay session never closed past
 *                              the ceiling (release sweep should have caught it).
 *   • commit_without_evidence— committed with NO Nayax transaction reference.
 *   • duplicate_ref          — one Nayax transaction committed on >1 reservation
 *                              (double-vend / double-debit) — CRITICAL.
 *   • stale_reservation      — reservations stuck 'reserved' long past TTL → the
 *                              release cron is not firing (meta-health check).
 *
 * Phase 2 (when Nayax Core creds land): import the Nayax scan/settlement export
 * and add settlement_without_commit (Nayax says vended, we have no commit) — the
 * one break we can't compute without their data. Left as a clearly-marked TODO so
 * it isn't silently assumed covered.
 *
 * Idempotent: an offender already represented by an OPEN break for the same
 * (date, type, entity) is not re-inserted. Never throws.
 */
import { pool } from '../db';
import { sendAlert } from '../monitoring';
import { logger } from '../lib/logger';

export interface ReconSummary {
  reconDate: string;
  inserted: number;
  byType: Record<string, number>;
  critical: number;
}

/** Insert a break only if no OPEN row already covers the same (date, type, entity). */
async function recordBreak(args: {
  reconDate: string;
  breakType: string;
  severity: 'info' | 'warning' | 'critical';
  stationId?: string | null;
  bayId?: string | null;
  nayaxRef?: string | null;
  sessionId?: string | null;
  expected?: unknown;
  observed?: unknown;
}): Promise<boolean> {
  const { reconDate, breakType, severity } = args;
  const nayaxRef = args.nayaxRef ?? null;
  const sessionId = args.sessionId ?? null;
  const dup = await pool.query(
    `SELECT 1 FROM k9000_reconciliation_breaks
      WHERE recon_date = $1 AND break_type = $2 AND status = 'open'
        AND COALESCE(nayax_ref,'') = COALESCE($3,'')
        AND COALESCE(petwash_session_id,'') = COALESCE($4,'')
      LIMIT 1`,
    [reconDate, breakType, nayaxRef, sessionId],
  );
  if ((dup.rowCount ?? 0) > 0) return false;
  await pool.query(
    `INSERT INTO k9000_reconciliation_breaks
       (recon_date, break_type, severity, station_id, bay_id, nayax_ref, petwash_session_id, expected_json, observed_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)`,
    [
      reconDate, breakType, severity,
      args.stationId ?? null, args.bayId ?? null, nayaxRef, sessionId,
      JSON.stringify(args.expected ?? {}), JSON.stringify(args.observed ?? {}),
    ],
  );
  return true;
}

/**
 * Run the daily reconciliation. `reconDate` defaults to today (server date);
 * date-scoped checks look at rows committed on that date.
 */
export async function runK9000Reconciliation(reconDate?: string): Promise<ReconSummary> {
  const date = reconDate || new Date().toISOString().slice(0, 10);
  const byType: Record<string, number> = {};
  let inserted = 0, critical = 0;
  const bump = (t: string, sev: string) => { byType[t] = (byType[t] ?? 0) + 1; inserted++; if (sev === 'critical') critical++; };

  try {
    // 1) bay_hang — committed, session still open well past the bay's ceiling.
    const hang = await pool.query(
      `SELECT r.session_id, r.station_id, r.bay_id, r.committed_at, s.status AS session_status
         FROM k9000_redemption_reservations r
         JOIN bay_sessions s ON s.id = r.session_id
         JOIN station_bays b ON b.id = r.bay_id
        WHERE r.status = 'committed'
          AND s.status IN ('pending','active','cleanup')
          AND r.committed_at < NOW() - ((COALESCE(b.max_wash_seconds, 600) + 120) || ' seconds')::interval`,
    );
    for (const row of hang.rows) {
      if (await recordBreak({
        reconDate: date, breakType: 'bay_hang', severity: 'warning',
        stationId: row.station_id, bayId: row.bay_id, sessionId: row.session_id,
        observed: { sessionStatus: row.session_status, committedAt: row.committed_at },
      })) bump('bay_hang', 'warning');
    }

    // 2) commit_without_evidence — committed today with no Nayax txn reference.
    const noEvidence = await pool.query(
      `SELECT session_id, station_id, bay_id, reservation_ref
         FROM k9000_redemption_reservations
        WHERE status = 'committed'
          AND (nayax_transaction_id IS NULL OR nayax_transaction_id = '')
          AND committed_at::date = $1`,
      [date],
    );
    for (const row of noEvidence.rows) {
      if (await recordBreak({
        reconDate: date, breakType: 'commit_without_evidence', severity: 'warning',
        stationId: row.station_id, bayId: row.bay_id, sessionId: row.session_id,
        observed: { reservationRef: row.reservation_ref },
      })) bump('commit_without_evidence', 'warning');
    }

    // 3) duplicate_ref — one Nayax transaction committed on >1 reservation.
    const dupes = await pool.query(
      `SELECT nayax_transaction_id, COUNT(*) AS c, array_agg(reservation_ref) AS refs, MIN(station_id) AS station_id
         FROM k9000_redemption_reservations
        WHERE status = 'committed' AND nayax_transaction_id IS NOT NULL AND nayax_transaction_id <> ''
        GROUP BY nayax_transaction_id
       HAVING COUNT(*) > 1`,
    );
    for (const row of dupes.rows) {
      if (await recordBreak({
        reconDate: date, breakType: 'duplicate_ref', severity: 'critical',
        stationId: row.station_id, nayaxRef: row.nayax_transaction_id,
        observed: { count: Number(row.c), reservationRefs: row.refs },
      })) bump('duplicate_ref', 'critical');
    }

    // 4) stale_reservation — stuck 'reserved' long past TTL ⇒ release cron not firing.
    const stale = await pool.query(
      `SELECT COUNT(*)::int AS c FROM k9000_redemption_reservations
        WHERE status = 'reserved' AND expires_at < NOW() - INTERVAL '15 minutes'`,
    );
    const staleCount = stale.rows[0]?.c ?? 0;
    if (staleCount > 0) {
      if (await recordBreak({
        reconDate: date, breakType: 'stale_reservation', severity: 'critical',
        observed: { staleReservedCount: staleCount, hint: 'releaseStaleCortinaReservations cron may not be running' },
      })) bump('stale_reservation', 'critical');
    }

    // TODO (Phase 2, needs Nayax Core export): settlement_without_commit —
    // Nayax reports a vend on a TerminalId with no matching committed reservation.
    // Cannot be computed without importing Nayax transaction data.

    if (inserted > 0) {
      logger.warn('[K9000Recon] breaks recorded', { date, inserted, byType, critical });
    } else {
      logger.info('[K9000Recon] clean — no new breaks', { date });
    }
    if (critical > 0) {
      await sendAlert({
        type: 'data_integrity',
        severity: 'critical',
        message: `K9000 reconciliation: ${critical} CRITICAL break(s) on ${date}`,
        details: JSON.stringify({ date, byType }),
      }).catch(() => {});
    }
  } catch (err: any) {
    logger.error('[K9000Recon] run error', { err: err?.message });
  }

  return { reconDate: date, inserted, byType, critical };
}

export default runK9000Reconciliation;

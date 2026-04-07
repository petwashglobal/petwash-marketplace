/**
 * Payout Anomaly Monitor — Admin Finance Route
 *
 * GET /api/admin/finance/payout-anomaly
 *   Returns a structured anomaly report for the super_app_payouts + bookings payout
 *   state space, grouped into canonical alert categories for Octopus / Gemini monitoring.
 *
 * All queries are read-only. Safe to call from cron, dashboards, or AI monitors.
 *
 * Alert categories:
 *   1. pending_transfer_stale   — superAppPayouts stuck in pending_transfer > 24 h / > 48 h
 *   2. booking_payout_drift     — booking.payout_status ≠ linked super_app_payouts.status
 *   3. paid_out_missing_date    — superAppPayouts.status='paid_out' but paidAt is NULL
 *   4. paid_out_missing_ref     — superAppPayouts.status='paid_out' but bankTransferReference is NULL
 *   5. failed_no_reason         — superAppPayouts.status='failed' but failureReason is NULL
 *   6. legacy_completed         — any super_app_payouts row still using the retired 'completed' status
 *   7. distribution_summary     — read-only COUNT(*) GROUP BY for prod-safety verification
 */

import { Router } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import { timingSafeAdminSecretMatch } from '../../middleware/adminAuth';

const router = Router();

function isAdmin(req: any): boolean {
  if (timingSafeAdminSecretMatch(req)) return true;
  const role = req.user?.role ?? req.user?.customClaims?.role;
  return ['super_admin', 'admin', 'ops', 'management', 'finance'].includes(role);
}

router.get('/', async (req: any, res: any) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  try {
    const [
      stale24h,
      stale48h,
      drift,
      paidOutMissingDate,
      paidOutMissingRef,
      failedNoReason,
      legacyCompleted,
      superAppDist,
      bookingDist,
    ] = await Promise.all([
      // 1a. pending_transfer older than 24 h
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at
        FROM super_app_payouts
        WHERE status = 'pending_transfer'
          AND updated_at < NOW() - INTERVAL '24 hours'
        ORDER BY updated_at ASC
        LIMIT 100
      `),

      // 1b. pending_transfer older than 48 h (higher urgency)
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at
        FROM super_app_payouts
        WHERE status = 'pending_transfer'
          AND updated_at < NOW() - INTERVAL '48 hours'
        ORDER BY updated_at ASC
        LIMIT 100
      `),

      // 2. booking / payout drift — linked rows whose payout states disagree
      db.execute(sql`
        SELECT
          sap.id              AS payout_id,
          sap.booking_id,
          sap.status          AS payout_status,
          b.payout_status     AS booking_payout_status,
          sap.updated_at      AS payout_updated_at,
          b.updated_at        AS booking_updated_at
        FROM super_app_payouts sap
        JOIN bookings b ON b.id = sap.booking_id
        WHERE sap.booking_id IS NOT NULL
          AND sap.status IS DISTINCT FROM b.payout_status
          AND sap.status NOT IN ('pending', 'in_escrow', 'released', 'processing')
        ORDER BY sap.updated_at DESC
        LIMIT 100
      `),

      // 3. paid_out without paidAt
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, updated_at
        FROM super_app_payouts
        WHERE status = 'paid_out'
          AND paid_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 100
      `),

      // 4. paid_out without bank transfer reference
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, paid_at, updated_at
        FROM super_app_payouts
        WHERE status = 'paid_out'
          AND (bank_transfer_reference IS NULL OR TRIM(bank_transfer_reference) = '')
        ORDER BY updated_at DESC
        LIMIT 100
      `),

      // 5. failed without failure reason
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, updated_at
        FROM super_app_payouts
        WHERE status = 'failed'
          AND (failure_reason IS NULL OR TRIM(failure_reason) = '')
        ORDER BY updated_at DESC
        LIMIT 100
      `),

      // 6. legacy 'completed' rows that should have been migrated to 'paid_out'
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at
        FROM super_app_payouts
        WHERE status = 'completed'
        ORDER BY updated_at DESC
        LIMIT 100
      `),

      // 7a. Distribution by status in super_app_payouts
      db.execute(sql`
        SELECT status, COUNT(*)::int AS count
        FROM super_app_payouts
        GROUP BY status
        ORDER BY count DESC
      `),

      // 7b. Distribution by payout_status in bookings
      db.execute(sql`
        SELECT payout_status, COUNT(*)::int AS count
        FROM bookings
        GROUP BY payout_status
        ORDER BY count DESC
      `),
    ]);

    const toRows = (r: any) => (r?.rows ?? []) as any[];

    const stale24hRows   = toRows(stale24h);
    const stale48hRows   = toRows(stale48h);
    const driftRows      = toRows(drift);
    const missingDate    = toRows(paidOutMissingDate);
    const missingRef     = toRows(paidOutMissingRef);
    const failedNoReas   = toRows(failedNoReason);
    const legacyRows     = toRows(legacyCompleted);
    const sapDist        = toRows(superAppDist);
    const bkDist         = toRows(bookingDist);

    // Overall severity
    const criticalCount =
      stale48hRows.length +
      driftRows.length +
      legacyRows.length +
      missingDate.length;

    const warningCount =
      stale24hRows.length +
      missingRef.length +
      failedNoReas.length;

    const overallSeverity =
      criticalCount > 0 ? 'critical' :
      warningCount  > 0 ? 'warning'  : 'ok';

    logger.info('[PayoutAnomalyMonitor] Scan complete', {
      overallSeverity,
      criticalCount,
      warningCount,
    });

    return res.json({
      success: true,
      scannedAt: new Date().toISOString(),
      overallSeverity,
      summary: {
        criticalCount,
        warningCount,
      },
      alerts: {
        pendingTransferStale24h: {
          severity: stale24hRows.length > 0 ? 'warning' : 'ok',
          count: stale24hRows.length,
          description: 'super_app_payouts stuck in pending_transfer > 24 h',
          rows: stale24hRows,
        },
        pendingTransferStale48h: {
          severity: stale48hRows.length > 0 ? 'critical' : 'ok',
          count: stale48hRows.length,
          description: 'super_app_payouts stuck in pending_transfer > 48 h (urgent)',
          rows: stale48hRows,
        },
        bookingPayoutDrift: {
          severity: driftRows.length > 0 ? 'critical' : 'ok',
          count: driftRows.length,
          description: 'bookings.payout_status does not match linked super_app_payouts.status',
          rows: driftRows,
        },
        paidOutMissingDate: {
          severity: missingDate.length > 0 ? 'critical' : 'ok',
          count: missingDate.length,
          description: 'status=paid_out but paid_at is NULL',
          rows: missingDate,
        },
        paidOutMissingRef: {
          severity: missingRef.length > 0 ? 'warning' : 'ok',
          count: missingRef.length,
          description: 'status=paid_out but bank_transfer_reference is NULL/empty',
          rows: missingRef,
        },
        failedWithNoReason: {
          severity: failedNoReas.length > 0 ? 'warning' : 'ok',
          count: failedNoReas.length,
          description: 'status=failed but failure_reason is NULL/empty',
          rows: failedNoReas,
        },
        legacyCompletedStatus: {
          severity: legacyRows.length > 0 ? 'critical' : 'ok',
          count: legacyRows.length,
          description: "status='completed' rows still exist — must be backfilled to 'paid_out'",
          backfillSql: legacyRows.length > 0
            ? "UPDATE super_app_payouts SET status = 'paid_out' WHERE status = 'completed';"
            : null,
          rows: legacyRows,
        },
      },
      distributionSummary: {
        superAppPayouts: sapDist,
        bookings:        bkDist,
      },
    });
  } catch (error: any) {
    logger.error('[PayoutAnomalyMonitor] Scan failed', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

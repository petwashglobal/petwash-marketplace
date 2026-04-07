/**
 * Payout Anomaly Monitor — Admin Finance Route
 *
 * GET /api/admin/finance/payout-anomaly
 *   Returns a structured anomaly report for the super_app_payouts + bookings payout
 *   state space, grouped into canonical alert categories for Octopus / Gemini monitoring.
 *
 * Authorization:
 *   - Global: app.use('/api/admin/', requireRole + requireStaffApproved + requireMfaEnrolled)
 *   - Local:  isAdmin() accepts ADMIN_SECRET header (service-to-service) + ops/finance Firebase roles
 *
 * All queries are read-only. Never mutates production state.
 *
 * Alert categories:
 *   1.  pendingTransferStale6h    — > 6 h  (info)
 *   2.  pendingTransferStale24h   — > 24 h (warning)
 *   3.  pendingTransferStale48h   — > 48 h (critical)
 *   4.  pendingTransferStale72h   — > 72 h (critical — ops escalation required)
 *   5.  bookingPayoutDrift        — 6 typed drift buckets (categorised mismatch direction)
 *   6.  paidOutMissingDate        — status=paid_out but paid_at IS NULL (critical)
 *   7.  paidOutMissingRef         — status=paid_out but bank_transfer_reference missing (critical — financial proof absent)
 *   8.  failedWithNoReason        — status=failed but failure_reason missing
 *   9.  orphanPayoutRows          — super_app_payouts rows with no linked bookings row
 *   10. payoutDateWithoutPaidOut  — bookings.payout_date set but payout_status != paid_out
 *   11. legacyCompleted           — retired 'completed' status still present (with advisory backfill SQL)
 *   12. distributionSummary       — read-only GROUP BY for prod verification
 */

import { Router } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import { timingSafeAdminSecretMatch } from '../../middleware/adminAuth';

const router = Router();

/**
 * Defense-in-depth role check.
 * The route is already protected by the global admin middleware chain on /api/admin/,
 * but this adds ADMIN_SECRET service-to-service access plus ops and finance Firebase roles
 * that are not included in the global requireRole('admin','management','staff') guard.
 */
function isAdmin(req: any): boolean {
  if (timingSafeAdminSecretMatch(req)) return true;
  const role = req.user?.role ?? req.user?.customClaims?.role;
  return ['super_admin', 'admin', 'ops', 'management', 'finance'].includes(role);
}

router.get('/', async (req: any, res: any) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  try {
    const [
      stale6h,
      stale24h,
      stale48h,
      stale72h,
      driftPendingVsPendingTransfer,
      driftPendingTransferVsPaidOut,
      driftPaidOutVsFailed,
      driftBookingMissingPayoutRow,
      driftPayoutRowMissingBooking,
      driftPayoutDateMismatch,
      paidOutMissingDate,
      paidOutMissingRef,
      failedNoReason,
      orphanPayoutRows,
      payoutDateWithoutPaidOut,
      legacyCompleted,
      superAppDist,
      bookingDist,
    ] = await Promise.all([

      // ── 1. Stale pending_transfer: > 6 h (info) ──────────────────────────
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at,
               EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours
        FROM super_app_payouts
        WHERE status = 'pending_transfer'
          AND updated_at < NOW() - INTERVAL '6 hours'
        ORDER BY updated_at ASC
        LIMIT 20
      `),

      // ── 2. Stale pending_transfer: > 24 h (warning) ───────────────────────
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at,
               EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours
        FROM super_app_payouts
        WHERE status = 'pending_transfer'
          AND updated_at < NOW() - INTERVAL '24 hours'
        ORDER BY updated_at ASC
        LIMIT 20
      `),

      // ── 3. Stale pending_transfer: > 48 h (critical) ──────────────────────
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at,
               EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours
        FROM super_app_payouts
        WHERE status = 'pending_transfer'
          AND updated_at < NOW() - INTERVAL '48 hours'
        ORDER BY updated_at ASC
        LIMIT 20
      `),

      // ── 4. Stale pending_transfer: > 72 h (critical — ops escalation) ─────
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at,
               EXTRACT(EPOCH FROM (NOW() - updated_at)) / 3600 AS age_hours
        FROM super_app_payouts
        WHERE status = 'pending_transfer'
          AND updated_at < NOW() - INTERVAL '72 hours'
        ORDER BY updated_at ASC
        LIMIT 20
      `),

      // ── 5a. Drift bucket: booking=pending but payout=pending_transfer ──────
      // booking row has not yet been mirrored after escrow release
      db.execute(sql`
        SELECT sap.id AS payout_id, sap.booking_id, sap.status AS payout_status,
               b.payout_status AS booking_payout_status,
               sap.updated_at AS payout_updated_at, b.updated_at AS booking_updated_at
        FROM super_app_payouts sap
        JOIN bookings b ON b.id = sap.booking_id
        WHERE sap.booking_id IS NOT NULL
          AND sap.status = 'pending_transfer'
          AND b.payout_status = 'pending'
        ORDER BY sap.updated_at DESC
        LIMIT 20
      `),

      // ── 5b. Drift bucket: booking=pending_transfer but payout=paid_out ─────
      // payout succeeded but booking row was not updated
      db.execute(sql`
        SELECT sap.id AS payout_id, sap.booking_id, sap.status AS payout_status,
               b.payout_status AS booking_payout_status,
               sap.updated_at AS payout_updated_at, b.updated_at AS booking_updated_at
        FROM super_app_payouts sap
        JOIN bookings b ON b.id = sap.booking_id
        WHERE sap.booking_id IS NOT NULL
          AND sap.status = 'paid_out'
          AND b.payout_status = 'pending_transfer'
        ORDER BY sap.updated_at DESC
        LIMIT 20
      `),

      // ── 5c. Drift bucket: booking=paid_out but payout=failed ──────────────
      // most dangerous: booking claims money arrived but payout row says it failed
      db.execute(sql`
        SELECT sap.id AS payout_id, sap.booking_id, sap.status AS payout_status,
               b.payout_status AS booking_payout_status,
               sap.updated_at AS payout_updated_at, b.updated_at AS booking_updated_at
        FROM super_app_payouts sap
        JOIN bookings b ON b.id = sap.booking_id
        WHERE sap.booking_id IS NOT NULL
          AND sap.status = 'failed'
          AND b.payout_status = 'paid_out'
        ORDER BY sap.updated_at DESC
        LIMIT 20
      `),

      // ── 5d. Drift bucket: booking row exists expecting payout but no payout row ─
      // bookings with payout_status not null/pending and no linked super_app_payouts
      db.execute(sql`
        SELECT b.id AS booking_id, b.payout_status AS booking_payout_status,
               b.payout_date, b.updated_at
        FROM bookings b
        WHERE b.payout_status IN ('pending_transfer', 'paid_out', 'failed')
          AND NOT EXISTS (
            SELECT 1 FROM super_app_payouts sap WHERE sap.booking_id = b.id
          )
        ORDER BY b.updated_at DESC
        LIMIT 20
      `),

      // ── 5e. Drift bucket: payout row exists with booking_id but booking is gone ─
      db.execute(sql`
        SELECT sap.id AS payout_id, sap.booking_id, sap.status AS payout_status,
               sap.updated_at
        FROM super_app_payouts sap
        WHERE sap.booking_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM bookings b WHERE b.id = sap.booking_id
          )
        ORDER BY sap.updated_at DESC
        LIMIT 20
      `),

      // ── 5f. Drift bucket: payout_date set on booking but payout not paid_out ─
      db.execute(sql`
        SELECT id AS booking_id, payout_status AS booking_payout_status,
               payout_date, updated_at
        FROM bookings
        WHERE payout_date IS NOT NULL
          AND payout_status IS DISTINCT FROM 'paid_out'
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 6. paid_out without paidAt (critical) ─────────────────────────────
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, updated_at
        FROM super_app_payouts
        WHERE status = 'paid_out'
          AND paid_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 7. paid_out without bank transfer reference (critical — no financial proof) ─
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, paid_at, updated_at
        FROM super_app_payouts
        WHERE status = 'paid_out'
          AND (bank_transfer_reference IS NULL OR TRIM(bank_transfer_reference) = '')
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 8. failed without failure reason ──────────────────────────────────
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, updated_at
        FROM super_app_payouts
        WHERE status = 'failed'
          AND (failure_reason IS NULL OR TRIM(failure_reason) = '')
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 9. Orphan payout rows: super_app_payouts with no booking linkage ──
      db.execute(sql`
        SELECT id, provider_id, net_amount, status, created_at, updated_at
        FROM super_app_payouts
        WHERE booking_id IS NULL
          AND status NOT IN ('pending', 'in_escrow')
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 10. bookings.payout_date set without paid_out status ───────────────
      db.execute(sql`
        SELECT id AS booking_id, payout_status, payout_date, updated_at
        FROM bookings
        WHERE payout_date IS NOT NULL
          AND payout_status IS DISTINCT FROM 'paid_out'
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 11. Legacy 'completed' status (must be backfilled to 'paid_out') ──
      db.execute(sql`
        SELECT id, booking_id, provider_id, net_amount, created_at, updated_at
        FROM super_app_payouts
        WHERE status = 'completed'
        ORDER BY updated_at DESC
        LIMIT 20
      `),

      // ── 12a. Distribution by status in super_app_payouts ──────────────────
      db.execute(sql`
        SELECT status, COUNT(*)::int AS count
        FROM super_app_payouts
        GROUP BY status
        ORDER BY count DESC
      `),

      // ── 12b. Distribution by payout_status in bookings ────────────────────
      db.execute(sql`
        SELECT payout_status, COUNT(*)::int AS count
        FROM bookings
        GROUP BY payout_status
        ORDER BY count DESC
      `),
    ]);

    const toRows = (r: any) => (r?.rows ?? []) as any[];

    const stale6hRows    = toRows(stale6h);
    const stale24hRows   = toRows(stale24h);
    const stale48hRows   = toRows(stale48h);
    const stale72hRows   = toRows(stale72h);

    const driftPendingVsPT     = toRows(driftPendingVsPendingTransfer);
    const driftPTVsPaid        = toRows(driftPendingTransferVsPaidOut);
    const driftPaidVsFailed    = toRows(driftPaidOutVsFailed);
    const driftBkMissingPayout = toRows(driftBookingMissingPayoutRow);
    const driftPayoutMissingBk = toRows(driftPayoutRowMissingBooking);
    const driftDateMismatch    = toRows(driftPayoutDateMismatch);

    const missingDate          = toRows(paidOutMissingDate);
    const missingRef           = toRows(paidOutMissingRef);
    const failedNoReas         = toRows(failedNoReason);
    const orphans              = toRows(orphanPayoutRows);
    const dateWithoutPaidOut   = toRows(payoutDateWithoutPaidOut);
    const legacyRows           = toRows(legacyCompleted);
    const sapDist              = toRows(superAppDist);
    const bkDist               = toRows(bookingDist);

    const totalDriftRows =
      driftPendingVsPT.length + driftPTVsPaid.length + driftPaidVsFailed.length +
      driftBkMissingPayout.length + driftPayoutMissingBk.length + driftDateMismatch.length;

    // Critical: any of these present means financial truth is broken
    const criticalCount =
      stale48hRows.length +
      stale72hRows.length +
      driftPaidVsFailed.length +        // booking claims paid, payout says failed — most dangerous
      driftPTVsPaid.length +            // booking not updated after successful payout
      missingDate.length +              // paid_out with no timestamp
      missingRef.length +               // paid_out with no bank proof (financial proof missing)
      legacyRows.length +               // retired status still present
      dateWithoutPaidOut.length;        // payoutDate set without paid_out

    // Warning: degraded truth — ops action needed but not an immediate financial lie
    const warningCount =
      stale24hRows.length +
      driftPendingVsPT.length +
      driftBkMissingPayout.length +
      driftPayoutMissingBk.length +
      failedNoReas.length +
      orphans.length;

    const overallSeverity =
      criticalCount > 0 ? 'critical' :
      warningCount  > 0 ? 'warning'  : 'ok';

    logger.info('[PayoutAnomalyMonitor] Scan complete', {
      overallSeverity, criticalCount, warningCount, totalDriftRows,
    });

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      scannedAt: new Date().toISOString(),
      overallSeverity,
      summary: {
        criticalCount,
        warningCount,
        totalDriftRows,
      },

      // ── Top-level shape consumed by Octopus PayoutHealthPanel + Gemini ──────
      data: {
        generatedAt: new Date().toISOString(),
        stalePendingTransfer: {
          severity: stale6hRows.length > 0 ? (stale48hRows.length > 0 ? 'critical' : 'warning') : 'ok',
          tiers: [
            { label: '>6h', severity: stale6hRows.length > 0 ? 'info' : 'ok', count: stale6hRows.length },
            { label: '>24h', severity: stale24hRows.length > 0 ? 'warning' : 'ok', count: stale24hRows.length },
            { label: '>48h', severity: stale48hRows.length > 0 ? 'critical' : 'ok', count: stale48hRows.length },
            { label: '>72h', severity: stale72hRows.length > 0 ? 'critical' : 'ok', count: stale72hRows.length, escalationRequired: stale72hRows.length > 0 },
          ],
        },
        bookingPayoutDrift: {
          severity: totalDriftRows > 0 ? 'critical' : 'ok',
          totalDriftRows,
          buckets: [
            { type: 'pending_vs_pending_transfer', count: driftPendingVsPT.length, severity: driftPendingVsPT.length > 0 ? 'warning' : 'ok' },
            { type: 'pending_transfer_vs_paid_out', count: driftPTVsPaid.length, severity: driftPTVsPaid.length > 0 ? 'critical' : 'ok' },
            { type: 'paid_out_vs_failed', count: driftPaidVsFailed.length, severity: driftPaidVsFailed.length > 0 ? 'critical' : 'ok' },
            { type: 'booking_missing_payout_row', count: driftBkMissingPayout.length, severity: driftBkMissingPayout.length > 0 ? 'warning' : 'ok' },
            { type: 'payout_row_missing_booking', count: driftPayoutMissingBk.length, severity: driftPayoutMissingBk.length > 0 ? 'critical' : 'ok' },
            { type: 'payout_date_mismatch', count: driftDateMismatch.length, severity: driftDateMismatch.length > 0 ? 'critical' : 'ok' },
          ],
        },
        paidOutMissingRef:      { severity: missingRef.length > 0 ? 'critical' : 'ok', count: missingRef.length },
        paidOutMissingPaidAt:   { severity: missingDate.length > 0 ? 'critical' : 'ok', count: missingDate.length },
        failedWithNoReason:     { severity: failedNoReas.length > 0 ? 'warning' : 'ok', count: failedNoReas.length },
        orphanPayoutRows:       { severity: orphans.length > 0 ? 'warning' : 'ok', count: orphans.length },
        payoutDateWithoutPaidOut: { severity: dateWithoutPaidOut.length > 0 ? 'critical' : 'ok', count: dateWithoutPaidOut.length },
      },
      alerts: {

        // ── Stale pending_transfer ──────────────────────────────────────────
        pendingTransferStale6h: {
          severity: stale6hRows.length > 0 ? 'info' : 'ok',
          count: stale6hRows.length,
          description: 'pending_transfer rows older than 6 h — monitor for progression',
          rows: stale6hRows,
        },
        pendingTransferStale24h: {
          severity: stale24hRows.length > 0 ? 'warning' : 'ok',
          count: stale24hRows.length,
          description: 'pending_transfer rows older than 24 h — ops review required',
          rows: stale24hRows,
        },
        pendingTransferStale48h: {
          severity: stale48hRows.length > 0 ? 'critical' : 'ok',
          count: stale48hRows.length,
          description: 'pending_transfer rows older than 48 h — immediate ops action required',
          rows: stale48hRows,
        },
        pendingTransferStale72h: {
          severity: stale72hRows.length > 0 ? 'critical' : 'ok',
          count: stale72hRows.length,
          description: 'pending_transfer rows older than 72 h — ops escalation required',
          escalationRequired: stale72hRows.length > 0,
          rows: stale72hRows,
        },

        // ── Booking / payout drift (categorised by direction) ───────────────
        bookingPayoutDrift: {
          severity: totalDriftRows > 0 ? 'critical' : 'ok',
          totalCount: totalDriftRows,
          description: 'Mismatch between bookings.payout_status and super_app_payouts.status',
          buckets: {
            pendingVsPendingTransfer: {
              count: driftPendingVsPT.length,
              description: 'booking=pending but payout=pending_transfer (booking not yet mirrored)',
              rows: driftPendingVsPT,
            },
            pendingTransferVsPaidOut: {
              count: driftPTVsPaid.length,
              description: 'booking=pending_transfer but payout=paid_out (booking stuck after successful transfer)',
              rows: driftPTVsPaid,
            },
            paidOutVsFailed: {
              count: driftPaidVsFailed.length,
              description: 'booking=paid_out but payout=failed — CRITICAL: booking claims money arrived but payout failed',
              rows: driftPaidVsFailed,
            },
            bookingMissingPayoutRow: {
              count: driftBkMissingPayout.length,
              description: 'booking expects payout (non-pending status) but no super_app_payouts row exists',
              rows: driftBkMissingPayout,
            },
            payoutRowMissingBooking: {
              count: driftPayoutMissingBk.length,
              description: 'super_app_payouts.booking_id references a booking that no longer exists',
              rows: driftPayoutMissingBk,
            },
            payoutDateMismatch: {
              count: driftDateMismatch.length,
              description: 'bookings.payout_date set but payout_status is not paid_out',
              rows: driftDateMismatch,
            },
          },
        },

        // ── Integrity checks on paid_out rows ───────────────────────────────
        paidOutMissingDate: {
          severity: missingDate.length > 0 ? 'critical' : 'ok',
          count: missingDate.length,
          description: 'status=paid_out but paid_at is NULL — timestamp of transfer is missing',
          rows: missingDate,
        },
        paidOutMissingRef: {
          severity: missingRef.length > 0 ? 'critical' : 'ok',
          count: missingRef.length,
          description: 'status=paid_out but bank_transfer_reference is NULL/empty — financial proof of transfer is absent',
          rows: missingRef,
        },

        // ── Failed payout without diagnostics ───────────────────────────────
        failedWithNoReason: {
          severity: failedNoReas.length > 0 ? 'warning' : 'ok',
          count: failedNoReas.length,
          description: 'status=failed but failure_reason is NULL/empty — ops cannot diagnose or retry',
          rows: failedNoReas,
        },

        // ── Orphan and date anomalies ────────────────────────────────────────
        orphanPayoutRows: {
          severity: orphans.length > 0 ? 'warning' : 'ok',
          count: orphans.length,
          description: 'super_app_payouts rows not linked to any booking (booking_id IS NULL) in non-initial statuses',
          rows: orphans,
        },
        payoutDateWithoutPaidOut: {
          severity: dateWithoutPaidOut.length > 0 ? 'critical' : 'ok',
          count: dateWithoutPaidOut.length,
          description: 'bookings.payout_date is set but payout_status is not paid_out — date was written before money moved',
          rows: dateWithoutPaidOut,
        },

        // ── Legacy retired status ────────────────────────────────────────────
        legacyCompletedStatus: {
          severity: legacyRows.length > 0 ? 'critical' : 'ok',
          count: legacyRows.length,
          description: "status='completed' rows exist — retired payout vocabulary, must be backfilled",
          // Advisory only — never auto-executed. Confirm rows truly represent successful transfers before running.
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

      // ── Ops runbook — advisory only, never auto-executed ─────────────────
      runbook: {
        stalePendingTransfer: {
          meaning: 'A payout was initiated but the bank transfer has not confirmed within the expected window.',
          likelyCauses: ['Nayax/bank integration blocked', 'provider bank details invalid', 'manual retry required'],
          owner: 'finance-ops',
          safePath: 'Check Nayax dashboard for transfer status. If blocked, mark failed and notify provider. Do not auto-retry.',
          autoMutationAllowed: false,
        },
        bookingPayoutDrift: {
          meaning: 'The payout_status on a booking row does not match the status on the linked super_app_payouts row.',
          likelyCauses: ['Partial write failure', 'race condition during payout release', 'manual DB edit on one table only'],
          owner: 'engineering + finance-ops',
          safePath: 'Review both rows. Identify which side is authoritative. Apply manual correction via admin tool after confirmation.',
          autoMutationAllowed: false,
        },
        paidOutMissingRef: {
          meaning: 'A payout row claims success (paid_out) but has no bank_transfer_reference — financial proof of transfer is absent.',
          likelyCauses: ['Payout service wrote paid_out before receiving transfer ref', 'integration returned success without ref', 'legacy import'],
          owner: 'finance-ops (critical — SLA breach risk)',
          safePath: 'Cross-reference Nayax/bank statement by booking ID and amount. Backfill reference if found. If not found, escalate to bank reconciliation team.',
          autoMutationAllowed: false,
        },
        paidOutMissingPaidAt: {
          meaning: 'A payout row claims success (paid_out) but has no paid_at timestamp — transfer time is unknown.',
          likelyCauses: ['Service bug — wrote status without timestamp', 'legacy migration missing date'],
          owner: 'engineering',
          safePath: 'Check transaction logs for the booking ID to recover the actual transfer timestamp. Backfill if recoverable.',
          autoMutationAllowed: false,
        },
        failedWithNoReason: {
          meaning: 'A payout was marked failed but no failure_reason was recorded — ops cannot diagnose or retry.',
          likelyCauses: ['Error caught but not forwarded to DB', 'partial write', 'integration returned generic failure'],
          owner: 'engineering',
          safePath: 'Check server logs around the failed_at timestamp. Populate failure_reason manually. Decide retry vs. provider notification.',
          autoMutationAllowed: false,
        },
        orphanPayoutRows: {
          meaning: 'super_app_payouts rows exist with no linked booking — reconciliation impossible without booking context.',
          likelyCauses: ['Booking deleted after payout written', 'payout written with wrong booking_id', 'test data not cleaned up'],
          owner: 'engineering + finance-ops',
          safePath: 'Verify by provider_id and amount against booking history. Archive or link to correct booking. Do not delete without audit trail.',
          autoMutationAllowed: false,
        },
        payoutDateWithoutPaidOut: {
          meaning: 'bookings.payout_date is set but payout_status is not paid_out — data is semantically broken.',
          likelyCauses: ['Date written optimistically before transfer confirmed', 'race condition', 'manual field edit'],
          owner: 'engineering',
          safePath: 'Null out payout_date if transfer not confirmed, OR update status to paid_out if transfer is confirmed. Never leave inconsistent.',
          autoMutationAllowed: false,
        },
        legacyCompletedStatus: {
          meaning: "status='completed' is the retired payout vocabulary. Canonical success state is 'paid_out'.",
          likelyCauses: ['Pre-migration rows', 'backfill not yet run', 'legacy import path'],
          owner: 'engineering (data migration)',
          safePath: 'Run advisory SQL only after manual review confirms rows are genuine paid transfers. Never bulk-update without audit.',
          backfillSql: "UPDATE super_app_payouts SET status = 'paid_out' WHERE status = 'completed'; -- advisory only",
          autoMutationAllowed: false,
        },
      },
    });
  } catch (error: any) {
    logger.error('[PayoutAnomalyMonitor] Scan failed', { error: error.message });
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

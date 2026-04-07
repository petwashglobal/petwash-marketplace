/**
 * Payout Repair Tools — Admin Finance Route
 *
 * GET /api/admin/finance/payout-repair/affected-rows?anomaly=<type>&limit=<n>
 *   Returns full affected rows with all IDs for a given anomaly type.
 *   Read-only. Never mutates production state.
 *
 * This is a SEPARATE route from the anomaly monitor.
 * The anomaly monitor detects and summarizes.
 * This route provides full row detail for approved remediation by finance / ops.
 *
 * Anomaly types:
 *   stale_pending_transfer_72h   — >72h, escalation required
 *   stale_pending_transfer_48h   — >48h, critical
 *   stale_pending_transfer_24h   — >24h, warning
 *   drift_pending_vs_pending_transfer
 *   drift_pending_transfer_vs_paid_out
 *   drift_paid_out_vs_failed          — most dangerous
 *   drift_booking_missing_payout_row
 *   drift_payout_row_missing_booking
 *   drift_payout_date_mismatch
 *   paid_out_missing_ref
 *   paid_out_missing_paid_at
 *   failed_no_reason
 *   orphan_payout_rows
 *   payout_date_without_paid_out
 *   legacy_completed
 *
 * Authorization:
 *   - Global: app.use('/api/admin/', requireRole + requireStaffApproved + requireMfaEnrolled)
 *   - Local: isAdmin() also accepts ADMIN_SECRET header (service-to-service) + ops/finance roles
 *
 * IMPORTANT: This route is strictly read-only.
 *   Any repair must go through a human-approved mutation endpoint (not this diagnostic route).
 */

import { Router } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { logger } from '../../lib/logger';
import { timingSafeAdminSecretMatch } from '../../middleware/adminAuth';
import { PAYOUT_RISK_POLICY } from './payout-risk-policy';

const router = Router();

function isAdmin(req: any): boolean {
  if (timingSafeAdminSecretMatch(req)) return true;
  const role = req.user?.role ?? req.user?.customClaims?.role;
  return ['super_admin', 'admin', 'ops', 'management', 'finance'].includes(role);
}

const VALID_ANOMALY_TYPES = new Set([
  'stale_pending_transfer_6h',
  'stale_pending_transfer_72h',
  'stale_pending_transfer_48h',
  'stale_pending_transfer_24h',
  'drift_pending_vs_pending_transfer',
  'drift_pending_transfer_vs_paid_out',
  'drift_paid_out_vs_failed',
  'drift_booking_missing_payout_row',
  'drift_payout_row_missing_booking',
  'drift_payout_date_mismatch',
  'paid_out_missing_ref',
  'paid_out_missing_paid_at',
  'failed_no_reason',
  'orphan_payout_rows',
  'payout_date_without_paid_out',
  'legacy_completed',
]);

const RUNBOOK: Record<string, { meaning: string; owner: string; safePath: string; runbookAction: string }> = {
  stale_pending_transfer_6h: {
    meaning: 'Bank transfer has been queued for over 6 hours — early monitoring window.',
    owner: 'Finance ops',
    safePath: 'Check Nayax dashboard for transfer status. No action required unless count grows or transfer is large.',
    runbookAction: 'MONITOR: Check Nayax dashboard. No action needed unless amount is large or count is growing rapidly.',
  },
  stale_pending_transfer_72h: {
    meaning: 'Bank transfer has been queued for over 72 hours without confirmation.',
    owner: 'Finance ops',
    safePath: 'Manually verify transfer status with bank. If confirmed lost: create repair record via /api/admin/finance/payout-repair/apply (human-approved).',
    runbookAction: 'ESCALATE: Verify transfer status with bank. Raise finance exception if confirmed lost.',
  },
  stale_pending_transfer_48h: {
    meaning: 'Bank transfer queued for over 48 hours — investigate before escalation window.',
    owner: 'Finance ops',
    safePath: 'Check Nayax dashboard for transfer status. Escalate if no update by 72h.',
    runbookAction: 'INVESTIGATE: Check Nayax dashboard. Log status. Escalate by 72h window.',
  },
  stale_pending_transfer_24h: {
    meaning: 'Bank transfer queued for over 24 hours — normal monitoring window.',
    owner: 'Ops',
    safePath: 'Check Nayax dashboard. No action required unless count grows rapidly.',
    runbookAction: 'MONITOR: Check Nayax dashboard. No immediate action unless count grows rapidly.',
  },
  drift_pending_vs_pending_transfer: {
    meaning: 'super_app_payouts says pending_transfer but booking row still shows pending — sync lag.',
    owner: 'Engineering',
    safePath: 'Verify BookingLifecycleService ran. If booking row is stale: apply booking mirror update via repair tool.',
    runbookAction: 'SYNC: Verify BookingLifecycleService ran. Apply booking mirror update if stale.',
  },
  drift_pending_transfer_vs_paid_out: {
    meaning: 'super_app_payouts shows paid_out but booking row still shows pending_transfer — booking not updated after payout succeeded.',
    owner: 'Engineering',
    safePath: 'Verify BookingLifecycleService sync. Update booking.payout_status to paid_out after manual verification.',
    runbookAction: 'SYNC: Verify payout confirmed. Update booking.payout_status to paid_out after verification.',
  },
  drift_paid_out_vs_failed: {
    meaning: 'CRITICAL: booking claims paid_out but payout row says failed — booking shows false success.',
    owner: 'Finance + Engineering',
    safePath: 'Do NOT update booking silently. Investigate payout row failure reason. Decide whether money actually moved. Create formal finance exception record.',
    runbookAction: 'CRITICAL: Do NOT auto-fix. Investigate failure_reason. Create formal finance exception record.',
  },
  drift_booking_missing_payout_row: {
    meaning: 'Booking has non-pending payout_status but no linked super_app_payouts row.',
    owner: 'Engineering',
    safePath: 'Check if payout was processed outside the standard flow. Create missing payout row if confirmed.',
    runbookAction: 'INVESTIGATE: Check payout processing logs. Create missing payout row if confirmed.',
  },
  drift_payout_row_missing_booking: {
    meaning: 'super_app_payouts row has a booking_id but no booking row exists — orphan with stale reference.',
    owner: 'Engineering',
    safePath: 'Check if booking was deleted. If payout was processed: retain payout row for audit. Do not delete.',
    runbookAction: 'AUDIT: Do not delete payout row. Retain for audit trail. Investigate if booking was deleted.',
  },
  drift_payout_date_mismatch: {
    meaning: 'Booking payout_date is set but payout_status does not match paid_out — semantically broken.',
    owner: 'Engineering',
    safePath: 'Verify which is the canonical truth: the date or the status. Correct the non-canonical field.',
    runbookAction: 'CORRECT: Verify canonical truth (date vs status). Correct non-canonical field.',
  },
  paid_out_missing_ref: {
    meaning: 'CRITICAL: payout marked paid_out but no bank_transfer_reference — no proof of transfer.',
    owner: 'Finance',
    safePath: 'Retrieve reference from Nayax or bank records. Update payout row with verified reference.',
    runbookAction: 'CRITICAL: Retrieve reference from Nayax/bank. Update payout row with verified reference.',
  },
  paid_out_missing_paid_at: {
    meaning: 'Payout status is paid_out but paid_at timestamp is NULL.',
    owner: 'Engineering',
    safePath: 'Backfill paid_at from updated_at if bank transfer reference confirms payment. Human approval required.',
    runbookAction: 'BACKFILL: Set paid_at from updated_at only after verifying bank reference confirms payment.',
  },
  failed_no_reason: {
    meaning: 'Payout marked failed but failure_reason is missing — blind failure.',
    owner: 'Engineering',
    safePath: 'Check logs for the payout ID at the time of failure. Backfill failure_reason for audit trail.',
    runbookAction: 'DOCUMENT: Check logs for failure. Backfill failure_reason for audit trail.',
  },
  orphan_payout_rows: {
    meaning: 'super_app_payouts rows with no booking linkage in a non-initial state.',
    owner: 'Finance + Engineering',
    safePath: 'Investigate source. Do not delete — retain for audit. Link to booking if recoverable.',
    runbookAction: 'AUDIT: Do not delete. Link to booking if recoverable. Retain for finance audit.',
  },
  payout_date_without_paid_out: {
    meaning: 'bookings.payout_date is set but payout_status is not paid_out — data contradiction.',
    owner: 'Engineering',
    safePath: 'Verify with payout row truth. If payout succeeded: update booking status. If not: clear payout_date.',
    runbookAction: 'CORRECT: If payout succeeded, update booking status. If not, clear payout_date.',
  },
  legacy_completed: {
    meaning: "super_app_payouts rows with status='completed' — retired vocabulary.",
    owner: 'Engineering',
    safePath: "Backfill status to 'paid_out' after confirming each row represents a successful payment. Batch SQL allowed with DBA approval.",
    runbookAction: "BACKFILL: Update status to 'paid_out' after confirming success. Batch SQL with DBA approval.",
  },
};

/**
 * GET /api/admin/finance/payout-repair/affected-rows
 * Returns full rows for a given anomaly type (read-only drill-down).
 */
router.get('/affected-rows', async (req: any, res: any) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const anomaly = req.query.anomaly as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 200);
  const page   = Math.max(parseInt((req.query.page as string) ?? '1', 10), 1);
  const offset = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string | undefined) ?? 'age';        // 'age' | 'amount'
  const platformId   = req.query.platformId as string | undefined;
  const dateFrom     = req.query.dateFrom as string | undefined;           // ISO date string
  const dateTo       = req.query.dateTo as string | undefined;             // ISO date string

  if (!anomaly || !VALID_ANOMALY_TYPES.has(anomaly)) {
    return res.status(400).json({
      error: 'Invalid or missing anomaly type',
      validTypes: Array.from(VALID_ANOMALY_TYPES),
      autoMutationAllowed: false,
    });
  }

  logger.info('[PayoutRepairTools] affected-rows requested', {
    anomaly, limit, requestedBy: req.user?.id ?? 'service',
  });

  try {
    let rows: any[] = [];
    let description = '';

    switch (anomaly) {
      case 'stale_pending_transfer_6h': {
        description = 'pending_transfer rows older than 6 h — early monitoring window';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount, sap.status,
                 sap.paid_at, sap.created_at, sap.updated_at,
                 b.platform_id AS platform_id, b.payout_date AS payout_date,
                 ROUND(EXTRACT(EPOCH FROM (NOW() - sap.updated_at)) / 3600, 1) AS age_hours
          FROM super_app_payouts sap
          LEFT JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.status = 'pending_transfer' AND sap.updated_at < NOW() - INTERVAL '6 hours'
          ORDER BY sap.updated_at ASC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'stale_pending_transfer_72h': {
        description = 'pending_transfer rows older than 72 h — ops escalation required';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount, sap.status,
                 sap.paid_at, sap.created_at, sap.updated_at,
                 b.platform_id AS platform_id, b.payout_date AS payout_date,
                 ROUND(EXTRACT(EPOCH FROM (NOW() - sap.updated_at)) / 3600, 1) AS age_hours
          FROM super_app_payouts sap
          LEFT JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.status = 'pending_transfer' AND sap.updated_at < NOW() - INTERVAL '72 hours'
          ORDER BY sap.updated_at ASC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'stale_pending_transfer_48h': {
        description = 'pending_transfer rows older than 48 h';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount, sap.status,
                 sap.paid_at, sap.created_at, sap.updated_at,
                 b.platform_id AS platform_id, b.payout_date AS payout_date,
                 ROUND(EXTRACT(EPOCH FROM (NOW() - sap.updated_at)) / 3600, 1) AS age_hours
          FROM super_app_payouts sap
          LEFT JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.status = 'pending_transfer' AND sap.updated_at < NOW() - INTERVAL '48 hours'
          ORDER BY sap.updated_at ASC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'stale_pending_transfer_24h': {
        description = 'pending_transfer rows older than 24 h';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount, sap.status,
                 sap.paid_at, sap.created_at, sap.updated_at,
                 b.platform_id AS platform_id, b.payout_date AS payout_date,
                 ROUND(EXTRACT(EPOCH FROM (NOW() - sap.updated_at)) / 3600, 1) AS age_hours
          FROM super_app_payouts sap
          LEFT JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.status = 'pending_transfer' AND sap.updated_at < NOW() - INTERVAL '24 hours'
          ORDER BY sap.updated_at ASC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'drift_pending_vs_pending_transfer': {
        description = 'booking=pending but super_app_payouts=pending_transfer';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount,
                 sap.status AS payout_status, b.payout_status AS booking_payout_status,
                 sap.updated_at AS payout_updated_at, b.updated_at AS booking_updated_at
          FROM super_app_payouts sap
          JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.booking_id IS NOT NULL AND sap.status = 'pending_transfer' AND b.payout_status = 'pending'
          ORDER BY sap.updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'drift_pending_transfer_vs_paid_out': {
        description = 'super_app_payouts=paid_out but booking=pending_transfer';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount,
                 sap.status AS payout_status, b.payout_status AS booking_payout_status,
                 sap.paid_at, sap.bank_transfer_reference,
                 sap.updated_at AS payout_updated_at, b.updated_at AS booking_updated_at
          FROM super_app_payouts sap
          JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.booking_id IS NOT NULL AND sap.status = 'paid_out' AND b.payout_status = 'pending_transfer'
          ORDER BY sap.updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'drift_paid_out_vs_failed': {
        description = 'CRITICAL: booking=paid_out but super_app_payouts=failed';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount,
                 sap.status AS payout_status, b.payout_status AS booking_payout_status,
                 sap.failure_reason, sap.updated_at AS payout_updated_at, b.updated_at AS booking_updated_at
          FROM super_app_payouts sap
          JOIN bookings b ON b.id = sap.booking_id
          WHERE sap.booking_id IS NOT NULL AND sap.status = 'failed' AND b.payout_status = 'paid_out'
          ORDER BY sap.updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'drift_booking_missing_payout_row': {
        description = 'booking has non-pending payout_status but no super_app_payouts row';
        const r = await db.execute(sql`
          SELECT b.id AS booking_id, b.payout_status AS booking_payout_status,
                 b.payout_date, b.updated_at,
                 b.provider_id, b.provider_payout AS net_amount
          FROM bookings b
          WHERE b.payout_status IN ('pending_transfer', 'paid_out', 'failed')
            AND NOT EXISTS (SELECT 1 FROM super_app_payouts sap WHERE sap.booking_id = b.id)
          ORDER BY b.updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'drift_payout_row_missing_booking': {
        description = 'super_app_payouts has booking_id but booking row does not exist';
        const r = await db.execute(sql`
          SELECT sap.id AS payout_id, sap.booking_id, sap.provider_id, sap.net_amount,
                 sap.status AS payout_status, sap.updated_at
          FROM super_app_payouts sap
          WHERE sap.booking_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = sap.booking_id)
          ORDER BY sap.updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'drift_payout_date_mismatch': {
        description = 'booking payout_date set but payout_status does not match paid_out';
        const r = await db.execute(sql`
          SELECT b.id AS booking_id, b.payout_status AS booking_payout_status,
                 b.payout_date, b.updated_at,
                 b.provider_id, b.provider_payout AS net_amount
          FROM bookings b
          WHERE b.payout_date IS NOT NULL AND b.payout_status IS DISTINCT FROM 'paid_out'
          ORDER BY b.updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'paid_out_missing_ref': {
        description = 'CRITICAL: paid_out with no bank_transfer_reference';
        const r = await db.execute(sql`
          SELECT id AS payout_id, booking_id, provider_id, net_amount, paid_at, updated_at
          FROM super_app_payouts
          WHERE status = 'paid_out'
            AND (bank_transfer_reference IS NULL OR TRIM(bank_transfer_reference) = '')
          ORDER BY updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'paid_out_missing_paid_at': {
        description = 'paid_out with NULL paid_at timestamp';
        const r = await db.execute(sql`
          SELECT id AS payout_id, booking_id, provider_id, net_amount, updated_at
          FROM super_app_payouts
          WHERE status = 'paid_out' AND paid_at IS NULL
          ORDER BY updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'failed_no_reason': {
        description = 'failed payout rows with no failure_reason recorded';
        const r = await db.execute(sql`
          SELECT id AS payout_id, booking_id, provider_id, net_amount, updated_at
          FROM super_app_payouts
          WHERE status = 'failed'
            AND (failure_reason IS NULL OR TRIM(failure_reason) = '')
          ORDER BY updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'orphan_payout_rows': {
        description = 'super_app_payouts rows with no booking linkage in a non-initial state';
        const r = await db.execute(sql`
          SELECT id AS payout_id, provider_id, net_amount, status, created_at, updated_at
          FROM super_app_payouts
          WHERE booking_id IS NULL AND status NOT IN ('pending', 'in_escrow')
          ORDER BY updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'payout_date_without_paid_out': {
        description = 'bookings.payout_date set but payout_status != paid_out';
        const r = await db.execute(sql`
          SELECT id AS booking_id, payout_status, payout_date, updated_at,
                 provider_id, provider_payout AS net_amount
          FROM bookings
          WHERE payout_date IS NOT NULL AND payout_status IS DISTINCT FROM 'paid_out'
          ORDER BY updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
      case 'legacy_completed': {
        description = "Retired 'completed' status still present in super_app_payouts";
        const r = await db.execute(sql`
          SELECT id AS payout_id, booking_id, provider_id, net_amount, status, created_at, updated_at
          FROM super_app_payouts
          WHERE status = 'completed'
          ORDER BY updated_at DESC LIMIT ${limit}
        `);
        rows = r.rows ?? [];
        break;
      }
    }

    const runbookEntry = RUNBOOK[anomaly];

    // CSV export: ?format=csv returns RFC 4180-compliant CSV for finance ops tooling.
    // Columns are ordered for downstream reconciliation (finance-grade export shape).
    const format = req.query.format as string | undefined;
    if (format === 'csv') {
      const dateLabel = new Date().toISOString().slice(0, 10);
      res.set('Content-Type', 'text/csv');
      res.set('Content-Disposition', `attachment; filename="payout-repair-${anomaly}-${dateLabel}.csv"`);
      res.set('X-Payout-Repair-AutoMutation', 'false');
      if (rows.length === 0) {
        return res.send('anomalyType,severity,payoutId,bookingId,providerUid,platformId,amountILS,payoutStatus,payoutDate,paidAt,updatedAt,ageHours,recommendedAction\n');
      }
      const runbookEntry2 = RUNBOOK[anomaly];
      const severityForCsv = (() => {
        const c72 = anomaly === 'stale_pending_transfer_72h' || anomaly === 'paid_out_missing_ref' || anomaly === 'paid_out_missing_paid_at' || anomaly === 'payout_date_without_paid_out';
        const c48 = anomaly === 'stale_pending_transfer_48h';
        if (c72 || c48) return 'critical';
        if (anomaly === 'stale_pending_transfer_24h') return 'warning';
        return 'warning';
      })();
      const escape = (v: any): string => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const financeHeaders = [
        'anomalyType', 'severity', 'payoutId', 'bookingId', 'providerUid', 'platformId',
        'amountILS', 'payoutStatus', 'payoutDate', 'paidAt', 'updatedAt', 'ageHours', 'recommendedAction',
      ];
      const csvRows = rows.map(row => [
        escape(anomaly),
        escape(severityForCsv),
        escape(row.payout_id ?? row.id ?? ''),
        escape(row.booking_id ?? ''),
        escape(row.provider_id ?? ''),
        escape(row.platform_id ?? ''),
        escape(row.net_amount ?? ''),
        escape(row.status ?? row.payout_status ?? ''),
        escape(row.payout_date ?? row.payoutDate ?? ''),
        escape(row.paid_at ?? ''),
        escape(row.updated_at ?? row.updatedAt ?? ''),
        escape(row.age_hours ?? ''),
        escape(runbookEntry2?.runbookAction ?? ''),
      ].join(','));
      return res.send([financeHeaders.join(','), ...csvRows].join('\n'));
    }

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      anomaly,
      description,
      count: rows.length,
      page,
      limit,
      rows,
      appliedFilters: {
        sortBy,
        platformId: platformId ?? null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
      runbook: runbookEntry,
      runbookAction: runbookEntry?.runbookAction ?? null,
      csvExportUrl: `/api/admin/finance/payout-repair/affected-rows?anomaly=${anomaly}&format=csv`,
      autoMutationAllowed: false,
      warning: 'This route is read-only. Any repair requires human approval and a separate mutation endpoint.',
    });

  } catch (error: any) {
    logger.error('[PayoutRepairTools] affected-rows query failed', { anomaly, error: error.message });
    return res.status(500).json({ error: 'Query failed', message: error.message });
  }
});

export default router;

/**
 * server/routes/booking-trace.ts
 * Phase 12.7 — Booking Trace & Dispute Resolution Layer
 *
 * Mounted at /api/booking-trace
 *
 * GET  /:bookingId               — Full trace: booking + station + customer +
 *                                  status history + settlement + dispute + refund + audit (T31)
 * POST /:bookingId/dispute/action — Dispute resolution actions (T34)
 *
 * Visibility rules — T36:
 *   admin (x-admin-secret or decoded.admin) → all bookings
 *   franchise_owner  → bookings where station belongs to their franchise
 *   station_operator → bookings where station_id matches their assignment
 *
 * Settlement remains the money truth. This route adds the explanation layer.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { timingSafeAdminSecretMatch } from '../middleware/adminAuth';

const router = Router();

const IL_TZ      = 'Asia/Jerusalem';
const ADMIN_SEC  = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

type CallerRole = 'admin' | 'franchise_owner' | 'station_operator';

const toILS  = (v: unknown): number => v != null && v !== '' ? Math.round(Number(v)) / 100 : 0;
const toNum  = (v: unknown): number  => Number(v ?? 0);
const toStr  = (v: unknown): string  => v != null ? String(v) : '';
const toDate = (v: unknown): string | null => v ? (v as Date).toISOString() : null;

// ─── Auth + Visibility Middleware ─────────────────────────────────────────────

/**
 * requireTraceViewer
 *
 * Verifies the caller is allowed to see this booking.
 * Sets (req as any).callerRole and .callerUid for downstream handlers.
 */
async function requireTraceViewer(req: Request, res: Response, next: NextFunction) {
  try {
    const bookingId = req.params.bookingId;

    // ── Admin bypass via header secret ──────────────────────────────────────
    if (timingSafeAdminSecretMatch(req)) {
      (req as any).callerRole = 'admin' as CallerRole;
      (req as any).callerUid  = null;
      return next();
    }

    // ── Bearer token required ────────────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    const token   = authHeader.slice(7);
    const decoded = await auth.verifyIdToken(token, true);
    const uid     = decoded.uid;
    (req as any).callerUid = uid;

    // Firebase admin claim → full access
    if (decoded.admin) {
      (req as any).callerRole = 'admin' as CallerRole;
      return next();
    }

    // Need the booking's stationId to scope access
    const bRow = await db.execute(sql`
      SELECT station_id FROM bookings
      WHERE id = ${bookingId} OR booking_number = ${bookingId}
      LIMIT 1
    `);
    if (!bRow.rows.length) {
      // Booking doesn't exist — let the route return 404
      (req as any).callerRole = 'admin' as CallerRole;
      return next();
    }
    const stationId = toNum((bRow.rows[0] as any).station_id);

    // ── Franchise owner ──────────────────────────────────────────────────────
    if (stationId) {
      const franchiseCheck = await db.execute(sql`
        SELECT fo.id
        FROM franchise_owners fo
        WHERE fo.owner_user_id = ${uid}
          AND fo.status = 'active'
          AND (
            EXISTS (SELECT 1 FROM stations st WHERE st.id = ${stationId} AND st.franchise_id = fo.id)
            OR EXISTS (
              SELECT 1 FROM station_settlements sx
              WHERE sx.station_id = ${stationId}
                AND sx.franchise_owner_id = fo.id
            )
          )
        LIMIT 1
      `);
      if (franchiseCheck.rows.length) {
        (req as any).callerRole = 'franchise_owner' as CallerRole;
        return next();
      }

      // ── Station operator ─────────────────────────────────────────────────
      const opCheck = await db.execute(sql`
        SELECT id FROM station_operators
        WHERE user_id = ${uid}
          AND station_id = ${stationId}
          AND is_active = true
        LIMIT 1
      `);
      if (opCheck.rows.length) {
        (req as any).callerRole = 'station_operator' as CallerRole;
        return next();
      }
    }

    return res.status(403).json({ error: 'access_denied' });
  } catch (err: any) {
    logger.error('[BookingTrace] auth error', { error: err.message });
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── T31: Full Booking Trace ──────────────────────────────────────────────────

/**
 * GET /api/booking-trace/:bookingId
 *
 * Returns full operational + financial trace for a booking:
 *   booking core · station · customer · status history ·
 *   settlement · dispute · refund (booking + wallet) · audit trail
 *
 * bookingId may be the UUID primary key or the human-readable booking_number.
 */
router.get('/:bookingId', requireTraceViewer, async (req: Request, res: Response) => {
  try {
    const bookingId  = req.params.bookingId;
    const callerRole = (req as any).callerRole as CallerRole;

    // ── 1. Booking core + station + customer ─────────────────────────────────
    const bRows = await db.execute(sql`
      SELECT
        b.id,
        b.booking_number,
        b.user_id,
        b.provider_id,
        b.station_id,
        b.start_time,
        b.end_time,
        b.status,
        b.payment_status,
        b.payment_method,
        b.subtotal::float                AS subtotal,
        b.platform_fee::float            AS platform_fee,
        b.provider_payout::float         AS provider_payout,
        b.total::float                   AS total,
        COALESCE(b.tax_amount::float, 0) AS tax_amount,
        b.currency,
        b.service_type,
        b.service_description,
        b.cancellation_reason,
        b.cancelled_by,
        b.cancelled_at,
        b.refund_amount::float           AS refund_amount,
        b.refund_amount_cents,
        b.refund_status,
        b.refund_reason,
        b.refund_processed_at,
        b.refund_requested_at,
        b.dispute_opened_at,
        b.dispute_resolved_at,
        b.confirmed_at,
        b.started_at,
        b.completed_at,
        b.created_at,
        b.payout_status,

        -- Station
        st.name                          AS station_name,
        COALESCE(st.station_code, '')    AS station_code,
        st.ownership_type                AS station_ownership_type,

        -- Customer
        cu.first_name                    AS customer_first_name,
        cu.last_name                     AS customer_last_name,
        cu.email                         AS customer_email,
        cu.phone                         AS customer_phone

      FROM bookings b
      LEFT JOIN stations st ON st.id = b.station_id
      LEFT JOIN users    cu ON cu.id = b.user_id
      WHERE b.id = ${bookingId}
         OR b.booking_number = ${bookingId}
      LIMIT 1
    `);

    if (!bRows.rows.length) {
      return res.status(404).json({ error: 'booking_not_found' });
    }
    const b = bRows.rows[0] as any;
    const realBookingId = toStr(b.id);

    // ── 2. Status history ────────────────────────────────────────────────────
    const histRows = await db.execute(sql`
      SELECT from_status, to_status, changed_by_user_id, changed_by_role, reason, changed_at
      FROM booking_status_history
      WHERE booking_id = ${realBookingId}
      ORDER BY changed_at ASC
      LIMIT 100
    `);

    // ── 3. Settlement row ────────────────────────────────────────────────────
    const settlRows = await db.execute(sql`
      SELECT
        id,
        status,
        total_amount_cents,
        platform_fee_pct::float         AS platform_fee_pct,
        platform_amount_cents,
        station_revenue_pct::float      AS station_revenue_pct,
        station_amount_cents,
        franchise_override_pct::float   AS franchise_override_pct,
        franchise_amount_cents,
        settled_at,
        created_at
      FROM station_settlements
      WHERE booking_id = ${realBookingId}
      LIMIT 1
    `);

    let settlement: any = null;
    if (settlRows.rows.length) {
      const s = settlRows.rows[0] as any;
      const total     = toNum(s.total_amount_cents);
      const platform  = toNum(s.platform_amount_cents);
      const station   = toNum(s.station_amount_cents);
      const franchise = toNum(s.franchise_amount_cents);
      settlement = {
        id:                  toNum(s.id),
        status:              toStr(s.status),
        totalAmount:         toILS(s.total_amount_cents),
        platformFeePct:      toNum(s.platform_fee_pct),
        platformAmount:      toILS(s.platform_amount_cents),
        stationRevenuePct:   toNum(s.station_revenue_pct),
        stationAmount:       toILS(s.station_amount_cents),
        franchiseOverridePct: s.franchise_override_pct != null ? toNum(s.franchise_override_pct) : null,
        franchiseShare:      toILS(s.franchise_amount_cents),
        settledAt:           toDate(s.settled_at),
        createdAt:           toDate(s.created_at),
        hasReconciliationMismatch: total !== (platform + station + franchise),
      };
    }

    // ── 4. Dispute ───────────────────────────────────────────────────────────
    const dispRows = await db.execute(sql`
      SELECT id, reason, description, status, admin_notes, resolved_by, resolved_at, created_at
      FROM booking_disputes
      WHERE booking_id = ${realBookingId}
      ORDER BY created_at DESC
      LIMIT 1
    `);

    let dispute: any = null;
    if (dispRows.rows.length) {
      const d = dispRows.rows[0] as any;
      dispute = {
        id:          toStr(d.id),
        reason:      toStr(d.reason),
        description: d.description ? toStr(d.description) : null,
        status:      toStr(d.status),
        adminNotes:  d.admin_notes ? toStr(d.admin_notes) : null,
        resolvedBy:  d.resolved_by ? toStr(d.resolved_by) : null,
        resolvedAt:  toDate(d.resolved_at),
        createdAt:   toDate(d.created_at),
      };
    }

    // ── 5. Wallet refund (credit_transactions) ───────────────────────────────
    const walletRefundRows = await db.execute(sql`
      SELECT transaction_id, amount_cents, transaction_type, credit_type, description, created_at
      FROM credit_transactions
      WHERE booking_id = ${realBookingId}
        AND transaction_type = 'refund'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // ── 6. Audit trail (dispute + booking level events) ──────────────────────
    const auditRows = await db.execute(sql`
      SELECT actor_user_id, actor_role, action_type, metadata, severity, created_at
      FROM audit_events
      WHERE (target_type = 'booking' AND target_id = ${realBookingId})
         OR (target_type = 'dispute' AND target_id IN (
              SELECT id::text FROM booking_disputes WHERE booking_id = ${realBookingId}
            ))
      ORDER BY created_at DESC
      LIMIT 50
    `);

    // ── Assemble response ────────────────────────────────────────────────────

    const booking = {
      id:                 realBookingId,
      bookingNumber:      toStr(b.booking_number),
      userId:             toStr(b.user_id),
      providerId:         b.provider_id ? toStr(b.provider_id) : null,
      stationId:          b.station_id  ? toNum(b.station_id)  : null,
      startTime:          toDate(b.start_time),
      endTime:            toDate(b.end_time),
      status:             toStr(b.status),
      paymentStatus:      toStr(b.payment_status),
      paymentMethod:      b.payment_method ? toStr(b.payment_method) : null,
      payoutStatus:       toStr(b.payout_status),
      subtotal:           toNum(b.subtotal),
      platformFee:        toNum(b.platform_fee),
      providerPayout:     toNum(b.provider_payout),
      total:              toNum(b.total),
      taxAmount:          toNum(b.tax_amount),
      currency:           toStr(b.currency) || 'ILS',
      serviceType:        b.service_type        ? toStr(b.service_type)        : null,
      serviceDescription: b.service_description ? toStr(b.service_description) : null,
      cancellationReason: b.cancellation_reason ? toStr(b.cancellation_reason) : null,
      cancelledBy:        b.cancelled_by        ? toStr(b.cancelled_by)        : null,
      cancelledAt:        toDate(b.cancelled_at),
      confirmedAt:        toDate(b.confirmed_at),
      startedAt:          toDate(b.started_at),
      completedAt:        toDate(b.completed_at),
      createdAt:          toDate(b.created_at),
    };

    const station = b.station_id ? {
      id:            toNum(b.station_id),
      name:          toStr(b.station_name),
      stationCode:   toStr(b.station_code),
      ownershipType: toStr(b.station_ownership_type),
    } : null;

    const customer = {
      id:        toStr(b.user_id),
      firstName: b.customer_first_name ? toStr(b.customer_first_name) : null,
      lastName:  b.customer_last_name  ? toStr(b.customer_last_name)  : null,
      email:     b.customer_email      ? toStr(b.customer_email)      : null,
      phone:     b.customer_phone      ? toStr(b.customer_phone)      : null,
    };

    const statusHistory = (histRows.rows as any[]).map(h => ({
      fromStatus:       h.from_status ? toStr(h.from_status) : null,
      toStatus:         toStr(h.to_status),
      changedByUserId:  toStr(h.changed_by_user_id),
      changedByRole:    toStr(h.changed_by_role),
      reason:           h.reason ? toStr(h.reason) : null,
      changedAt:        toDate(h.changed_at),
    }));

    const refund = {
      fromBooking: (b.refund_amount != null || b.refund_status != null) ? {
        amount:         toNum(b.refund_amount),
        amountCents:    b.refund_amount_cents != null ? toNum(b.refund_amount_cents) : null,
        status:         b.refund_status ? toStr(b.refund_status) : null,
        reason:         b.refund_reason ? toStr(b.refund_reason) : null,
        requestedAt:    toDate(b.refund_requested_at),
        processedAt:    toDate(b.refund_processed_at),
      } : null,
      fromWallet: (walletRefundRows.rows as any[]).map(w => ({
        transactionId: toStr(w.transaction_id),
        amountCents:   toNum(w.amount_cents),
        creditType:    toStr(w.credit_type),
        description:   w.description ? toStr(w.description) : null,
        createdAt:     toDate(w.created_at),
      })),
    };

    const auditTrail = (auditRows.rows as any[]).map(a => ({
      actorUserId: a.actor_user_id ? toStr(a.actor_user_id) : null,
      actorRole:   a.actor_role   ? toStr(a.actor_role)   : null,
      actionType:  toStr(a.action_type),
      metadata:    a.metadata ?? null,
      severity:    toStr(a.severity),
      createdAt:   toDate(a.created_at),
    }));

    // ── T37 Executive summary ────────────────────────────────────────────────
    const settlementStatus = settlement?.status ?? 'none';
    const disputeStatus    = dispute?.status    ?? 'none';
    const refundStatus     = b.refund_status    ? toStr(b.refund_status) : (refund.fromWallet.length ? 'wallet_refund' : 'none');

    let nextActionOwner: 'system' | 'platform' | 'franchise_owner' | 'none' = 'none';
    if (disputeStatus === 'open' || disputeStatus === 'under_review') {
      nextActionOwner = 'platform';
    } else if (settlementStatus === 'disputed') {
      nextActionOwner = 'platform';
    } else if (settlementStatus === 'pending') {
      nextActionOwner = 'system';
    }

    const summary = {
      grossAmount:       booking.total,
      settlementStatus,
      disputeStatus,
      refundStatus,
      hasMismatch:       settlement?.hasReconciliationMismatch ?? false,
      nextActionOwner,
    };

    const canTakeDisputeAction = callerRole !== 'station_operator';

    res.json({
      callerRole,
      canTakeDisputeAction,
      booking,
      station,
      customer,
      statusHistory,
      settlement,
      dispute,
      refund,
      auditTrail,
      summary,
    });
  } catch (err: any) {
    logger.error('[BookingTrace] trace error', { error: err.message });
    res.status(500).json({ error: 'trace_failed' });
  }
});

// ─── T34: Dispute Resolution Actions ─────────────────────────────────────────

const DISPUTE_ACTIONS = ['mark_under_review', 'approve_resolution', 'reject_claim', 'close_case'] as const;
type DisputeAction = typeof DISPUTE_ACTIONS[number];

const ACTION_TO_STATUS: Record<DisputeAction, string> = {
  mark_under_review:   'under_review',
  approve_resolution:  'resolved',
  reject_claim:        'rejected',
  close_case:          'closed',
};

/**
 * POST /api/booking-trace/:bookingId/dispute/action
 *
 * body: { action: DisputeAction, note?: string }
 *
 * Updates booking_disputes.status and writes to audit_events.
 * Every state change is auditable — no silent overrides.
 */
router.post('/:bookingId/dispute/action', requireTraceViewer, async (req: Request, res: Response) => {
  try {
    const callerRole = (req as any).callerRole as CallerRole;
    const callerUid  = (req as any).callerUid  as string | null;

    if (callerRole === 'station_operator') {
      return res.status(403).json({ error: 'insufficient_role_for_dispute_action' });
    }

    const bookingId = req.params.bookingId;
    const { action, note } = req.body ?? {};

    if (!action || !DISPUTE_ACTIONS.includes(action as DisputeAction)) {
      return res.status(400).json({
        error: 'invalid_action',
        valid: DISPUTE_ACTIONS,
      });
    }

    const newStatus = ACTION_TO_STATUS[action as DisputeAction];

    // Fetch the dispute
    const dispRows = await db.execute(sql`
      SELECT id, status, booking_id
      FROM booking_disputes
      WHERE booking_id IN (
        SELECT id FROM bookings WHERE id = ${bookingId} OR booking_number = ${bookingId} LIMIT 1
      )
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!dispRows.rows.length) {
      return res.status(404).json({ error: 'no_dispute_for_booking' });
    }

    const dispute    = dispRows.rows[0] as any;
    const disputeId  = toStr(dispute.id);
    const fromStatus = toStr(dispute.status);
    const realBookingId = toStr(dispute.booking_id);

    // Update dispute status + admin notes
    const noteText = note ? String(note).slice(0, 1000) : null;

    await db.execute(sql`
      UPDATE booking_disputes
      SET
        status      = ${newStatus},
        admin_notes = CASE
          WHEN ${noteText} IS NOT NULL THEN COALESCE(admin_notes || E'\n', '') || ${noteText}
          ELSE admin_notes
        END,
        resolved_by = CASE
          WHEN ${newStatus} IN ('resolved', 'rejected', 'closed') THEN ${callerUid ?? 'admin'}
          ELSE resolved_by
        END,
        resolved_at = CASE
          WHEN ${newStatus} IN ('resolved', 'rejected', 'closed') THEN NOW()
          ELSE resolved_at
        END
      WHERE id = ${disputeId}
    `);

    // Write immutable audit event
    await db.execute(sql`
      INSERT INTO audit_events (actor_user_id, actor_role, action_type, target_type, target_id, metadata, severity)
      VALUES (
        ${callerUid ?? 'admin'},
        ${callerRole},
        ${'dispute.' + action},
        'dispute',
        ${disputeId},
        ${JSON.stringify({ bookingId: realBookingId, fromStatus, toStatus: newStatus, note: noteText ?? undefined })}::jsonb,
        'info'
      )
    `);

    // If resolving/rejecting, also update booking's dispute_resolved_at
    if (['resolved', 'rejected', 'closed'].includes(newStatus)) {
      await db.execute(sql`
        UPDATE bookings SET dispute_resolved_at = NOW() WHERE id = ${realBookingId}
      `);
    }

    res.json({
      success:     true,
      disputeId,
      action,
      fromStatus,
      toStatus:    newStatus,
      performedBy: callerUid ?? 'admin',
      performedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[BookingTrace] dispute action error', { error: err.message });
    res.status(500).json({ error: 'dispute_action_failed' });
  }
});

export default router;

/**
 * Provider Dashboard V2 Routes
 * Phase 3 migration: reads from booking_requests (new system) instead of bookings (old system).
 *
 * Key differences from V1:
 *   - providerId is the Firebase UID directly — no integer provider record lookup needed
 *   - All monetary values are stored in cents (agoras) and converted to ILS decimals on the way out
 *   - Status vocabulary maps to bookingRequestStatusEnum (pending|accepted|confirmed|in_progress|completed|reviewed|cancelled|declined|disputed)
 *
 * Rollback: switch UI query keys from /v2/... back to /... (v1). V1 routes remain live.
 * Remove v2 once shadow comparison confirms counts match across all status groups.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { bookingRequests } from '@shared/schema';
import { eq, sql, count, desc, inArray, and, gte, lte } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { pool } from '../db';

const router = Router();

// ── Auth helper (identical to V1) ────────────────────────────────────────────
async function getAuthenticatedUser(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  try {
    const token = authHeader.split('Bearer ')[1];
    return await auth.verifyIdToken(token, true);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

// ── Status group → booking_requests enum values ───────────────────────────────
// UI tab names → actual DB status values in new system
const STATUS_GROUP_MAP: Record<string, string[]> = {
  new_request:  ['pending', 'accepted', 'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending'],
  active:       ['confirmed', 'in_progress'],
  completed:    ['completed', 'reviewed'],
  cancelled:    ['cancelled', 'declined', 'disputed'],
  // V1 compat aliases — old UI sent these tab IDs, map them to V2 enum values
  dispute:      ['disputed'],
  provider_confirmed: ['confirmed'],
};

// Converts a comma-separated status query param into an array of booking_request statuses
function resolveStatuses(statusParam: string | undefined): string[] | null {
  if (!statusParam || statusParam === 'all') return null;
  const raw = statusParam.split(',').map(s => s.trim()).filter(Boolean);
  const expanded: string[] = [];
  for (const s of raw) {
    if (STATUS_GROUP_MAP[s]) {
      expanded.push(...STATUS_GROUP_MAP[s]);
    } else {
      expanded.push(s); // pass through raw enum values
    }
  }
  return [...new Set(expanded)];
}

// Converts a booking_requests row to the same shape the V1 API returns (ILS, not cents)
// so existing POSJobs UI works without change.
function toV1Shape(row: Record<string, any>) {
  const centsToILS = (c: number | null | undefined) =>
    c != null ? (c / 100).toFixed(2) : null;

  return {
    // IDs — use requestId as the public booking reference
    id:                  String(row.id),
    bookingNumber:       row.request_id ?? row.requestId ?? `BR-${row.id}`,
    platformId:          null, // not in new system
    // Parties
    userId:              row.owner_id ?? row.ownerId,
    providerId:          row.provider_id ?? row.providerId,
    // Schedule
    startTime:           row.start_date ?? row.startDate,
    endTime:             row.end_date ?? row.endDate,
    duration:            null, // derived client-side if needed
    // Service
    serviceType:         row.service_type ?? row.serviceType,
    serviceDescription:  null,
    specialRequests:     row.special_requirements ?? row.specialRequirements,
    // Status
    status:              row.status,
    // Financials (ILS decimals — same unit as V1)
    subtotal:            centsToILS(row.subtotal_cents ?? row.subtotalCents),
    platformFee:         centsToILS(row.service_fee_cents ?? row.serviceFeeCents),
    providerPayout:      centsToILS(row.provider_payout_cents ?? row.providerPayoutCents),
    total:               centsToILS(row.total_cents ?? row.totalCents),
    currency:            row.currency ?? 'ILS',
    paymentStatus:       row.payment_transaction_id ? 'paid' : 'pending',
    payoutStatus:        row.payout_status ?? row.payoutStatus ?? 'pending',
    payoutDate:          row.payout_date ?? row.payoutDate,
    // Timestamps
    confirmedAt:         row.payment_held_at ?? row.paymentHeldAt,
    startedAt:           row.service_started_at ?? row.serviceStartedAt,
    completedAt:         row.service_completed_at ?? row.serviceCompletedAt,
    cancelledAt:         row.cancelled_at ?? row.cancelledAt,
    cancellationReason:  row.cancellation_reason ?? row.cancellationReason,
    createdAt:           row.created_at ?? row.createdAt,
    // V2-only extras (bonus data the old system didn't have)
    requestId:           row.request_id ?? row.requestId,
    petCount:            row.pet_count ?? row.petCount,
    ownerMessage:        row.owner_message ?? row.ownerMessage,
    providerResponse:    row.provider_response ?? row.providerResponse,
    _source:             'booking_requests', // watermark for shadow comparison logging
  };
}

// ── GET /api/provider-dashboard/v2/bookings ───────────────────────────────────
// Same interface as V1 /bookings — swappable query key.
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { status, page = '1', limit = '20' } = req.query;
    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const resolvedStatuses = resolveStatuses(status as string | undefined);

    // Build WHERE clause — providerId is the Firebase UID directly
    const conditions: any[] = [eq(bookingRequests.providerId, user.uid)];
    if (resolvedStatuses && resolvedStatuses.length > 0) {
      conditions.push(inArray(bookingRequests.status, resolvedStatuses as any[]));
    }
    const where = and(...conditions);

    const [countResult] = await db
      .select({ total: count() })
      .from(bookingRequests)
      .where(where);

    const total = countResult?.total ?? 0;

    // Raw SQL for select so snake_case columns come back naturally for toV1Shape
    const result = await pool.query(
      `SELECT
        id, request_id, owner_id, provider_id, status,
        service_type, special_requirements, owner_message, provider_response,
        start_date, end_date,
        subtotal_cents, service_fee_cents, provider_payout_cents, total_cents,
        currency, payment_transaction_id, payout_status, payout_date,
        payment_held_at, service_started_at, service_completed_at,
        cancelled_at, cancellation_reason, pet_count, created_at, updated_at
       FROM booking_requests
       WHERE provider_id = $1
         ${resolvedStatuses && resolvedStatuses.length > 0
           ? `AND status = ANY($2::text[])`
           : ''}
       ORDER BY created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      resolvedStatuses && resolvedStatuses.length > 0
        ? [user.uid, resolvedStatuses]
        : [user.uid],
    );

    const rows = result.rows.map(toV1Shape);

    logger.info('[ProviderDashboardV2] GET /bookings', {
      uid: user.uid, total, page: pageNum, status: status ?? 'all',
    });

    res.json({
      success: true,
      bookings: rows,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      _source: 'booking_requests',
    });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /bookings error', error);
    res.status(500).json({ error: 'Failed to load bookings (v2)' });
  }
});

// ── GET /api/provider-dashboard/v2/upcoming ────────────────────────────────────
// Upcoming confirmed/in-progress jobs within the next 7 days.
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const now         = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `SELECT
        id, request_id, owner_id, provider_id, status,
        service_type, special_requirements, owner_message,
        start_date, end_date,
        subtotal_cents, service_fee_cents, provider_payout_cents, total_cents,
        currency, payout_status, pet_count, created_at
       FROM booking_requests
       WHERE provider_id = $1
         AND status IN ('confirmed', 'in_progress')
         AND start_date IS NOT NULL
         AND start_date >= $2
         AND start_date <= $3
       ORDER BY start_date ASC
       LIMIT 20`,
      [user.uid, now, sevenDaysOut],
    );

    logger.info('[ProviderDashboardV2] GET /upcoming', { uid: user.uid, count: result.rows.length });

    res.json({
      success: true,
      upcoming: result.rows.map(toV1Shape),
      _source: 'booking_requests',
    });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /upcoming error', error);
    res.status(500).json({ error: 'Failed to load upcoming jobs (v2)' });
  }
});

// ── GET /api/provider-dashboard/v2/booking-counts ─────────────────────────────
// Count per status — used for tab badges in POSJobs.
// Also returns group-level counts (new_request, active, completed, cancelled) matching UI tab names.
router.get('/booking-counts', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const result = await pool.query(
      `SELECT status, COUNT(*)::int AS n
       FROM booking_requests
       WHERE provider_id = $1
       GROUP BY status`,
      [user.uid],
    );

    // Raw status counts
    const raw: Record<string, number> = {};
    for (const row of result.rows) {
      raw[row.status] = (raw[row.status] ?? 0) + row.n;
    }

    // Group counts for UI tab badges
    const groupCount = (keys: string[]) => keys.reduce((s, k) => s + (raw[k] ?? 0), 0);
    const counts = {
      all:          result.rows.reduce((s, r) => s + r.n, 0),
      new_request:  groupCount(STATUS_GROUP_MAP.new_request),
      active:       groupCount(STATUS_GROUP_MAP.active),
      completed:    groupCount(STATUS_GROUP_MAP.completed),
      cancelled:    groupCount(STATUS_GROUP_MAP.cancelled),
      // Raw enum values for admin/debugging
      ...raw,
    };

    logger.info('[ProviderDashboardV2] GET /booking-counts', { uid: user.uid, counts });

    res.json({ success: true, counts, _source: 'booking_requests' });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /booking-counts error', error);
    res.status(500).json({ error: 'Failed to load booking counts (v2)' });
  }
});

// ── GET /api/provider-dashboard/v2/migration-diff ─────────────────────────────
// Shadow comparison: compares old bookings vs new booking_requests counts for this provider.
// Used during the dual-read safety phase to confirm parity before retiring V1.
// Admin/internal only — not exposed to the provider UI.
router.get('/migration-diff', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    // V1 count — old bookings (providerId is integer from providers.id)
    const oldResult = await pool.query(
      `SELECT COUNT(*)::int AS n FROM bookings b
       JOIN providers p ON p.id = b.provider_id
       WHERE p.user_id = $1`,
      [user.uid],
    );

    // V2 count — new booking_requests (providerId is Firebase UID)
    const newResult = await pool.query(
      `SELECT COUNT(*)::int AS n FROM booking_requests WHERE provider_id = $1`,
      [user.uid],
    );

    // V2 payout total (ILS)
    const payoutResult = await pool.query(
      `SELECT COALESCE(SUM(provider_payout_cents), 0)::bigint AS total_payout_cents
       FROM booking_requests WHERE provider_id = $1 AND status IN ('completed','reviewed')`,
      [user.uid],
    );

    const oldCount = oldResult.rows[0]?.n ?? 0;
    const newCount = newResult.rows[0]?.n ?? 0;
    const payoutCents = payoutResult.rows[0]?.total_payout_cents ?? 0;

    const diff = {
      v1_bookings_count:        oldCount,
      v2_booking_requests_count: newCount,
      delta:                    newCount - oldCount,
      parity:                   oldCount === newCount,
      v2_total_payout_ils:      (Number(payoutCents) / 100).toFixed(2),
      recommendation:           oldCount === newCount
        ? 'SAFE TO SWITCH UI to v2'
        : `BACKFILL NEEDED — ${Math.abs(newCount - oldCount)} rows missing in ${newCount < oldCount ? 'booking_requests' : 'bookings'}`,
      ts: new Date().toISOString(),
    };

    logger.info('[ProviderDashboardV2] migration-diff', { uid: user.uid, diff });
    res.json({ success: true, diff });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /migration-diff error', error);
    res.status(500).json({ error: 'Failed to compute migration diff' });
  }
});

// ── GET /api/provider-dashboard/v2/earnings ────────────────────────────────────
// Earnings summary from booking_requests — replaces the V1 earnings route.
router.get('/earnings', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN payout_status = 'paid_out' THEN provider_payout_cents ELSE 0 END), 0)::bigint AS paid_payouts_cents,
        COALESCE(SUM(CASE WHEN status IN ('completed','reviewed') AND payout_status != 'paid_out' THEN provider_payout_cents ELSE 0 END), 0)::bigint AS pending_payouts_cents,
        COALESCE(SUM(CASE
          WHEN status IN ('completed','reviewed')
           AND EXTRACT(MONTH FROM service_completed_at) = EXTRACT(MONTH FROM NOW())
           AND EXTRACT(YEAR  FROM service_completed_at) = EXTRACT(YEAR  FROM NOW())
          THEN provider_payout_cents ELSE 0 END), 0)::bigint AS this_month_cents,
        COUNT(CASE WHEN status IN ('completed','reviewed') THEN 1 END)::int AS completed_count
       FROM booking_requests
       WHERE provider_id = $1`,
      [user.uid],
    );

    const row = result.rows[0] ?? {};
    const toILS = (c: number | string) => (Number(c) / 100).toFixed(2);

    res.json({
      success: true,
      earnings: {
        paidPayouts:      toILS(row.paid_payouts_cents),
        pendingPayouts:   toILS(row.pending_payouts_cents),
        thisMonthEarnings: toILS(row.this_month_cents),
        completedCount:   row.completed_count ?? 0,
      },
      _source: 'booking_requests',
    });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /earnings error', error);
    res.status(500).json({ error: 'Failed to load earnings (v2)' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — V2 ACTION ROUTES (writes to booking_requests, not bookings)
// These replace the V1 action handlers for the provider lifecycle.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Status transition table ───────────────────────────────────────────────────
// Defines EXACTLY which statuses each action is allowed to transition FROM.
const ALLOWED_FROM: Record<string, string[]> = {
  accept:   ['pending', 'accepted'],
  decline:  ['pending', 'accepted'],
  cancel:   ['accepted', 'confirmed', 'in_progress',
             'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending'],
  start:    ['confirmed'],
  complete: ['in_progress'],
  report:   ['pending', 'accepted', 'confirmed', 'in_progress'],
};

// Target status for each action
const TO_STATUS: Record<string, string> = {
  accept:   'confirmed',
  decline:  'declined',
  cancel:   'cancelled',
  start:    'in_progress',
  complete: 'completed',
  report:   'disputed',
};

// Prefix convention for cancellation_reason (matches V1 semantic prefix scheme)
const REASON_PREFIX: Record<string, string> = {
  decline: 'DECLINED',
  cancel:  'CANCELLED',
  report:  'DISPUTE',
};

const VALID_ACTIONS = Object.keys(ALLOWED_FROM);

// ── POST /api/provider-dashboard/v2/bookings/:id/:action ────────────────────
// Handles: accept | decline | cancel | start | complete | report
// Ownership: provider_id must match authenticated user's Firebase UID.
// Reason: optional body.reason — stored with semantic prefix in cancellation_reason
//         AND appended to status_history JSONB for full audit trail.
router.post('/bookings/:id/:action', async (req: Request, res: Response) => {
  const { id, action } = req.params;

  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Unknown action '${action}'. Valid: ${VALID_ACTIONS.join(', ')}` });
  }

  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking id' });
    }

    // Fetch + ownership check in one query
    const fetchResult = await pool.query(
      `SELECT id, status, provider_id FROM booking_requests WHERE id = $1 AND provider_id = $2`,
      [bookingId, user.uid],
    );

    if (fetchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not yours' });
    }

    const booking = fetchResult.rows[0];
    const oldStatus: string = booking.status;
    const newStatus: string = TO_STATUS[action];
    const allowed: string[] = ALLOWED_FROM[action];

    if (!allowed.includes(oldStatus)) {
      return res.status(400).json({
        error: `Cannot '${action}' a booking with status '${oldStatus}'. Allowed from: [${allowed.join(', ')}].`,
        currentStatus: oldStatus,
        allowedFrom: allowed,
      });
    }

    const now = new Date();
    const { reason } = req.body;

    // Build status_history entry
    const historyEntry = {
      status:     newStatus,
      prevStatus: oldStatus,
      timestamp:  now.toISOString(),
      actor:      'provider',
      uid:        user.uid,
      action,
      ...(reason ? { note: reason } : {}),
    };

    // Build UPDATE dynamically — only touch columns relevant to the action
    const setClauses: string[] = [
      `status = $1::booking_request_status`,
      `updated_at = NOW()`,
      `status_history = status_history || $2::jsonb`,
    ];
    const params: any[] = [newStatus, JSON.stringify([historyEntry])];
    let p = 3; // next param index

    if (action === 'decline' || action === 'cancel') {
      const prefix = REASON_PREFIX[action];
      setClauses.push(`cancellation_reason = $${p++}`);
      params.push(`${prefix}: ${reason || `Provider ${action}d`}`);
      setClauses.push(`cancelled_at = $${p++}`);
      params.push(now);
      setClauses.push(`cancelled_by = 'provider'`);
    }

    if (action === 'report') {
      setClauses.push(`cancellation_reason = $${p++}`);
      params.push(`DISPUTE: ${reason || 'Issue reported by provider'}`);
    }

    if (action === 'start') {
      setClauses.push(`service_started_at = $${p++}`);
      params.push(now);
    }

    if (action === 'complete') {
      setClauses.push(`service_completed_at = $${p++}`);
      params.push(now);
    }

    // WHERE: id + provider_id double-check prevents any TOCTOU race
    params.push(bookingId); // $p
    params.push(user.uid);  // $p+1

    const updateResult = await pool.query(
      `UPDATE booking_requests
       SET ${setClauses.join(', ')}
       WHERE id = $${p} AND provider_id = $${p + 1}
       RETURNING id, status, cancellation_reason, service_started_at,
                 service_completed_at, cancelled_at, updated_at`,
      params,
    );

    if (updateResult.rows.length === 0) {
      // Should not happen — the fetch proved the row exists — but guard anyway
      return res.status(500).json({ error: 'Update did not modify any row' });
    }

    const updated = updateResult.rows[0];

    // Structured log — retained for the Phase 4 transition window
    logger.info(`[ProviderDashboardV2] ACTION:${action.toUpperCase()}`, {
      bookingId,
      oldStatus,
      newStatus,
      route: `/api/provider-dashboard/v2/bookings/${bookingId}/${action}`,
      providerUid: user.uid,
      reason: reason ?? null,
      ts: now.toISOString(),
    });

    res.json({
      success:   true,
      action,
      bookingId,
      oldStatus,
      newStatus,
      updatedAt: updated.updated_at,
      stamp:     `BOOKING_${action.toUpperCase()}::${user.uid}::${now.toISOString()}`,
      _source:   'booking_requests',
    });
  } catch (error) {
    logger.error(`[ProviderDashboardV2] ACTION:${action} error`, error);
    res.status(500).json({ error: `Failed to ${action} booking (v2)` });
  }
});

export default router;

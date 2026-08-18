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
import { bookingRequests, providers, superAppNotifications, providerProfiles } from '@shared/schema';
import { eq, sql, count, desc, inArray, and, gte, lte } from 'drizzle-orm';
import { assertServiceApproved, providerHasAnyServiceRows } from '../services/providerServiceApproval';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { pool } from '../db';
import { scheduleRebookTrigger } from '../jobs/rebook-scheduler';
import { BLOCKING_STATUSES } from '@shared/lib/bookingOverlap';
import { releaseSlotLock } from '../lib/marketplaceSlotLock';
import { dispatchNotification } from '../lib/notificationDispatcher';
import { walletService } from '../services/WalletService';

const router = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────
// SECURITY: x-test-provider-uid dev bypass removed — was gated only on
// NODE_ENV which is a single point of failure. Use a real synthetic Firebase
// test account for E2E tests.
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
  new_request:  ['pending', 'meet_greet_requested', 'accepted', 'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending'],
  // 'provider_marked_complete' = provider said done, awaiting customer approval.
  // Keep it under the provider's ACTIVE tab (still open, NOT yet earned) so the
  // job stays visible and is NOT counted as completed/earned until it truly
  // reaches 'completed'. (Earnings math reads status IN ('completed','reviewed')
  // via raw SQL, independent of this map, so it stays correct.)
  active:       ['confirmed', 'in_progress', 'provider_marked_complete'],
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

    const [totals, recents, weekly] = await Promise.all([
      pool.query(
        `SELECT
          COALESCE(SUM(CASE WHEN payout_status = 'paid_out' THEN provider_payout_cents ELSE 0 END), 0)::bigint AS paid_payouts_cents,
          COALESCE(SUM(CASE WHEN status IN ('completed','reviewed') AND payout_status != 'paid_out' THEN provider_payout_cents ELSE 0 END), 0)::bigint AS pending_payouts_cents,
          COALESCE(SUM(CASE
            WHEN status IN ('completed','reviewed')
             AND service_completed_at >= date_trunc('week', NOW())
            THEN provider_payout_cents ELSE 0 END), 0)::bigint AS this_week_cents,
          COALESCE(SUM(CASE
            WHEN status IN ('completed','reviewed')
             AND EXTRACT(MONTH FROM service_completed_at) = EXTRACT(MONTH FROM NOW())
             AND EXTRACT(YEAR  FROM service_completed_at) = EXTRACT(YEAR  FROM NOW())
            THEN provider_payout_cents ELSE 0 END), 0)::bigint AS this_month_cents,
          COALESCE(SUM(CASE
            WHEN status IN ('completed','reviewed')
             AND EXTRACT(MONTH FROM service_completed_at) = EXTRACT(MONTH FROM NOW() - INTERVAL '1 month')
             AND EXTRACT(YEAR  FROM service_completed_at) = EXTRACT(YEAR  FROM NOW() - INTERVAL '1 month')
            THEN provider_payout_cents ELSE 0 END), 0)::bigint AS last_month_cents,
          COALESCE(SUM(CASE WHEN status IN ('completed','reviewed') THEN provider_payout_cents ELSE 0 END), 0)::bigint AS total_earnings_cents,
          COUNT(CASE WHEN status IN ('completed','reviewed') THEN 1 END)::int AS completed_count
         FROM booking_requests
         WHERE provider_id = $1`,
        [user.uid],
      ),
      pool.query(
        `SELECT
          request_id, provider_payout_cents, subtotal_cents, service_fee_cents,
          service_completed_at, payout_status, service_type
         FROM booking_requests
         WHERE provider_id = $1 AND status IN ('completed','reviewed')
         ORDER BY service_completed_at DESC NULLS LAST
         LIMIT 20`,
        [user.uid],
      ),
      // Weekly buckets of the CURRENT month — feeds the provider-home income
      // chart (canonical mockup: "סקירת חודש" with week-by-week bars). Weeks are
      // day-of-month sevenths (1–7 → week 1, 8–14 → week 2 …): deterministic and
      // immune to ISO year-boundary week numbering.
      pool.query(
        `SELECT
          CEIL(EXTRACT(DAY FROM service_completed_at) / 7.0)::int AS week_of_month,
          COALESCE(SUM(provider_payout_cents), 0)::bigint AS cents
         FROM booking_requests
         WHERE provider_id = $1
           AND status IN ('completed','reviewed')
           AND service_completed_at >= date_trunc('month', NOW())
         GROUP BY 1
         ORDER BY 1`,
        [user.uid],
      ),
    ]);

    const row = totals.rows[0] ?? {};
    const toILS = (c: number | string) => Number((Number(c) / 100).toFixed(2));

    // Weekly series padded to the month's real week count (a 31-day month has 5
    // buckets) so the chart's axis is stable even when some weeks earned 0.
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const weeklyByBucket = new Map<number, number>(
      weekly.rows.map((w: any) => [Number(w.week_of_month), Number(w.cents)]),
    );
    const weeklySeries = Array.from({ length: weekCount }, (_, i) => ({
      week: i + 1,
      amount: toILS(weeklyByBucket.get(i + 1) ?? 0),
    }));

    // Month-over-month delta for the "+18% מהחודש שעבר" line. null when last
    // month earned nothing — a percentage against zero is meaningless, and the
    // UI should show nothing rather than a fabricated number.
    const thisM = Number(row.this_month_cents ?? 0);
    const lastM = Number(row.last_month_cents ?? 0);
    const monthOverMonthPct = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : null;

    res.json({
      success: true,
      earnings: {
        totalEarnings:     toILS(row.total_earnings_cents),
        paidPayouts:       toILS(row.paid_payouts_cents),
        pendingPayouts:    toILS(row.pending_payouts_cents),
        thisWeekEarnings:  toILS(row.this_week_cents),
        thisMonthEarnings: toILS(row.this_month_cents),
        lastMonthEarnings: toILS(row.last_month_cents),
        weeklySeries,
        monthOverMonthPct,
        completedCount:    row.completed_count ?? 0,
        totalJobs:         row.completed_count ?? 0,
        recentPayouts: recents.rows.map(r => ({
          bookingNumber: r.request_id,
          amount:        toILS(r.provider_payout_cents),
          gross:         toILS(r.subtotal_cents),
          platformFee:   toILS(r.service_fee_cents),
          date:          r.service_completed_at,
          payoutStatus:  r.payout_status ?? 'pending',
          serviceType:   r.service_type,
          platformId:    'booking_requests',
        })),
      },
      _source: 'booking_requests',
    });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /earnings error', error);
    res.status(500).json({ error: 'Failed to load earnings (v2)' });
  }
});

// ── GET /api/provider-dashboard/v2/stats ──────────────────────────────────────
// Aggregate stats from booking_requests (V2) + provider profile data.
// Drop-in replacement for V1 /stats — identical response shape.
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const [countsResult, providerRecords] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN status IN ('completed','reviewed') THEN 1 END)::int AS completed,
          COUNT(CASE WHEN status IN ('confirmed','in_progress') THEN 1 END)::int AS active,
          COUNT(CASE WHEN status IN ('cancelled','declined') THEN 1 END)::int AS cancelled,
          COALESCE(SUM(CASE WHEN status IN ('completed','reviewed') THEN provider_payout_cents ELSE 0 END), 0)::bigint AS total_earnings_cents,
          COALESCE(SUM(CASE WHEN status IN ('completed','reviewed') AND payout_status != 'paid_out' THEN provider_payout_cents ELSE 0 END), 0)::bigint AS pending_cents
         FROM booking_requests
         WHERE provider_id = $1`,
        [user.uid],
      ),
      db.select().from(providers).where(eq(providers.userId, user.uid)),
    ]);

    const row = countsResult.rows[0] ?? {};
    const totalBookings    = row.total     ?? 0;
    const completedBookings = row.completed ?? 0;

    const avgRating = providerRecords.length > 0
      ? providerRecords.reduce((s, p) => s + parseFloat(p.averageRating || '0'), 0) / providerRecords.length
      : 0;
    const totalReviews = providerRecords.reduce((s, p) => s + (p.totalReviews || 0), 0);

    res.json({
      success: true,
      stats: {
        totalBookings,
        completedBookings,
        activeBookings:    row.active     ?? 0,
        cancelledBookings: row.cancelled  ?? 0,
        totalEarnings:     Number((Number(row.total_earnings_cents) / 100).toFixed(2)),
        pendingPayouts:    Number((Number(row.pending_cents)        / 100).toFixed(2)),
        averageRating:     Math.round(avgRating * 10) / 10,
        totalReviews,
        completionRate:    totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0,
        platforms: providerRecords.map(p => ({
          id:                 p.id,
          platformId:         p.platformId,
          businessName:       p.businessName,
          isAvailable:        p.isAvailable,
          isActive:           p.isActive,
          verificationStatus: p.verificationStatus,
        })),
        isActive: providerRecords.some(p => p.isActive),
      },
      _source: 'booking_requests',
    });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /stats error', error);
    res.status(500).json({ error: 'Failed to load stats (v2)' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTELLIGENCE ENDPOINT — alerts + optimization suggestions
// GET /api/provider-dashboard/v2/intelligence
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/intelligence', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const uid = user.uid;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayRow, weekRow, upcomingRow, missedRow, profileRow] = await Promise.all([
      // Today's earnings
      pool.query(
        `SELECT COALESCE(SUM(provider_payout_cents), 0)::bigint AS cents
         FROM booking_requests
         WHERE provider_id = $1
           AND status IN ('completed','reviewed')
           AND service_completed_at >= $2`,
        [uid, todayStart],
      ),
      // This month's completed bookings
      pool.query(
        `SELECT COUNT(*)::int AS completed_this_month,
                COALESCE(SUM(provider_payout_cents), 0)::bigint AS month_earnings_cents
         FROM booking_requests
         WHERE provider_id = $1
           AND status IN ('completed','reviewed')
           AND service_completed_at >= date_trunc('month', now())`,
        [uid],
      ),
      // Upcoming (pending + confirmed)
      pool.query(
        `SELECT COUNT(*)::int AS upcoming
         FROM booking_requests
         WHERE provider_id = $1
           AND status IN ('pending','accepted','confirmed','meet_greet_scheduled','meet_greet_completed','payment_pending')`,
        [uid],
      ),
      // Missed/declined in last 7 days — bookings that expired without action
      pool.query(
        `SELECT COUNT(*)::int AS missed
         FROM booking_requests
         WHERE provider_id = $1
           AND status IN ('cancelled','declined')
           AND cancelled_at >= now() - interval '7 days'`,
        [uid],
      ),
      // Profile completeness (bio, avatar)
      db.select({
        bio: providers.bio,
        photoUrl: providers.photoUrl,
        averageRating: providers.averageRating,
        completionRate: providers.completionRate,
        totalBookings: providers.totalBookings,
        verificationStatus: providers.verificationStatus,
      }).from(providers).where(eq(providers.userId, uid)),
    ]);

    const todayEarningsCents = Number(todayRow.rows[0]?.cents ?? 0);
    const monthEarningsCents = Number(weekRow.rows[0]?.month_earnings_cents ?? 0);
    const completedThisMonth = weekRow.rows[0]?.completed_this_month ?? 0;
    const upcomingCount      = upcomingRow.rows[0]?.upcoming ?? 0;
    const missedCount        = missedRow.rows[0]?.missed ?? 0;

    const profile = profileRow[0] ?? {};
    const completionRate  = parseFloat(String(profile.completionRate ?? 0));
    const averageRating   = parseFloat(String(profile.averageRating ?? 0));
    const totalBookings   = profile.totalBookings ?? 0;

    // ── Build alerts ────────────────────────────────────────────────────────
    const alerts: Array<{ type: string; message: string; messageHe: string; priority: 'high' | 'medium' | 'low' }> = [];

    if (missedCount >= 3) {
      alerts.push({
        type: 'missed_bookings',
        message: `You missed ${missedCount} bookings this week. Consider widening your availability.`,
        messageHe: `פספסת ${missedCount} הזמנות השבוע — שקול להרחיב את הזמינות שלך.`,
        priority: 'high',
      });
    } else if (missedCount >= 1) {
      alerts.push({
        type: 'missed_bookings',
        message: `You missed ${missedCount} booking${missedCount > 1 ? 's' : ''} this week.`,
        messageHe: `פספסת ${missedCount} הזמנות השבוע.`,
        priority: 'medium',
      });
    }

    if (profile.verificationStatus === 'pending') {
      alerts.push({
        type: 'verification_pending',
        message: 'Your verification is pending. Complete it to appear higher in search results.',
        messageHe: 'האימות שלך בהמתנה — השלם אותו כדי להופיע גבוה יותר בתוצאות החיפוש.',
        priority: 'high',
      });
    }

    if (completionRate < 70 && totalBookings > 5) {
      alerts.push({
        type: 'low_completion_rate',
        message: `Your completion rate is ${Math.round(completionRate)}%. Cancellations affect your ranking.`,
        messageHe: `שיעור ההשלמה שלך הוא ${Math.round(completionRate)}%. ביטולים פוגעים בדירוג שלך.`,
        priority: 'medium',
      });
    }

    if (upcomingCount === 0 && totalBookings > 0) {
      alerts.push({
        type: 'no_upcoming_bookings',
        message: 'No upcoming bookings. Make sure your availability calendar is up to date.',
        messageHe: 'אין הזמנות קרובות — ודא שלוח הזמינות שלך מעודכן.',
        priority: 'low',
      });
    }

    // ── Build optimization suggestions ──────────────────────────────────────
    const suggestions: Array<{ type: string; message: string; messageHe: string; estimatedImpact: string }> = [];

    if (!profile.bio || profile.bio.trim().length < 50) {
      suggestions.push({
        type: 'complete_bio',
        message: 'Add a detailed bio to increase your booking rate by up to 30%.',
        messageHe: 'הוסף תיאור מפורט — מגדיל את שיעור ההזמנות בעד 30%.',
        estimatedImpact: '+30% bookings',
      });
    }

    if (!profile.photoUrl) {
      suggestions.push({
        type: 'add_photo',
        message: 'Providers with profile photos receive 2× more bookings.',
        messageHe: 'ספקים עם תמונת פרופיל מקבלים פי 2 הזמנות.',
        estimatedImpact: '+100% visibility',
      });
    }

    if (averageRating >= 4.5 && totalBookings >= 10) {
      suggestions.push({
        type: 'premium_listing',
        message: 'Your rating qualifies you for a featured placement. Contact support to activate.',
        messageHe: 'הדירוג שלך מאפשר מיקום מובלט — צור קשר עם התמיכה להפעלה.',
        estimatedImpact: '+23% bookings',
      });
    }

    if (missedCount > 0) {
      suggestions.push({
        type: 'increase_availability',
        message: 'Increasing your available hours could reduce missed bookings.',
        messageHe: 'הרחבת שעות הזמינות יכולה להפחית הזמנות שפוספסו.',
        estimatedImpact: `-${missedCount} missed/week`,
      });
    }

    res.json({
      ok: true,
      todayEarnings:    Number((todayEarningsCents  / 100).toFixed(2)),
      monthEarnings:    Number((monthEarningsCents  / 100).toFixed(2)),
      completedThisMonth,
      upcomingBookings: upcomingCount,
      missedThisWeek:   missedCount,
      alerts,
      optimizationSuggestions: suggestions,
      _source: 'booking_requests_v2',
    });
  } catch (err: any) {
    logger.error('[ProviderDashboardV2] /intelligence error', err);
    res.status(500).json({ ok: false, error: 'Failed to load intelligence data' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — V2 ACTION ROUTES (writes to booking_requests, not bookings)
// These replace the V1 action handlers for the provider lifecycle.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Status transition table ───────────────────────────────────────────────────
// Defines EXACTLY which statuses each action is allowed to transition FROM.
const ALLOWED_FROM: Record<string, string[]> = {
  // meet_greet_* included 2026-07-30: a customer asking for a meet & greet
  // previously locked the provider OUT of accepting on this (live) path —
  // the V1 state machine always allowed it.
  accept:   ['pending', 'accepted', 'meet_greet_requested', 'meet_greet_scheduled', 'meet_greet_completed'],
  decline:  ['pending', 'accepted', 'meet_greet_requested', 'meet_greet_scheduled'],
  cancel:   ['accepted', 'confirmed', 'in_progress',
             'meet_greet_scheduled', 'meet_greet_completed', 'payment_pending'],
  start:    ['confirmed'],
  complete: ['in_progress'],
  report:   ['pending', 'accepted', 'confirmed', 'in_progress'],
};

// Target status for each action
const TO_STATUS: Record<string, string> = {
  // 2026-07-30: accept lands in 'accepted', NOT 'confirmed'. 'confirmed' means
  // "payment verified" — jumping straight there dead-ended the canonical /pay
  // rail (its guard requires 'accepted') and marked bookings paid with zero
  // money moved. The Nayax payment webhook is the only writer of 'confirmed'.
  accept:   'accepted',
  decline:  'declined',
  cancel:   'cancelled',
  start:    'in_progress',
  // SECURITY (2026-07-08): provider 'complete' must NOT jump straight to the
  // payable 'completed' state. That let a provider self-serve a booking into a
  // payout-eligible status (payoutGate COMPLETED_STATUSES) with no customer
  // confirmation. It now lands in the dual-approval gate 'provider_marked_complete'
  // (exactly like the V1 path, booking-requests.ts:2255). The customer confirms
  // via POST /api/booking-requests/:id/confirm → 'completed' + escrow release, or
  // the auto-approve cron (server/cron/auto-approve-completions.ts) advances it
  // after 24h of customer inaction so the provider is never trapped unpaid.
  complete: 'provider_marked_complete',
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

    // Fetch + ownership check in one query — include owner_id/request_id for downstream notifications
    const fetchResult = await pool.query(
      `SELECT id, status, provider_id, owner_id, request_id, service_type, quote_breakdown,
              start_date, end_date, finance_state, wallet_hold_cents
       FROM booking_requests WHERE id = $1 AND provider_id = $2`,
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

    // ── ACCEPT SAFETY GATES (2026-07-03, CEO-approved) ──────────────────────────
    // This V2 action path previously let a provider accept a job with NONE of the
    // vetting gates V1 (/api/booking-requests/:id/respond) enforces — so an
    // un-background-checked or un-approved provider could take a real booking.
    // Port V1's two ALWAYS-ON hard gates here, fail-closed, so both accept paths
    // apply the same safety rules. (V1's flag-gated reconfirmation/declarations
    // gates default to shadow/off and remain V1-only for now — no live gap.)
    if (action === 'accept') {
      // Gate 1 — background check must be approved.
      const [profile] = await db
        .select({ backgroundCheckStatus: providerProfiles.backgroundCheckStatus })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, user.uid))
        .limit(1);
      if (!profile || profile.backgroundCheckStatus !== 'approved') {
        logger.warn('[ProviderV2] accept blocked — BGC not approved', {
          providerId: user.uid, backgroundCheckStatus: profile?.backgroundCheckStatus,
        });
        return res.status(403).json({
          error: 'BACKGROUND_CHECK_REQUIRED',
          message: 'Your background check must be approved before you can accept bookings.',
        });
      }
      // Gate 2 — per-service booking approval (legacy fail-open ONLY when the
      // provider has zero provider_services rows; block if they have rows and this
      // service isn't approved; on a genuine lookup failure fail-closed with 503).
      try {
        const gate = await assertServiceApproved(user.uid, booking.service_type, 'booking');
        if (!gate.ok) {
          const hasRows = await providerHasAnyServiceRows(user.uid);
          if (hasRows) {
            logger.warn('[ProviderV2] accept blocked — service not approved for booking', {
              providerId: user.uid, serviceType: booking.service_type, reason: gate.reason,
            });
            return res.status(403).json({
              error: 'SERVICE_NOT_APPROVED_FOR_BOOKING',
              message: 'This service is not yet approved for bookings on your account. Contact PetWash support.',
              reason: gate.reason,
            });
          }
          logger.info('[ProviderV2] provider has no provider_services rows — legacy fail-open allow', {
            providerId: user.uid, serviceType: booking.service_type,
          });
        }
      } catch (gateErr: any) {
        logger.error('[ProviderV2] booking-gate lookup error', { error: gateErr?.message, providerId: user.uid });
        try {
          const hasRows = await providerHasAnyServiceRows(user.uid);
          if (hasRows) {
            return res.status(503).json({ error: 'SERVICE_GATE_UNAVAILABLE', message: 'Could not verify service approval. Please retry.' });
          }
        } catch { /* double failure → legacy-allow (no rows assumed) */ }
      }
    }

    const now = new Date();
    const { reason } = req.body;

    // ── Double-booking guard on accept (2026-07-30): V1's overlap check was
    // never ported to this live path — a provider could accept two overlapping
    // requests. Same BLOCKING_STATUSES source as V1 (booking-requests.ts).
    if (action === 'accept' && booking.start_date && booking.end_date) {
      const overlap = await pool.query(
        `SELECT id FROM booking_requests
         WHERE provider_id = $1 AND id != $2
           AND status = ANY($3::booking_request_status[])
           AND start_date <= $4 AND end_date >= $5
         LIMIT 1`,
        [user.uid, bookingId, BLOCKING_STATUSES, booking.end_date, booking.start_date],
      );
      if (overlap.rows.length > 0) {
        return res.status(409).json({
          error: 'You already have a booking that overlaps these dates.',
          code: 'PROVIDER_DOUBLE_BOOKING',
        });
      }
    }

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
      // Stamp BOTH timestamps like the V1 mark-complete path
      // (booking-requests.ts:2255): service_completed_at drives the payout
      // refund window; provider_completed_at is what the auto-approve cron keys
      // its 24-hour dual-approval window off of.
      setClauses.push(`service_completed_at = $${p++}`);
      params.push(now);
      setClauses.push(`provider_completed_at = $${p++}`);
      params.push(now);
    }

    // WHERE re-checks id + provider_id + STATUS atomically. The status
    // predicate is the actual TOCTOU close (2026-07-30): the pre-fetched
    // status was checked outside any lock, so two concurrent taps could both
    // pass the ALLOWED_FROM check — the row-level status match makes exactly
    // one of them win.
    params.push(bookingId);   // $p
    params.push(user.uid);    // $p+1
    params.push(allowed);     // $p+2

    const updateResult = await pool.query(
      `UPDATE booking_requests
       SET ${setClauses.join(', ')}
       WHERE id = $${p} AND provider_id = $${p + 1} AND status = ANY($${p + 2}::booking_request_status[])
       RETURNING id, status, cancellation_reason, service_started_at,
                 service_completed_at, cancelled_at, updated_at`,
      params,
    );

    if (updateResult.rows.length === 0) {
      // The row's status changed between fetch and update (concurrent action).
      return res.status(409).json({
        error: 'This booking was just updated by another action. Refresh and try again.',
        code: 'RACE_CONDITION',
      });
    }

    const updated = updateResult.rows[0];

    // ── Legacy bridge sync (2026-07-24) ───────────────────────────────────────
    // Sitter/Walk bookings created by the legacy flows are mirrored into
    // booking_requests so the provider can see them. When the provider answers,
    // write the decision BACK to the customer-side row, otherwise the customer
    // keeps seeing "waiting for provider" forever. Fail-soft by design.
    if (action === 'accept' || action === 'decline') {
      try {
        const { applyBridgeDecision } = await import('../services/legacyBookingBridge');
        await applyBridgeDecision(booking.quote_breakdown, action);
      } catch { /* canonical row already updated */ }
    }
    // COMPLETION sync (2026-07-31): when the provider marks the job complete,
    // write 'completed' back to the legacy customer-side row too — otherwise the
    // customer's My Bookings stayed 'accepted' forever and could never review.
    if (action === 'complete') {
      try {
        const { applyBridgeCompletion } = await import('../services/legacyBookingBridge');
        // Pass the canonical newStatus ('provider_marked_complete') — NOT a hardcoded
        // 'completed'. The legacy row now honestly mirrors "provider marked done,
        // awaiting your confirmation"; the customer's approve-completion writes the
        // real 'completed' that opens the review gate.
        await applyBridgeCompletion(booking.quote_breakdown, newStatus);
      } catch { /* canonical row already updated */ }
    }

    // ── Wallet lifecycle parity with V1 (2026-07-30): V2 never touched
    // finance_state, so a customer's wallet hold was neither debited on accept
    // nor released on decline — money frozen forever. Mirrors V1
    // (booking-requests.ts /respond): accept → debit from hold, decline →
    // release hold. Fail-visible via *_failed states, same as V1.
    const requestIdStr: string | undefined = booking.request_id;
    const holdCents = Number(booking.wallet_hold_cents) || 0;
    if ((action === 'accept' || action === 'decline') && booking.finance_state === 'hold_active' && holdCents > 0 && requestIdStr) {
      const svcType = String(booking.service_type || '');
      const divisionCode =
        svcType.includes('sit') ? 'petsitter' :
        svcType.includes('walk') ? 'walkers' :
        svcType.includes('train') ? 'academy' : 'general';
      setImmediate(async () => {
        try {
          if (action === 'accept') {
            const debitResult = await walletService.debitBookingFromHold({
              userId: booking.owner_id, amountCents: holdCents, bookingId: requestIdStr,
              divisionCode: divisionCode as any, ipAddress: req.ip ?? null,
            });
            await db.update(bookingRequests)
              .set({ walletDebitedCents: holdCents, walletDebitKey: debitResult.txnId, financeState: 'debited', updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestIdStr));
          } else {
            const releaseResult = await walletService.releaseBookingHold({
              userId: booking.owner_id, amountCents: holdCents, bookingId: requestIdStr,
              divisionCode: divisionCode as any, ipAddress: req.ip ?? null,
            });
            await db.update(bookingRequests)
              .set({ walletReleaseKey: releaseResult.txnId, financeState: 'released', updatedAt: new Date() })
              .where(eq(bookingRequests.requestId, requestIdStr));
          }
        } catch (walletErr: any) {
          logger.error('[ProviderDashboardV2] Wallet lifecycle error on provider response', {
            requestId: requestIdStr, action, error: walletErr.message,
          });
          const failedState = action === 'accept' ? 'debit_failed' : 'release_failed';
          await db.update(bookingRequests)
            .set({ financeState: failedState, updatedAt: new Date() })
            .where(eq(bookingRequests.requestId, requestIdStr))
            .catch(() => {});
        }
      });
    }

    // ── Slot-lock release on decline/cancel (2026-07-30): V2 never released
    // the EXCLUDE slot lock, so every decline poisoned that provider's
    // calendar window forever. Bridged bookings created their lock under the
    // LEGACY booking ref (SITTER_… / WALK_… / trainer bookingId), so release
    // both keys. Idempotent, best-effort — over-blocking is safer than
    // double-booking, but a declined slot must free up.
    if (action === 'decline' || action === 'cancel') {
      if (requestIdStr) {
        await releaseSlotLock(db, requestIdStr)
          .catch((e: any) => logger.warn('[ProviderDashboardV2] slot-lock release failed', { requestId: requestIdStr, error: e?.message }));
      }
      const legacyId = booking.quote_breakdown?.legacyRef?.id;
      if (legacyId != null) {
        await releaseSlotLock(db, String(legacyId))
          .catch((e: any) => logger.warn('[ProviderDashboardV2] legacy slot-lock release failed', { legacyId, error: e?.message }));
      }
    }

    // ── Customer notification on accept / decline ──────────────────────────────
    // The V1 /respond route does this; we mirror it here so the V2 fast-action
    // path in ProviderTaskInbox has identical side-effects.
    if (action === 'accept' || action === 'decline') {
      const isAccept = action === 'accept';
      const ownerId    = booking.owner_id   as string | undefined;
      const requestId  = booking.request_id as string | undefined;
      const serviceTypeLbl = booking.service_type as string | undefined;

      if (ownerId) {
        try {
          await db.insert(superAppNotifications).values({
            userId:    ownerId,
            type:      isAccept ? 'booking_accepted' : 'booking_declined',
            title:     isAccept ? '✅ הספק אישר את הבקשה!' : 'הספק אינו זמין בתאריכים אלה',
            titleHe:   isAccept ? '✅ הספק אישר את הבקשה!' : 'הספק אינו זמין בתאריכים אלה',
            body:      isAccept
              ? 'ההזמנה שלך אושרה — שוחח עם הספק עכשיו והכן את הפגישה.'
              : 'אל דאגה — יש לנו ספקים נוספים שיוכלו לעזור. חפש עכשיו.',
            bodyHe:    isAccept
              ? 'ההזמנה שלך אושרה — שוחח עם הספק עכשיו והכן את הפגישה.'
              : 'אל דאגה — יש לנו ספקים נוספים שיוכלו לעזור. חפש עכשיו.',
            actionUrl:  requestId ? `/booking/confirmation/${requestId}` : '/my-bookings',
            actionType: isAccept ? 'open_booking_chat' : 'open_booking',
            channels:  ['in_app'],
            isRead:    false,
            createdAt: new Date(),
          } as any);
          logger.info(`[ProviderDashboardV2] Customer notification sent`, {
            ownerId, action, bookingId, requestId,
          });
        } catch (notifErr: any) {
          logger.warn('[ProviderDashboardV2] Customer notification insert failed', {
            error: notifErr.message, bookingId,
          });
        }

        // Off-app channels (2026-07-30): the in-app row above only reaches a
        // customer who opens the app — V1 also sends email+SMS, and this is
        // the LIVE provider path, so mirror it. The dispatcher resolves the
        // customer's email/phone from their uid. Accept now lands in
        // 'accepted' (payment still required), so the accept message says
        // PAY-TO-CONFIRM — not "confirmed".
        const confirmUrl = `https://petwash.co.il/booking/confirmation/${requestId ?? bookingId}`;
        dispatchNotification({
          uid: ownerId,
          type: isAccept ? 'booking_accepted' : 'booking_declined',
          title: isAccept ? '✅ הספק אישר — נותר רק לשלם' : 'הספק אינו זמין בתאריכים אלה',
          bodyHtml: isAccept
            ? `<p>הספק אישר את הבקשה שלך! כדי לסגור את ההזמנה סופית, השלימו את התשלום עכשיו.</p><p><a href="${confirmUrl}">להשלמת התשלום ואישור ההזמנה</a></p>`
            : `<p>הספק אינו זמין בתאריכים המבוקשים. אל דאגה — יש לנו ספקים נוספים שישמחו לעזור.</p><p><a href="https://petwash.co.il/marketplace">חיפוש ספק זמין</a></p>`,
          bodyText: isAccept
            ? `PetWash: הספק אישר את הבקשה! השלימו תשלום לאישור סופי: ${confirmUrl}`
            : `PetWash: הספק אינו זמין בתאריכים אלה. חפשו ספק זמין: https://petwash.co.il/marketplace`,
          ctaText: isAccept ? 'להשלמת התשלום' : 'חיפוש ספק',
          ctaUrl: confirmUrl,
          channels: ['email', 'sms'],
          priority: 5,
          meta: { bookingId: requestId ?? String(bookingId), action },
        }).catch((e: any) =>
          logger.warn('[ProviderDashboardV2] off-app customer notification failed', { error: e?.message, bookingId }),
        );

        // For decline: schedule 1-hour recovery nudge (same as V1)
        if (!isAccept) {
          scheduleRebookTrigger('declined_recovery', {
            userId:      ownerId,
            requestId:   requestId ?? String(bookingId),
            providerId:  user.uid,
            serviceType: serviceTypeLbl,
            delayMs:     60 * 60 * 1000,
          }).catch((e: any) =>
            logger.warn('[RebookScheduler] declined_recovery schedule failed (v2)', {
              error: e.message,
            }),
          );
        }
      }
    }

    // ── Customer notification on start (2026-08-18 parity gap fix) ───────────
    // V1 /:requestId/start (PR #1922) notifies the customer their service began.
    // V2 was silent. ProviderJobDetail's "Start Job" button calls V2, so a
    // customer whose provider actually kicked off the walk/sit got zero signal.
    if (action === 'start') {
      const ownerId = booking.owner_id as string | undefined;
      const requestId = booking.request_id as string | undefined;
      if (ownerId && requestId) {
        setImmediate(async () => {
          try {
            await dispatchNotification({
              uid: ownerId,
              type: 'system',
              title: '🐾 השירות התחיל · Service started — PetWash™',
              bodyHtml:
                `<p>הספק דיווח שהשירות עבור הזמנה <strong>${requestId}</strong> החל. תוכלי לעקוב אחרי ההתקדמות באפליקציה.</p>` +
                `<p>The provider marked the service for booking <strong>${requestId}</strong> as started. You can follow the progress in the app.</p>`,
              ctaText: 'צפי במעקב חי / View live',
              ctaUrl: `https://petwash.co.il/booking/confirmation/${requestId}`,
              channels: ['inbox', 'email', 'push'],
              priority: 7,
              meta: { bookingId: requestId, actionType: 'service_started' },
            });
          } catch (notifErr: any) {
            logger.warn('[ProviderDashboardV2] service_started notify failed', { error: notifErr.message });
          }
        });
      }
    }

    // ── Counterparty notification on cancel (2026-08-18 parity gap fix) ──────
    // V1 /:requestId/cancel fires superAppNotifications + FCM push. V2 was
    // silent — a provider using the app to cancel left the customer in the
    // dark. Notify the customer with inbox + push (email deliberately omitted
    // — cancel is often followed by an immediate rebook flow; email would
    // land after the customer's already searching).
    if (action === 'cancel') {
      const ownerId = booking.owner_id as string | undefined;
      const requestId = booking.request_id as string | undefined;
      if (ownerId && requestId) {
        setImmediate(async () => {
          try {
            await dispatchNotification({
              uid: ownerId,
              type: 'system',
              title: '⚠️ הספק ביטל את ההזמנה · Provider cancelled — PetWash™',
              bodyHtml:
                `<p>הספק ביטל את הזמנתך <strong>${requestId}</strong>. אנחנו כאן כדי לעזור לך למצוא ספק חלופי.</p>` +
                `<p>The provider cancelled your booking <strong>${requestId}</strong>. We're here to help you find another provider.</p>`,
              ctaText: 'מצאי ספק חלופי / Find another provider',
              ctaUrl: `https://petwash.co.il/marketplace`,
              channels: ['inbox', 'push'],
              priority: 8,
              meta: { bookingId: requestId, actionType: 'provider_cancelled' },
            });
          } catch (notifErr: any) {
            logger.warn('[ProviderDashboardV2] provider_cancelled notify failed', { error: notifErr.message });
          }
        });
      }
    }

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

// ── GET /api/provider-dashboard/v2/marketplace-bookings ───────────────────────
// Returns bookings from the marketplace (bookings table) with their addon items.
// Used by ProviderTaskInbox to show addon chips per booking.
router.get('/marketplace-bookings', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { limit = '20', offset = '0' } = req.query;

    const result = await pool.query(
      `SELECT
         b.id,
         b.booking_number,
         b.service_type,
         b.start_time,
         b.end_time,
         b.subtotal,
         b.platform_fee,
         b.provider_payout,
         b.total,
         b.currency,
         b.status,
         b.payout_status,
         b.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'name', bi.name,
               'unitPrice', bi.unit_price,
               'totalPrice', bi.total_price
             )
           ) FILTER (WHERE bi.id IS NOT NULL),
           '[]'
         ) AS addon_items
       FROM bookings b
       LEFT JOIN booking_items bi
         ON bi.booking_id = b.id AND bi.item_type = 'addon'
       WHERE b.provider_id = $1
          -- Legacy rows (before 2026-07-24) stored the numeric provider-PROFILE
          -- id here instead of the uid; match those too so bookings already
          -- taken are not invisible forever.
          OR b.provider_id IN (
               SELECT p.id::text FROM providers p WHERE p.user_id = $1
             )
       GROUP BY b.id
       ORDER BY b.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.uid, parseInt(limit as string) || 20, parseInt(offset as string) || 0],
    );

    const ADDON_LABELS: Record<string, { en: string; he: string }> = {
      pickup:   { en: 'Pet Pickup',  he: 'איסוף' },
      dropoff:  { en: 'Drop-off',    he: 'החזרה' },
      grooming: { en: 'Grooming',    he: 'טיפוח' },
    };

    const rows = result.rows.map((r) => ({
      id:             r.id,
      bookingNumber:  r.booking_number,
      serviceType:    r.service_type,
      startTime:      r.start_time,
      endTime:        r.end_time,
      subtotal:       r.subtotal,
      platformFee:    r.platform_fee,
      providerPayout: r.provider_payout,
      total:          r.total,
      currency:       r.currency ?? 'ILS',
      status:         r.status,
      payoutStatus:   r.payout_status ?? 'pending',
      createdAt:      r.created_at,
      addons: (r.addon_items as any[]).map((ai) => ({
        code:       ai.name,
        labelEn:    ADDON_LABELS[ai.name]?.en ?? ai.name,
        labelHe:    ADDON_LABELS[ai.name]?.he ?? ai.name,
        unitPrice:  ai.unitPrice ?? ai.unit_price ?? '0.00',
      })),
    }));

    logger.info('[ProviderDashboardV2] GET /marketplace-bookings', { uid: user.uid, count: rows.length });

    res.json({ success: true, bookings: rows, _source: 'bookings' });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /marketplace-bookings error', error);
    res.status(500).json({ error: 'Failed to load marketplace bookings' });
  }
});

// ─── GET /provider-dashboard/v2/feedback ────────────────────────────────────
// Provider: fetch reviews left on their marketplace bookings
router.get('/feedback', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.split('Bearer ')[1];
    const user = await auth.verifyIdToken(token, true);

    const { rows } = await pool.query(
      `SELECT
         mr.id,
         mr.booking_id,
         mr.overall_rating,
         mr.review_text,
         mr.is_flagged,
         mr.created_at,
         b.platform_id,
         b.status AS booking_status,
         b.start_time
       FROM marketplace_reviews mr
       JOIN bookings b ON b.id = mr.booking_id
       WHERE mr.provider_id = $1 AND mr.is_visible = TRUE
       ORDER BY mr.created_at DESC
       LIMIT 50`,
      [user.uid]
    );

    const statsRow = await pool.query(
      `SELECT
         ROUND(AVG(overall_rating)::numeric, 1) AS avg_rating,
         COUNT(*) AS review_count,
         COUNT(*) FILTER (WHERE is_flagged = TRUE) AS flagged_count
       FROM marketplace_reviews
       WHERE provider_id = $1 AND is_visible = TRUE`,
      [user.uid]
    );

    const s = statsRow.rows[0];
    res.json({
      success: true,
      stats: {
        avgRating: s?.avg_rating ? parseFloat(s.avg_rating) : null,
        reviewCount: parseInt(s?.review_count || '0', 10),
        flaggedCount: parseInt(s?.flagged_count || '0', 10),
      },
      reviews: rows.map((r: any) => ({
        id: r.id,
        bookingId: r.booking_id,
        rating: r.overall_rating,
        text: r.review_text,
        isFlagged: r.is_flagged,
        platformId: r.platform_id,
        bookingStatus: r.booking_status,
        startTime: r.start_time,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /feedback error', error);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
});

// ── POST /api/provider-dashboard/v2/payout-request ───────────────────────────
// Providers submit a bank payout request. Stored in Firestore for admin review.
router.post('/payout-request', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    const { amountIls, iban, bankName } = req.body;
    if (!amountIls || !iban) {
      return res.status(400).json({ error: 'amountIls and iban are required' });
    }
    const amount = parseFloat(amountIls);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payout amount' });
    }
    // SECURITY (sweep 2026-07-13): the client `amountIls` is only a REQUESTED cap — it
    // must never become the amount of record unchecked. Clamp against the provider's
    // real available balance (completed/reviewed bookings not yet paid out) and reject
    // an over-request, so a future processor/admin can trust this record.
    const balRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN status IN ('completed','reviewed') AND payout_status != 'paid_out'
                THEN provider_payout_cents ELSE 0 END), 0)::bigint AS available_cents
         FROM booking_requests WHERE provider_id = $1`,
      [user.uid],
    );
    const availableCents = Number(balRes.rows[0]?.available_cents ?? 0);
    const requestedCents = Math.round(amount * 100);
    if (requestedCents > availableCents) {
      return res.status(400).json({
        error: 'Requested amount exceeds your available payout balance.',
        availableIls: Number((availableCents / 100).toFixed(2)),
      });
    }
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const docRef = await firestore.collection('payout_requests').add({
      providerId: user.uid,
      amountIls: amount,
      availableAtRequestIls: Number((availableCents / 100).toFixed(2)),
      iban: iban.trim(),
      bankName: bankName?.trim() || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    logger.info('[ProviderDashboardV2] Payout request created', { uid: user.uid, amountIls: amount, requestId: docRef.id });
    res.json({ success: true, requestId: docRef.id, status: 'pending' });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /payout-request error', error);
    res.status(500).json({ error: 'Failed to submit payout request' });
  }
});

// ── POST /api/provider-dashboard/v2/safety-report ────────────────────────────
// Providers submit a safety incident report. Stored in Firestore for safety team review.
router.post('/safety-report', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    const { incidentType, bookingRef, description } = req.body;
    if (!incidentType || !description) {
      return res.status(400).json({ error: 'incidentType and description are required' });
    }
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const docRef = await firestore.collection('provider_safety_reports').add({
      providerId: user.uid,
      incidentType,
      bookingRef: bookingRef?.trim() || null,
      description,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    logger.info('[ProviderDashboardV2] Safety report submitted', { uid: user.uid, incidentType, reportId: docRef.id });
    res.json({ success: true, reportId: docRef.id, status: 'open' });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /safety-report error', error);
    res.status(500).json({ error: 'Failed to submit safety report' });
  }
});

// ── GET /api/provider-dashboard/v2/blocked-clients ───────────────────────────
// Returns the provider's blocked client list from Firestore.
router.get('/blocked-clients', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const snapshot = await firestore.collection('provider_blocked_clients')
      .where('providerId', '==', user.uid)
      .where('status', '==', 'blocked')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const blockedClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, blockedClients });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /blocked-clients GET error', error);
    res.status(500).json({ error: 'Failed to fetch blocked clients' });
  }
});

// ── POST /api/provider-dashboard/v2/block-client ──────────────────────────────
// Provider blocks a client. Stored in Firestore; prevents re-booking from that client.
router.post('/block-client', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    const { clientIdentifier, reason } = req.body;
    if (!clientIdentifier) {
      return res.status(400).json({ error: 'clientIdentifier is required' });
    }
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const docRef = await firestore.collection('provider_blocked_clients').add({
      providerId: user.uid,
      clientIdentifier: clientIdentifier.trim(),
      reason: reason?.trim() || null,
      status: 'blocked',
      createdAt: new Date().toISOString(),
    });
    logger.info('[ProviderDashboardV2] Client blocked', { uid: user.uid, clientIdentifier, blockId: docRef.id });
    res.json({ success: true, blockId: docRef.id });
  } catch (error) {
    logger.error('[ProviderDashboardV2] /block-client error', error);
    res.status(500).json({ error: 'Failed to block client' });
  }
});

export default router;

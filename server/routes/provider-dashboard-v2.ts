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
import { bookingRequests, providers, superAppNotifications } from '@shared/schema';
import { eq, sql, count, desc, inArray, and, gte, lte } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { pool } from '../db';
import { scheduleRebookTrigger } from '../jobs/rebook-scheduler';

const router = Router();

// ── Auth helper ───────────────────────────────────────────────────────────────
// DEV-ONLY: accepts x-test-provider-uid header to bypass Firebase token verification.
// Hard-rejected in production so it can never be exploited in a live environment.
async function getAuthenticatedUser(req: Request, res: Response) {
  if (process.env.NODE_ENV !== 'production') {
    const testUid = req.headers['x-test-provider-uid'] as string | undefined;
    if (testUid) {
      logger.warn('[ProviderDashboardV2] DEV AUTH BYPASS — x-test-provider-uid', { testUid });
      return { uid: testUid } as any;
    }
  }

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

    const [totals, recents] = await Promise.all([
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
    ]);

    const row = totals.rows[0] ?? {};
    const toILS = (c: number | string) => Number((Number(c) / 100).toFixed(2));

    res.json({
      success: true,
      earnings: {
        totalEarnings:     toILS(row.total_earnings_cents),
        paidPayouts:       toILS(row.paid_payouts_cents),
        pendingPayouts:    toILS(row.pending_payouts_cents),
        thisWeekEarnings:  toILS(row.this_week_cents),
        thisMonthEarnings: toILS(row.this_month_cents),
        lastMonthEarnings: toILS(row.last_month_cents),
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

    // Fetch + ownership check in one query — include owner_id/request_id for downstream notifications
    const fetchResult = await pool.query(
      `SELECT id, status, provider_id, owner_id, request_id, service_type
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
    const { getFirestore } = await import('firebase-admin/firestore');
    const firestore = getFirestore();
    const docRef = await firestore.collection('payout_requests').add({
      providerId: user.uid,
      amountIls: amount,
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

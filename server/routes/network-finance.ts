/**
 * server/routes/network-finance.ts
 * Phase 11.5 — Hybrid Ownership Model (Clean Path, two-segment routes)
 *
 * Route shape:
 *   /api/network/:ownerType/:ownerId/finance/summary
 *   /api/network/:ownerType/:ownerId/stations/financials
 *   /api/network/:ownerType/:ownerId/payouts
 *   /api/network/:ownerType/:ownerId/audit-feed
 *
 * ownerType = 'franchise' | 'company'
 * ownerId   = integer franchise PK (for franchise) | any string, e.g. 'main' (for company)
 *
 * Examples:
 *   GET /api/network/franchise/12/finance/summary
 *   GET /api/network/company/main/stations/financials
 *
 * Financial logic branches on ownership_type (DB-enforced CHECK constraint):
 *   'company'   → franchise_amount is always 0 (internal accounting only)
 *   'franchise' → standard three-way split: platform + franchise + station
 *
 * Auth:
 *   ownerType = 'company'   → x-admin-secret OR Firebase admin claim
 *   ownerType = 'franchise' → x-admin-secret OR verified franchise owner token
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';

const router = Router({ mergeParams: true });

const IL_TZ = 'Asia/Jerusalem';
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

// ─── Auth + scope middleware ───────────────────────────────────────────────────

/**
 * Reads :ownerType and :ownerId from the URL and attaches scope to the request:
 *   (req as any).ownerType:  'company' | 'franchise'
 *   (req as any).ownerIdInt: number | null  (franchise ID for franchise; null for company)
 *
 * Valid URL shapes:
 *   /api/network/franchise/12/...    → ownerType=franchise, ownerIdInt=12
 *   /api/network/company/main/...    → ownerType=company,   ownerIdInt=null
 *
 * Auth rules:
 *   company   → x-admin-secret OR Firebase admin claim
 *   franchise → x-admin-secret OR verified franchise owner in franchise_owners table
 */
async function requireNetworkOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const ownerType = req.params.ownerType;

    // Validate ownerType — DB has a CHECK constraint for the same values
    if (ownerType !== 'franchise' && ownerType !== 'company') {
      return res.status(400).json({ error: 'invalid_owner_type', valid: ['franchise', 'company'] });
    }

    const isCompany = ownerType === 'company';

    if (!isCompany) {
      const parsed = parseInt(req.params.ownerId, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'invalid_owner_id' });
      }
      (req as any).ownerIdInt = parsed;
    } else {
      (req as any).ownerIdInt = null;
    }
    (req as any).ownerType = ownerType;

    // Admin bypass via header secret (works for both company and franchise)
    const adminHeader = req.headers['x-admin-secret'];
    if (adminHeader && adminHeader === ADMIN_SECRET) return next();

    // Bearer token path
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    const token = authHeader.slice(7);
    const decoded = await auth.verifyIdToken(token, true);
    const uid = decoded.uid;

    if (isCompany) {
      // Company view requires admin Firebase claim
      if (!decoded.admin) {
        return res.status(403).json({ error: 'company_admin_required' });
      }
      return next();
    }

    // Franchise: ownership check against franchise_owners table
    const franchiseId = (req as any).ownerIdInt as number;
    const ownerCheck = await db.execute(sql`
      SELECT id FROM franchise_owners
      WHERE id = ${franchiseId}
        AND owner_user_id = ${uid}
        AND status = 'active'
      LIMIT 1
    `);

    if (!ownerCheck.rows.length) {
      return res.status(403).json({ error: 'access_denied' });
    }

    next();
  } catch (err: any) {
    logger.error('[NetworkFinance] auth error', { error: err.message });
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toILS = (cents: unknown): number =>
  cents != null && cents !== '' ? Math.round(Number(cents)) / 100 : 0;

const toInt = (v: unknown): number => Number(v ?? 0);

// ─── Station scope CTE fragment ───────────────────────────────────────────────
// Returns a sql fragment for the franchise_stations CTE body, scoped to either
// company-owned stations OR a specific franchise's stations.
//
// Usage inside a query:
//   WITH franchise_stations AS (${stationScopeCTE(req)})
//
function stationScopeCTE(req: Request) {
  const ownerType = (req as any).ownerType as 'company' | 'franchise';
  const ownerIdInt = (req as any).ownerIdInt as number | null;

  if (ownerType === 'company') {
    return sql`
      SELECT st.id, st.name, st.station_code, st.ownership_type
      FROM stations st
      WHERE st.is_active = true
        AND st.ownership_type = 'company'
    `;
  }

  // Franchise: explicit FK link OR settlement-based discovery
  return sql`
    SELECT st.id, st.name, st.station_code, st.ownership_type
    FROM stations st
    WHERE st.is_active = true
      AND (
        st.franchise_id = ${ownerIdInt}
        OR EXISTS (
          SELECT 1 FROM station_settlements sx
          WHERE sx.station_id = st.id
            AND sx.franchise_owner_id = ${ownerIdInt}
        )
      )
  `;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/network/:ownerId/finance/summary
 *
 * Three-window financial summary (today / mtd / last30).
 * For company-owned stations: franchiseShare is always 0 (internal accounting).
 * For franchise stations: standard three-way split.
 *
 * ownershipType included in response so the caller can render appropriately.
 */
router.get('/:ownerType/:ownerId/finance/summary', requireNetworkOwner, async (req: Request, res: Response) => {
  try {
    const ownerType = (req as any).ownerType as string;
    const ownerIdInt = (req as any).ownerIdInt as number | null;

    // Settlement filter for company: all company station settlements (no franchise_owner_id)
    // For franchise: filter by franchise_owner_id
    const settlementFilter =
      ownerType === 'company'
        ? sql`EXISTS (
            SELECT 1 FROM franchise_stations fs WHERE fs.id = ss.station_id
          )`
        : sql`ss.franchise_owner_id = ${ownerIdInt}`;

    const result = await db.execute(sql`
      WITH franchise_stations AS (${stationScopeCTE(req)})
      SELECT
        -- ── TODAY ─────────────────────────────────────────────────────────────
        COALESCE(SUM(total_amount_cents)    FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint AS today_gross_cents,
        COALESCE(SUM(platform_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint AS today_platform_cents,
        COALESCE(SUM(franchise_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint AS today_franchise_cents,
        COALESCE(SUM(station_amount_cents)  FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint AS today_station_cents,
        COUNT(*) FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int AS today_booking_count,
        COUNT(*) FILTER (
          WHERE status = 'settled'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int AS today_settled_count,
        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int AS today_pending_count,
        COUNT(*) FILTER (
          WHERE status = 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int AS today_disputed_count,
        COALESCE(SUM(total_amount_cents) FILTER (
          WHERE status = 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint AS today_disputed_cents,

        -- ── MTD ───────────────────────────────────────────────────────────────
        COALESCE(SUM(total_amount_cents)    FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint AS mtd_gross_cents,
        COALESCE(SUM(platform_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint AS mtd_platform_cents,
        COALESCE(SUM(franchise_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint AS mtd_franchise_cents,
        COALESCE(SUM(station_amount_cents)  FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint AS mtd_station_cents,
        COUNT(*) FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int AS mtd_booking_count,
        COUNT(*) FILTER (
          WHERE status = 'settled'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int AS mtd_settled_count,
        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int AS mtd_pending_count,
        COUNT(*) FILTER (
          WHERE status = 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int AS mtd_disputed_count,
        COALESCE(SUM(total_amount_cents) FILTER (
          WHERE status = 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint AS mtd_disputed_cents,

        -- ── LAST 30 ───────────────────────────────────────────────────────────
        COALESCE(SUM(total_amount_cents)    FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint AS l30_gross_cents,
        COALESCE(SUM(platform_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint AS l30_platform_cents,
        COALESCE(SUM(franchise_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint AS l30_franchise_cents,
        COALESCE(SUM(station_amount_cents)  FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint AS l30_station_cents,
        COUNT(*) FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int AS l30_booking_count,
        COUNT(*) FILTER (
          WHERE status = 'settled'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int AS l30_settled_count,
        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int AS l30_pending_count,
        COUNT(*) FILTER (
          WHERE status = 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int AS l30_disputed_count,
        COALESCE(SUM(total_amount_cents) FILTER (
          WHERE status = 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint AS l30_disputed_cents

      FROM station_settlements ss
      WHERE ${settlementFilter}
    `);

    const r = result.rows[0] as any;
    const win = (prefix: string) => ({
      grossRevenue:   toILS(r[`${prefix}_gross_cents`]),
      platformFees:   toILS(r[`${prefix}_platform_cents`]),
      franchiseShare: toILS(r[`${prefix}_franchise_cents`]),
      stationPayouts: toILS(r[`${prefix}_station_cents`]),
      bookingCount:   toInt(r[`${prefix}_booking_count`]),
      settledCount:   toInt(r[`${prefix}_settled_count`]),
      pendingCount:   toInt(r[`${prefix}_pending_count`]),
      disputedCount:  toInt(r[`${prefix}_disputed_count`]),
      disputedAmount: toILS(r[`${prefix}_disputed_cents`]),
    });

    res.json({
      ownerId:       req.params.ownerId,
      ownerType,
      currency:      'ILS',
      // Company note: franchiseShare is always 0 — internal accounting only
      today:         win('today'),
      mtd:           win('mtd'),
      last30:        win('l30'),
    });
  } catch (err: any) {
    logger.error('[NetworkFinance] finance/summary error', { error: err.message });
    res.status(500).json({ error: 'finance_summary_failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/network/:ownerId/stations/financials?period=today|mtd|last30
 *
 * Per-station P&L. For company stations: franchiseShare is always 0.
 */
router.get('/:ownerType/:ownerId/stations/financials', requireNetworkOwner, async (req: Request, res: Response) => {
  try {
    const ownerType = (req as any).ownerType as string;
    const ownerIdInt = (req as any).ownerIdInt as number | null;

    const rawPeriod = req.query.period as string | undefined;
    const period = ['today', 'mtd', 'last30'].includes(rawPeriod ?? '') ? rawPeriod! : 'last30';

    const timeFilter =
      period === 'today'
        ? sql`(ss.created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date`
        : period === 'mtd'
        ? sql`date_trunc('month', ss.created_at AT TIME ZONE ${IL_TZ}) = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})`
        : sql`ss.created_at >= NOW() - INTERVAL '30 days'`;

    const settlementJoin =
      ownerType === 'company'
        ? sql`ss.station_id = st.id AND ${timeFilter}`
        : sql`ss.station_id = st.id AND ss.franchise_owner_id = ${ownerIdInt} AND ${timeFilter}`;

    const rows = await db.execute(sql`
      WITH franchise_stations AS (${stationScopeCTE(req)})
      SELECT
        st.id                                                           AS station_id,
        st.name                                                         AS station_name,
        st.station_code,
        st.ownership_type,

        COALESCE(SUM(ss.total_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS gross_cents,
        COALESCE(SUM(ss.platform_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS platform_cents,
        COALESCE(SUM(ss.franchise_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS franchise_cents,
        COALESCE(SUM(ss.station_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS station_cents,

        COUNT(ss.id) FILTER (WHERE ss.status != 'disputed')::int       AS booking_count,
        COUNT(ss.id) FILTER (WHERE ss.status = 'settled')::int         AS settled_count,
        COUNT(ss.id) FILTER (WHERE ss.status = 'pending')::int         AS pending_count,
        COUNT(ss.id) FILTER (WHERE ss.status = 'disputed')::int        AS disputed_count,
        COALESCE(SUM(ss.total_amount_cents)
          FILTER (WHERE ss.status = 'disputed'), 0)::bigint            AS disputed_cents

      FROM franchise_stations st
      LEFT JOIN station_settlements ss ON ${settlementJoin}
      GROUP BY st.id, st.name, st.station_code, st.ownership_type
      ORDER BY gross_cents DESC, st.name ASC
    `);

    const stations = (rows.rows as any[]).map((r) => {
      const bookingCount = toInt(r.booking_count);
      const grossRevenue = toILS(r.gross_cents);
      return {
        stationId:      toInt(r.station_id),
        stationName:    r.station_name as string,
        stationCode:    r.station_code as string,
        ownershipType:  r.ownership_type as string,
        grossRevenue,
        platformFees:   toILS(r.platform_cents),
        franchiseShare: toILS(r.franchise_cents),  // 0 for company stations
        stationPayouts: toILS(r.station_cents),
        bookingCount,
        settledCount:   toInt(r.settled_count),
        pendingCount:   toInt(r.pending_count),
        avgOrderValue:  bookingCount > 0 ? Math.round((grossRevenue / bookingCount) * 100) / 100 : 0,
        disputedCount:  toInt(r.disputed_count),
        disputedAmount: toILS(r.disputed_cents),
      };
    });

    res.json({ ownerId: req.params.ownerId, ownerType, period, currency: 'ILS', stations });
  } catch (err: any) {
    logger.error('[NetworkFinance] stations/financials error', { error: err.message });
    res.status(500).json({ error: 'stations_financials_failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/network/:ownerId/payouts?limit=12
 *
 * Payout calendar grouped by ISO week.
 *
 * Franchise: real external payouts — cycle status = pending|in_progress|completed
 * Company:   internal settlement cycles — cycle status = "internal" (no real payouts)
 */
router.get('/:ownerType/:ownerId/payouts', requireNetworkOwner, async (req: Request, res: Response) => {
  try {
    const ownerType = (req as any).ownerType as string;
    const ownerIdInt = (req as any).ownerIdInt as number | null;

    const rawLimit = parseInt(req.query.limit as string ?? '12', 10);
    const cycleLimit = isNaN(rawLimit) || rawLimit < 1 ? 12 : Math.min(rawLimit, 52);

    const settlementFilter =
      ownerType === 'company'
        ? sql`EXISTS (SELECT 1 FROM franchise_stations fs WHERE fs.id = ss.station_id)`
        : sql`ss.franchise_owner_id = ${ownerIdInt}`;

    const rows = await db.execute(sql`
      WITH franchise_stations AS (${stationScopeCTE(req)})
      SELECT
        TO_CHAR(
          date_trunc('week', ss.created_at AT TIME ZONE ${IL_TZ}),
          'IYYY-"W"IW'
        )                                                              AS cycle_id,
        (date_trunc('week', ss.created_at AT TIME ZONE ${IL_TZ}))::date AS week_start,
        (date_trunc('week', ss.created_at AT TIME ZONE ${IL_TZ})
          + INTERVAL '6 days')::date                                  AS week_end,

        COALESCE(SUM(ss.total_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint          AS gross_cents,
        COALESCE(SUM(ss.platform_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint          AS platform_cents,
        COALESCE(SUM(ss.franchise_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint          AS franchise_cents,
        COALESCE(SUM(ss.station_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint          AS station_cents,

        COUNT(*) FILTER (WHERE ss.status = 'pending')::int            AS pending_count,
        COUNT(*) FILTER (WHERE ss.status = 'settled')::int            AS settled_count,
        COUNT(*) FILTER (WHERE ss.status != 'disputed')::int          AS settlement_count,
        COUNT(*) FILTER (WHERE ss.status = 'disputed')::int           AS disputed_count,
        COALESCE(SUM(ss.total_amount_cents)
          FILTER (WHERE ss.status = 'disputed'), 0)::bigint           AS disputed_cents,
        MAX(ss.settled_at)                                             AS last_settled_at,
        BOOL_OR(
          ABS(ss.total_amount_cents
            - ss.platform_amount_cents
            - ss.franchise_amount_cents
            - ss.station_amount_cents) > 1
        )                                                              AS has_mismatch

      FROM station_settlements ss
      WHERE ${settlementFilter}
        AND ss.created_at >= NOW() - (${cycleLimit} || ' weeks')::interval
      GROUP BY cycle_id, week_start, week_end
      ORDER BY week_start DESC
      LIMIT ${cycleLimit}
    `);

    const isCompany = ownerType === 'company';

    const cycles = (rows.rows as any[]).map((r) => {
      const pendingCount = toInt(r.pending_count);
      const settledCount = toInt(r.settled_count);

      // Company-owned: no external payouts — everything is internal
      let status: string;
      if (isCompany) {
        status = 'internal';
      } else if (pendingCount > 0 && settledCount === 0) {
        status = 'pending';
      } else if (pendingCount > 0 && settledCount > 0) {
        status = 'in_progress';
      } else {
        status = 'completed';
      }

      const weekEnd = r.week_end as string;
      const weekEndDate = new Date(weekEnd);
      const defaultPayoutDate = new Date(weekEndDate);
      defaultPayoutDate.setDate(defaultPayoutDate.getDate() + 7);

      // Company cycles: no expected payout date (internal settlement only)
      let expectedPayoutDate: string | null = null;
      if (!isCompany) {
        if (status === 'completed' && r.last_settled_at) {
          expectedPayoutDate = new Date(r.last_settled_at).toISOString().slice(0, 10);
        } else {
          expectedPayoutDate = defaultPayoutDate.toISOString().slice(0, 10);
        }
      }

      return {
        cycleId:             r.cycle_id as string,
        weekStart:           r.week_start as string,
        weekEnd,
        status,
        // null for company (internal settlement cycles — no real payout date)
        expectedPayoutDate,
        grossRevenue:        toILS(r.gross_cents),
        platformFees:        toILS(r.platform_cents),
        franchiseShare:      toILS(r.franchise_cents),  // 0 for company
        stationPayouts:      toILS(r.station_cents),
        settlementCount:     toInt(r.settlement_count),
        settledCount,
        pendingCount,
        disputedCount:       toInt(r.disputed_count),
        disputedAmount:      toILS(r.disputed_cents),
        hasReconciliationMismatch: Boolean(r.has_mismatch),
      };
    });

    res.json({ ownerId: req.params.ownerId, ownerType, currency: 'ILS', cycles });
  } catch (err: any) {
    logger.error('[NetworkFinance] payouts error', { error: err.message });
    res.status(500).json({ error: 'payouts_failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/network/:ownerId/audit-feed
 *
 * Unified exception and control event stream.
 * Same five event types for both company and franchise — no ownership branching
 * needed at the operational control layer.
 *
 * Query params: since, limit, types, severity (same as T30)
 */
router.get('/:ownerType/:ownerId/audit-feed', requireNetworkOwner, async (req: Request, res: Response) => {
  try {
    const ownerType = (req as any).ownerType as string;
    const ownerIdInt = (req as any).ownerIdInt as number | null;

    const rawSince = req.query.since as string | undefined;
    let sinceDate: Date;
    if (rawSince) {
      sinceDate = new Date(rawSince);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({ error: 'invalid_since_param' });
      }
    } else {
      sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    const sinceIso = sinceDate.toISOString();

    const rawLimit = parseInt(req.query.limit as string ?? '50', 10);
    const feedLimit = isNaN(rawLimit) || rawLimit < 1 ? 50 : Math.min(rawLimit, 200);

    const typesParam = (req.query.types as string | undefined)?.split(',').map(t => t.trim()).filter(Boolean) ?? [];
    const severityFilter = req.query.severity as string | undefined;

    // Settlement filter for disputed-settlement event — company uses station scope,
    // franchise uses franchise_owner_id
    const settlementDisputedFilter =
      ownerType === 'company'
        ? sql`EXISTS (SELECT 1 FROM franchise_stations fs2 WHERE fs2.id = ss.station_id)`
        : sql`ss.franchise_owner_id = ${ownerIdInt}`;

    const rows = await db.execute(sql`
      WITH franchise_stations AS (${stationScopeCTE(req)}),
      raw_events AS (

        -- 1. Disputes opened
        SELECT
          'dispute_opened'::text AS event_type,
          CASE
            WHEN dc.status IN ('open','escalated','investigating') THEN 'high'
            ELSE 'medium'
          END                    AS severity,
          dc.opened_at           AS occurred_at,
          b.station_id,
          dc.case_ref            AS ref_id,
          dc.amount_disputed_cents::bigint AS amount_cents,
          dc.status              AS detail_status,
          dc.complainant_type    AS detail_context,
          NULL::text             AS detail_reason
        FROM dispute_cases dc
        JOIN bookings b     ON b.id = dc.booking_id
        JOIN franchise_stations fs ON fs.id = b.station_id
        WHERE dc.opened_at >= ${sinceIso}::timestamptz

        UNION ALL

        -- 2. Refunds approved
        SELECT
          'refund_approved'::text AS event_type,
          CASE WHEN ra.amount_cents > 20000 THEN 'high' ELSE 'medium' END AS severity,
          ra.created_at          AS occurred_at,
          b.station_id,
          ra.refund_request_id   AS ref_id,
          ra.amount_cents::bigint,
          ra.status              AS detail_status,
          ra.booking_type        AS detail_context,
          ra.reason              AS detail_reason
        FROM refund_approvals ra
        JOIN bookings b     ON b.id = ra.booking_id
        JOIN franchise_stations fs ON fs.id = b.station_id
        WHERE ra.status IN ('approved','auto_approved')
          AND ra.created_at >= ${sinceIso}::timestamptz

        UNION ALL

        -- 3. Station downtime
        SELECT
          'downtime_started'::text AS event_type,
          CASE WHEN sd.resolved_at IS NULL THEN 'high' ELSE 'low' END AS severity,
          sd.start_at            AS occurred_at,
          sd.station_id,
          sd.id::text            AS ref_id,
          0::bigint              AS amount_cents,
          CASE WHEN sd.resolved_at IS NULL THEN 'active' ELSE 'resolved' END AS detail_status,
          NULL::text             AS detail_context,
          sd.reason              AS detail_reason
        FROM station_downtime sd
        JOIN franchise_stations fs ON fs.id = sd.station_id
        WHERE sd.start_at >= ${sinceIso}::timestamptz

        UNION ALL

        -- 4. Booking cancellations
        SELECT
          'booking_cancelled'::text AS event_type,
          'medium'::text            AS severity,
          b.cancelled_at            AS occurred_at,
          b.station_id,
          b.booking_number          AS ref_id,
          COALESCE(ROUND(b.total::numeric * 100), 0)::bigint AS amount_cents,
          b.cancelled_by            AS detail_status,
          b.cancellation_reason     AS detail_context,
          NULL::text                AS detail_reason
        FROM bookings b
        JOIN franchise_stations fs ON fs.id = b.station_id
        WHERE b.cancelled_at IS NOT NULL
          AND b.cancelled_at >= ${sinceIso}::timestamptz

        UNION ALL

        -- 5. Disputed settlements
        SELECT
          'settlement_disputed'::text AS event_type,
          'high'::text                AS severity,
          ss.created_at               AS occurred_at,
          ss.station_id,
          ss.id::text                 AS ref_id,
          ss.total_amount_cents::bigint AS amount_cents,
          ss.status                   AS detail_status,
          NULL::text                  AS detail_context,
          NULL::text                  AS detail_reason
        FROM station_settlements ss
        JOIN franchise_stations fs ON fs.id = ss.station_id
        WHERE ss.status = 'disputed'
          AND ${settlementDisputedFilter}
          AND ss.created_at >= ${sinceIso}::timestamptz
      )

      SELECT
        re.event_type,
        re.severity,
        re.occurred_at,
        re.station_id,
        fs.name        AS station_name,
        fs.station_code,
        fs.ownership_type,
        re.ref_id,
        re.amount_cents,
        re.detail_status,
        re.detail_context,
        re.detail_reason
      FROM raw_events re
      JOIN franchise_stations fs ON fs.id = re.station_id
      ORDER BY re.occurred_at DESC
      LIMIT ${feedLimit * 4}
    `);

    let events = (rows.rows as any[]).map((r) => ({
      eventType:     r.event_type    as string,
      severity:      r.severity      as string,
      occurredAt:    r.occurred_at   as string,
      stationId:     toInt(r.station_id),
      stationName:   r.station_name  as string,
      stationCode:   r.station_code  as string,
      ownershipType: r.ownership_type as string,
      refId:         r.ref_id        as string,
      amountILS:     toILS(r.amount_cents),
      detailStatus:  r.detail_status  ?? null,
      detailContext: r.detail_context ?? null,
      detailReason:  r.detail_reason  ?? null,
    }));

    if (typesParam.length > 0) {
      events = events.filter(e => typesParam.includes(e.eventType));
    }
    if (severityFilter && ['high','medium','low'].includes(severityFilter)) {
      events = events.filter(e => e.severity === severityFilter);
    }
    events = events.slice(0, feedLimit);

    res.json({
      ownerId:     req.params.ownerId,
      ownerType,
      since:       sinceDate.toISOString(),
      currency:    'ILS',
      totalEvents: events.length,
      events,
    });
  } catch (err: any) {
    logger.error('[NetworkFinance] audit-feed error', { error: err.message });
    res.status(500).json({ error: 'audit_feed_failed' });
  }
});

export default router;

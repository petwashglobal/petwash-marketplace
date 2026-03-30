/**
 * server/routes/franchise-finance.ts
 * Phase 11 — T27: Franchise Financial Aggregation Engine
 *
 * Mounted at /api/franchise (same prefix as franchise.ts) so routes land at:
 *   GET /api/franchise/:franchiseId/finance/summary
 *
 * All money is sourced exclusively from station_settlements.
 * Three overlapping time windows returned in one pass:
 *   today  — (created_at Israel TZ)::date = today
 *   mtd    — full month-to-date (includes today)
 *   last30 — rolling 30 days (includes today + MTD overlap)
 *
 * Disputed settlements are excluded from money totals but surfaced as
 * disputedCount / disputedAmount so the franchise owner has full visibility.
 *
 * Auth: Bearer token (franchise owner in franchise_owners table) OR x-admin-secret.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';

const router = Router({ mergeParams: true });

const IL_TZ = 'Asia/Jerusalem';
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

// ─── Auth middleware ───────────────────────────────────────────────────────────

/**
 * Verify the caller is the franchise owner (PostgreSQL check) or an admin.
 * Attaches (req as any).franchiseIdInt for downstream handlers.
 */
async function requireFranchiseOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const franchiseId = parseInt(req.params.franchiseId, 10);
    if (!franchiseId || isNaN(franchiseId)) {
      return res.status(400).json({ error: 'invalid_franchise_id' });
    }
    (req as any).franchiseIdInt = franchiseId;

    // Admin bypass via header secret
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

    // Ownership check against PostgreSQL franchise_owners table
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
    logger.error('[FranchiseFinance] auth error', { error: err.message });
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert integer cents to ILS decimal, rounding to 2 dp. */
const toILS = (cents: unknown): number =>
  cents != null && cents !== '' ? Math.round(Number(cents)) / 100 : 0;

const toInt = (v: unknown): number => Number(v ?? 0);

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/franchise/:franchiseId/finance/summary
 *
 * Response shape (all amounts in ILS):
 * {
 *   franchiseId: number,
 *   currency: "ILS",
 *   today:  FinancialWindow,
 *   mtd:    FinancialWindow,
 *   last30: FinancialWindow,
 * }
 *
 * FinancialWindow:
 * {
 *   grossRevenue:    number,  // total collected (pending + settled)
 *   platformFees:    number,  // platform cut
 *   franchiseShare:  number,  // franchise owner cut
 *   stationPayouts:  number,  // station share
 *   bookingCount:    number,
 *   settledCount:    number,
 *   pendingCount:    number,
 *   disputedCount:   number,  // informational — not in money totals
 *   disputedAmount:  number,  // informational
 * }
 */
router.get('/:franchiseId/finance/summary', requireFranchiseOwner, async (req: Request, res: Response) => {
  try {
    const franchiseId = (req as any).franchiseIdInt as number;

    // Single table scan — conditional aggregation for all three overlapping windows.
    // "today" is a subset of "mtd", "mtd" overlaps with "last30" — each window
    // is computed independently so totals are self-consistent across periods.
    const result = await db.execute(sql`
      SELECT
        -- ── TODAY ─────────────────────────────────────────────────────────────
        COALESCE(SUM(total_amount_cents)    FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint                                              AS today_gross_cents,

        COALESCE(SUM(platform_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint                                             AS today_platform_cents,

        COALESCE(SUM(franchise_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint                                             AS today_franchise_cents,

        COALESCE(SUM(station_amount_cents)  FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint                                             AS today_station_cents,

        COUNT(*) FILTER (
          WHERE status != 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int                                                     AS today_booking_count,

        COUNT(*) FILTER (
          WHERE status = 'settled'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int                                                     AS today_settled_count,

        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int                                                     AS today_pending_count,

        COUNT(*) FILTER (
          WHERE status = 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        )::int                                                     AS today_disputed_count,

        COALESCE(SUM(total_amount_cents) FILTER (
          WHERE status = 'disputed'
            AND (created_at AT TIME ZONE ${IL_TZ})::date
                = (NOW() AT TIME ZONE ${IL_TZ})::date
        ), 0)::bigint                                             AS today_disputed_cents,

        -- ── MTD (month-to-date, includes today) ──────────────────────────────
        COALESCE(SUM(total_amount_cents)    FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint                                             AS mtd_gross_cents,

        COALESCE(SUM(platform_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint                                             AS mtd_platform_cents,

        COALESCE(SUM(franchise_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint                                             AS mtd_franchise_cents,

        COALESCE(SUM(station_amount_cents)  FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint                                             AS mtd_station_cents,

        COUNT(*) FILTER (
          WHERE status != 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int                                                    AS mtd_booking_count,

        COUNT(*) FILTER (
          WHERE status = 'settled'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int                                                    AS mtd_settled_count,

        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int                                                    AS mtd_pending_count,

        COUNT(*) FILTER (
          WHERE status = 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        )::int                                                    AS mtd_disputed_count,

        COALESCE(SUM(total_amount_cents) FILTER (
          WHERE status = 'disputed'
            AND date_trunc('month', created_at AT TIME ZONE ${IL_TZ})
                = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
        ), 0)::bigint                                             AS mtd_disputed_cents,

        -- ── LAST 30 DAYS (rolling, includes today + MTD) ─────────────────────
        COALESCE(SUM(total_amount_cents)    FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint                                             AS last30_gross_cents,

        COALESCE(SUM(platform_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint                                             AS last30_platform_cents,

        COALESCE(SUM(franchise_amount_cents) FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint                                             AS last30_franchise_cents,

        COALESCE(SUM(station_amount_cents)  FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint                                             AS last30_station_cents,

        COUNT(*) FILTER (
          WHERE status != 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int                                                    AS last30_booking_count,

        COUNT(*) FILTER (
          WHERE status = 'settled'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int                                                    AS last30_settled_count,

        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int                                                    AS last30_pending_count,

        COUNT(*) FILTER (
          WHERE status = 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        )::int                                                    AS last30_disputed_count,

        COALESCE(SUM(total_amount_cents) FILTER (
          WHERE status = 'disputed'
            AND created_at >= NOW() - INTERVAL '30 days'
        ), 0)::bigint                                             AS last30_disputed_cents

      FROM station_settlements
      WHERE franchise_owner_id = ${franchiseId}
        -- Scan only rows relevant to at least one window (last 30 days is the widest)
        AND created_at >= NOW() - INTERVAL '30 days'
    `);

    const row = (result.rows[0] as any) ?? {};

    const buildWindow = (prefix: string) => ({
      grossRevenue:   toILS(row[`${prefix}_gross_cents`]),
      platformFees:   toILS(row[`${prefix}_platform_cents`]),
      franchiseShare: toILS(row[`${prefix}_franchise_cents`]),
      stationPayouts: toILS(row[`${prefix}_station_cents`]),
      bookingCount:   toInt(row[`${prefix}_booking_count`]),
      settledCount:   toInt(row[`${prefix}_settled_count`]),
      pendingCount:   toInt(row[`${prefix}_pending_count`]),
      disputedCount:  toInt(row[`${prefix}_disputed_count`]),
      disputedAmount: toILS(row[`${prefix}_disputed_cents`]),
    });

    res.json({
      franchiseId,
      currency: 'ILS',
      today:  buildWindow('today'),
      mtd:    buildWindow('mtd'),
      last30: buildWindow('last30'),
    });
  } catch (err: any) {
    logger.error('[FranchiseFinance] summary error', { error: err.message });
    res.status(500).json({ error: 'summary_failed' });
  }
});

// ─── T28: Station P&L Breakdown ───────────────────────────────────────────────

/**
 * GET /api/franchise/:franchiseId/stations/financials
 *
 * Returns per-station unit economics for the franchise, sourced exclusively
 * from station_settlements. Includes ALL stations in the franchise network —
 * even those with zero activity in the period — so weak stations are visible.
 *
 * Query params:
 *   period  today | mtd | last30 (default: last30)
 *
 * Response shape:
 * {
 *   franchiseId: number,
 *   period: string,
 *   currency: "ILS",
 *   stations: StationPL[],
 * }
 *
 * StationPL:
 * {
 *   stationId:      number,
 *   stationName:    string,
 *   stationCode:    string,
 *   grossRevenue:   number,   // pending + settled
 *   platformFees:   number,
 *   franchiseShare: number,
 *   stationPayouts: number,
 *   bookingCount:   number,   // non-disputed settlements
 *   settledCount:   number,
 *   pendingCount:   number,
 *   avgOrderValue:  number,   // grossRevenue / bookingCount (0 if none)
 *   disputedCount:  number,   // informational
 *   disputedAmount: number,   // informational
 * }
 */
router.get('/:franchiseId/stations/financials', requireFranchiseOwner, async (req: Request, res: Response) => {
  try {
    const franchiseId = (req as any).franchiseIdInt as number;
    const rawPeriod = (req.query.period as string | undefined) ?? 'last30';
    const period = ['today', 'mtd', 'last30'].includes(rawPeriod) ? rawPeriod : 'last30';

    // Build the time-window condition for the settlement JOIN.
    // Using template literal injection via sql`` is safe — period is allowlisted above.
    const timeFilter =
      period === 'today'
        ? sql`(ss.created_at AT TIME ZONE ${IL_TZ})::date = (NOW() AT TIME ZONE ${IL_TZ})::date`
        : period === 'mtd'
        ? sql`date_trunc('month', ss.created_at AT TIME ZONE ${IL_TZ}) = date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})`
        : sql`ss.created_at >= NOW() - INTERVAL '30 days'`;

    // LEFT JOIN so stations with zero activity in the period still appear.
    // Stations are scoped to the franchise via stations.franchise_id.
    const rows = await db.execute(sql`
      SELECT
        st.id                                                          AS station_id,
        st.name                                                        AS station_name,
        COALESCE(st.station_code, '')                                  AS station_code,

        -- Money (exclude disputed from revenue totals)
        COALESCE(SUM(ss.total_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS gross_cents,

        COALESCE(SUM(ss.platform_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS platform_cents,

        COALESCE(SUM(ss.franchise_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS franchise_cents,

        COALESCE(SUM(ss.station_amount_cents)
          FILTER (WHERE ss.status != 'disputed'), 0)::bigint           AS station_cents,

        -- Counts
        COUNT(ss.id)
          FILTER (WHERE ss.status != 'disputed')::int                  AS booking_count,

        COUNT(ss.id)
          FILTER (WHERE ss.status = 'settled')::int                    AS settled_count,

        COUNT(ss.id)
          FILTER (WHERE ss.status = 'pending')::int                    AS pending_count,

        -- Disputed (informational)
        COUNT(ss.id)
          FILTER (WHERE ss.status = 'disputed')::int                   AS disputed_count,

        COALESCE(SUM(ss.total_amount_cents)
          FILTER (WHERE ss.status = 'disputed'), 0)::bigint            AS disputed_cents

      FROM stations st
      LEFT JOIN station_settlements ss
        ON ss.station_id = st.id
       AND ss.franchise_owner_id = ${franchiseId}
       AND ${timeFilter}
      WHERE st.is_active = true
        -- Include stations explicitly linked to this franchise OR discovered via settlements
        AND (
          st.franchise_id = ${franchiseId}
          OR EXISTS (
            SELECT 1 FROM station_settlements sx
            WHERE sx.station_id = st.id
              AND sx.franchise_owner_id = ${franchiseId}
          )
        )
      GROUP BY st.id, st.name, st.station_code
      ORDER BY gross_cents DESC, st.name ASC
    `);

    const stations = (rows.rows as any[]).map((r) => {
      const grossRevenue = toILS(r.gross_cents);
      const bookingCount = toInt(r.booking_count);
      return {
        stationId:      Number(r.station_id),
        stationName:    r.station_name as string,
        stationCode:    r.station_code as string,
        grossRevenue,
        platformFees:   toILS(r.platform_cents),
        franchiseShare: toILS(r.franchise_cents),
        stationPayouts: toILS(r.station_cents),
        bookingCount,
        settledCount:   toInt(r.settled_count),
        pendingCount:   toInt(r.pending_count),
        avgOrderValue:  bookingCount > 0 ? Math.round((grossRevenue / bookingCount) * 100) / 100 : 0,
        disputedCount:  toInt(r.disputed_count),
        disputedAmount: toILS(r.disputed_cents),
      };
    });

    res.json({
      franchiseId,
      period,
      currency: 'ILS',
      stations,
    });
  } catch (err: any) {
    logger.error('[FranchiseFinance] stations/financials error', { error: err.message });
    res.status(500).json({ error: 'stations_financials_failed' });
  }
});

// ─── T29: Payout Calendar & Settlement Status ──────────────────────────────────

/**
 * GET /api/franchise/:franchiseId/payouts
 *
 * Groups station_settlements into ISO-week payout cycles (Monday→Sunday,
 * Israel TZ) and returns the cash-flow timeline for the franchise owner.
 *
 * Answers: "What money is payable, what is still pending, and when does it move?"
 *
 * Query params:
 *   limit   integer 1-52 (default 12) — how many recent weeks to return
 *
 * Response shape:
 * {
 *   franchiseId: number,
 *   currency: "ILS",
 *   cycles: PayoutCycle[],
 * }
 *
 * PayoutCycle:
 * {
 *   cycleId:              string,   // ISO week e.g. "2026-W13"
 *   weekStart:            string,   // ISO date — Monday
 *   weekEnd:              string,   // ISO date — Sunday
 *   expectedPayoutDate:   string,   // weekEnd + 7 days (pending/in_progress) | last settled_at (completed)
 *   status:               "pending" | "in_progress" | "completed",
 *   grossRevenue:         number,   // pending + settled (ILS)
 *   platformFees:         number,
 *   franchiseShare:       number,
 *   stationPayouts:       number,
 *   settlementCount:      number,   // total non-disputed rows
 *   settledCount:         number,
 *   pendingCount:         number,
 *   disputedCount:        number,   // informational
 *   disputedAmount:       number,   // informational
 *   hasReconciliationMismatch: boolean,   // true if cents don't add up in any row
 * }
 */
router.get('/:franchiseId/payouts', requireFranchiseOwner, async (req: Request, res: Response) => {
  try {
    const franchiseId = (req as any).franchiseIdInt as number;
    const rawLimit = parseInt(req.query.limit as string ?? '12', 10);
    const cycleLimit = isNaN(rawLimit) || rawLimit < 1 ? 12 : Math.min(rawLimit, 52);

    const rows = await db.execute(sql`
      SELECT
        -- ISO week identifier (e.g. "2026-W13")
        TO_CHAR(
          date_trunc('week', created_at AT TIME ZONE ${IL_TZ}),
          'IYYY-"W"IW'
        )                                                            AS cycle_id,

        -- Week boundaries (Monday = start of ISO week)
        (date_trunc('week', created_at AT TIME ZONE ${IL_TZ}))::date AS week_start,
        (date_trunc('week', created_at AT TIME ZONE ${IL_TZ})
          + INTERVAL '6 days')::date                                 AS week_end,

        -- Money (pending + settled only; disputed excluded from totals)
        COALESCE(SUM(total_amount_cents)
          FILTER (WHERE status != 'disputed'), 0)::bigint            AS gross_cents,

        COALESCE(SUM(platform_amount_cents)
          FILTER (WHERE status != 'disputed'), 0)::bigint            AS platform_cents,

        COALESCE(SUM(franchise_amount_cents)
          FILTER (WHERE status != 'disputed'), 0)::bigint            AS franchise_cents,

        COALESCE(SUM(station_amount_cents)
          FILTER (WHERE status != 'disputed'), 0)::bigint            AS station_cents,

        -- Status counts
        COUNT(*) FILTER (WHERE status = 'pending')::int              AS pending_count,
        COUNT(*) FILTER (WHERE status = 'settled')::int              AS settled_count,
        COUNT(*) FILTER (WHERE status != 'disputed')::int            AS settlement_count,

        -- Disputed (informational)
        COUNT(*) FILTER (WHERE status = 'disputed')::int             AS disputed_count,
        COALESCE(SUM(total_amount_cents)
          FILTER (WHERE status = 'disputed'), 0)::bigint             AS disputed_cents,

        -- Latest settled_at for completed cycles (used as payout confirmation date)
        MAX(settled_at)                                              AS last_settled_at,

        -- Reconciliation mismatch: platform + franchise + station must equal total
        -- Tolerance: 1 cent to absorb integer rounding
        BOOL_OR(
          ABS(total_amount_cents
              - platform_amount_cents
              - franchise_amount_cents
              - station_amount_cents) > 1
        )                                                            AS has_mismatch

      FROM station_settlements
      WHERE franchise_owner_id = ${franchiseId}
        AND created_at >= NOW() - (${cycleLimit} || ' weeks')::interval
      GROUP BY cycle_id, week_start, week_end
      ORDER BY week_start DESC
      LIMIT ${cycleLimit}
    `);

    const cycles = (rows.rows as any[]).map((r) => {
      const pendingCount  = toInt(r.pending_count);
      const settledCount  = toInt(r.settled_count);

      // Derive cycle status
      let status: 'pending' | 'in_progress' | 'completed';
      if (pendingCount > 0 && settledCount === 0) {
        status = 'pending';
      } else if (pendingCount > 0 && settledCount > 0) {
        status = 'in_progress';
      } else {
        status = 'completed';
      }

      // Expected payout date:
      //   completed → when the last settlement was marked settled
      //   pending / in_progress → end of cycle + 7 days
      const weekEnd = r.week_end as string;
      const weekEndDate = new Date(weekEnd);
      const defaultPayoutDate = new Date(weekEndDate);
      defaultPayoutDate.setDate(defaultPayoutDate.getDate() + 7);

      let expectedPayoutDate: string;
      if (status === 'completed' && r.last_settled_at) {
        expectedPayoutDate = new Date(r.last_settled_at).toISOString().slice(0, 10);
      } else {
        expectedPayoutDate = defaultPayoutDate.toISOString().slice(0, 10);
      }

      return {
        cycleId:            r.cycle_id as string,
        weekStart:          r.week_start as string,
        weekEnd,
        expectedPayoutDate,
        status,
        grossRevenue:       toILS(r.gross_cents),
        platformFees:       toILS(r.platform_cents),
        franchiseShare:     toILS(r.franchise_cents),
        stationPayouts:     toILS(r.station_cents),
        settlementCount:    toInt(r.settlement_count),
        settledCount,
        pendingCount,
        disputedCount:      toInt(r.disputed_count),
        disputedAmount:     toILS(r.disputed_cents),
        hasReconciliationMismatch: Boolean(r.has_mismatch),
      };
    });

    res.json({
      franchiseId,
      currency: 'ILS',
      cycles,
    });
  } catch (err: any) {
    logger.error('[FranchiseFinance] payouts error', { error: err.message });
    res.status(500).json({ error: 'payouts_failed' });
  }
});

export default router;

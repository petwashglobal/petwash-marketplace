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

export default router;

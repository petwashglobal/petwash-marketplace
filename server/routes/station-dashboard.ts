/**
 * Station Daily Dashboard API — Phase 10, Task #26
 *
 * Routes:
 *   GET /api/stations/:stationId/dashboard
 *     Protected: any active station operator (worker, manager, owner) for that station.
 *     Returns a single composite object aggregating today's bookings, earnings,
 *     open disputes, this-month settlement split, capacity, and active downtime.
 *
 *   GET /api/station-operators/my-stations
 *     Protected: any authenticated user (Firebase Bearer).
 *     Returns the list of stations the caller actively operates, with their role.
 *     Franchise owners also get stations linked via stations.franchise_id.
 */

import { Router } from 'express';
import { db } from '../db';
import { stations, stationOperators, franchiseOwners } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { requireStationRole } from '../middleware/stationAuth';
import { auth } from '../lib/firebase-admin';
import { isSuperAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveUidFromRequest(req: any): Promise<string | null> {
  // 1. requireAuth / session flow
  if (req.user?.uid) return req.user.uid;
  // 2. optFirebase flow
  if (req.firebaseUser?.uid) return req.firebaseUser.uid;
  // 3. Raw Bearer token
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

function isAdminSecretReq(req: any): boolean {
  const secret = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;
  return !!(secret && req.headers['x-admin-secret'] === secret);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/station-operators/my-stations
 *
 * Returns every station the authenticated user actively operates (any role).
 * Franchise owners additionally get all stations with matching franchise_id.
 */
router.get('/station-operators/my-stations', async (req, res) => {
  try {
    let uid: string | null = null;

    if (isAdminSecretReq(req)) {
      // Admin secret: return all active stations as 'owner'
      const allStations = await db.execute(sql`
        SELECT id, name, name_he, status, is_active, equipment_status
        FROM stations
        WHERE is_active = true
        ORDER BY name
      `);
      return res.json({
        stations: (allStations.rows as any[]).map((s) => ({
          id: s.id,
          name: s.name,
          nameHe: s.name_he,
          status: s.status,
          isActive: s.is_active,
          equipmentStatus: s.equipment_status ?? 'operational',
          role: 'owner',
        })),
      });
    }

    uid = await resolveUidFromRequest(req);
    if (!uid) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const email = (req as any).firebaseUser?.email ?? '';
    if (isSuperAdmin(email)) {
      const allStations = await db.execute(sql`
        SELECT id, name, name_he, status, is_active, equipment_status
        FROM stations WHERE is_active = true ORDER BY name
      `);
      return res.json({
        stations: (allStations.rows as any[]).map((s) => ({
          id: s.id,
          name: s.name,
          nameHe: s.name_he,
          status: s.status,
          isActive: s.is_active,
          equipmentStatus: s.equipment_status ?? 'operational',
          role: 'owner',
        })),
      });
    }

    // 1. Stations the user directly operates
    const operatorRows = await db.execute(sql`
      SELECT s.id, s.name, s.name_he, s.status, s.is_active, s.equipment_status,
             so.role
      FROM station_operators so
      JOIN stations s ON s.id = so.station_id
      WHERE so.user_id = ${uid}
        AND so.is_active = true
      ORDER BY s.name
    `);

    const stationMap = new Map<number, any>();
    for (const row of operatorRows.rows as any[]) {
      stationMap.set(Number(row.id), {
        id: row.id,
        name: row.name,
        nameHe: row.name_he,
        status: row.status,
        isActive: row.is_active,
        equipmentStatus: row.equipment_status ?? 'operational',
        role: row.role,
      });
    }

    // 2. Stations owned via franchise (franchise owner record → stations.franchise_id)
    const franchiseRow = await db.execute(sql`
      SELECT id FROM franchise_owners
      WHERE owner_user_id = ${uid} AND status = 'active'
      LIMIT 1
    `);
    const franchiseId = (franchiseRow.rows[0] as any)?.id ?? null;

    if (franchiseId != null) {
      const franchiseStations = await db.execute(sql`
        SELECT id, name, name_he, status, is_active, equipment_status
        FROM stations
        WHERE franchise_id = ${franchiseId}
        ORDER BY name
      `);
      for (const row of franchiseStations.rows as any[]) {
        const id = Number(row.id);
        if (!stationMap.has(id)) {
          stationMap.set(id, {
            id: row.id,
            name: row.name,
            nameHe: row.name_he,
            status: row.status,
            isActive: row.is_active,
            equipmentStatus: row.equipment_status ?? 'operational',
            role: 'owner',
          });
        }
      }
    }

    return res.json({ stations: Array.from(stationMap.values()) });
  } catch (err: any) {
    logger.error('[StationDashboard] my-stations error', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

/**
 * GET /api/stations/:stationId/dashboard
 *
 * Aggregated daily dashboard for a station operator.
 * Minimum role: worker (all roles can view their own station dashboard).
 */
router.get(
  '/stations/:stationId/dashboard',
  requireStationRole('worker'),
  async (req, res) => {
    const stationId = parseInt(req.params.stationId, 10);
    if (!isFinite(stationId)) {
      return res.status(400).json({ error: 'Invalid stationId' });
    }

    const callerRole = (req as any).stationOperatorRole as string | undefined;

    try {
      // ── Station base info ───────────────────────────────────────────────────
      const stationResult = await db.execute(sql`
        SELECT id, name, name_he, status, is_active,
               daily_capacity, current_day_bookings, equipment_status,
               next_downtime_start, next_downtime_end
        FROM stations
        WHERE id = ${stationId}
        LIMIT 1
      `);
      const station = stationResult.rows[0] as any;
      if (!station) {
        return res.status(404).json({ error: 'Station not found' });
      }

      const IL_TZ = 'Asia/Jerusalem';

      // ── Capacity (live count, Israel TZ) ────────────────────────────────────
      const capResult = await db.execute(sql`
        SELECT COUNT(*)::int AS cnt
        FROM bookings
        WHERE station_id = ${stationId}
          AND (start_time AT TIME ZONE ${IL_TZ})::date
              = (NOW() AT TIME ZONE ${IL_TZ})::date
          AND status NOT IN ('cancelled', 'rejected', 'expired')
      `);
      const usedToday = Number((capResult.rows[0] as any)?.cnt ?? 0);
      const dailyCap = Number(station.daily_capacity ?? 20);

      // ── Active downtime ─────────────────────────────────────────────────────
      const downtimeResult = await db.execute(sql`
        SELECT id, reason, start_at, end_at, reported_by
        FROM station_downtime
        WHERE station_id = ${stationId}
          AND start_at <= NOW()
          AND (end_at IS NULL OR end_at > NOW())
          AND resolved_at IS NULL
        ORDER BY start_at DESC
        LIMIT 1
      `);
      const downtimeRow = downtimeResult.rows[0] as any ?? null;
      const activeDowntime = downtimeRow
        ? {
            id: downtimeRow.id,
            reason: downtimeRow.reason,
            startAt: downtimeRow.start_at,
            endAt: downtimeRow.end_at,
            reportedBy: downtimeRow.reported_by,
          }
        : null;

      // ── Today's bookings (Israel TZ) ────────────────────────────────────────
      const bookingsResult = await db.execute(sql`
        SELECT id, booking_number, user_id, service_type, start_time, end_time,
               status, total::numeric AS total_ils
        FROM bookings
        WHERE station_id = ${stationId}
          AND (start_time AT TIME ZONE ${IL_TZ})::date
              = (NOW() AT TIME ZONE ${IL_TZ})::date
          AND status NOT IN ('cancelled', 'rejected', 'expired')
        ORDER BY start_time ASC
      `);
      const todayBookings = (bookingsResult.rows as any[]).map((b) => ({
        id: b.id,
        bookingNumber: b.booking_number,
        customerId: b.user_id,
        serviceType: b.service_type,
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
        totalILS: Number(b.total_ils ?? 0),
      }));

      // ── Earnings today: sum of station_settlements.station_amount_cents
      //    for bookings whose start_time is today (Israel TZ) ─────────────────
      const earningsResult = await db.execute(sql`
        SELECT COALESCE(SUM(ss.station_amount_cents), 0)::bigint AS total_cents
        FROM station_settlements ss
        JOIN bookings b ON b.id = ss.booking_id
        WHERE ss.station_id = ${stationId}
          AND (b.start_time AT TIME ZONE ${IL_TZ})::date
              = (NOW() AT TIME ZONE ${IL_TZ})::date
      `);
      const earningsTodayCents = Number((earningsResult.rows[0] as any)?.total_cents ?? 0);

      // ── Open disputes linked to this station ─────────────────────────────────
      const disputesResult = await db.execute(sql`
        SELECT dc.id, dc.case_ref, dc.booking_id, dc.amount_disputed_cents,
               dc.status, dc.opened_at
        FROM dispute_cases dc
        JOIN bookings b ON b.id = dc.booking_id
        WHERE b.station_id = ${stationId}
          AND dc.status NOT IN ('resolved', 'dismissed')
        ORDER BY dc.opened_at DESC
        LIMIT 50
      `);
      const openDisputes = (disputesResult.rows as any[]).map((d) => ({
        id: d.id,
        caseRef: d.case_ref,
        bookingId: d.booking_id,
        amountDisputedCents: d.amount_disputed_cents,
        status: d.status,
        openedAt: d.opened_at,
      }));

      // ── This month's settlement summary ──────────────────────────────────────
      const settlementResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(total_amount_cents),    0)::bigint AS total_revenue_cents,
          COALESCE(SUM(station_amount_cents),  0)::bigint AS station_share_cents,
          COALESCE(SUM(platform_amount_cents), 0)::bigint AS platform_fee_cents,
          COALESCE(SUM(franchise_amount_cents),0)::bigint AS franchise_share_cents,
          COUNT(*)::int                                   AS settlement_count
        FROM station_settlements
        WHERE station_id = ${stationId}
          AND (created_at AT TIME ZONE ${IL_TZ}) >=
              date_trunc('month', NOW() AT TIME ZONE ${IL_TZ})
      `);
      const sm = settlementResult.rows[0] as any;
      const settlement = {
        thisMonth: {
          totalRevenueCents:   Number(sm?.total_revenue_cents   ?? 0),
          stationShareCents:   Number(sm?.station_share_cents   ?? 0),
          platformFeeCents:    Number(sm?.platform_fee_cents    ?? 0),
          franchiseShareCents: Number(sm?.franchise_share_cents ?? 0),
          settlementCount:     Number(sm?.settlement_count      ?? 0),
        },
      };

      logger.info('[StationDashboard] GET dashboard', {
        stationId,
        callerRole,
        usedToday,
        bookingsCount: todayBookings.length,
        openDisputeCount: openDisputes.length,
      });

      return res.json({
        stationId,
        stationName:       station.name,
        stationNameHe:     station.name_he,
        stationStatus:     station.status,
        isActive:          station.is_active,
        callerRole:        callerRole ?? 'worker',
        capacity: {
          daily:      dailyCap,
          usedToday,
          remaining:  Math.max(0, dailyCap - usedToday),
          atCapacity: usedToday >= dailyCap,
        },
        operationalStatus: {
          equipmentStatus:   station.equipment_status ?? 'operational',
          nextDowntimeStart: station.next_downtime_start ?? null,
          nextDowntimeEnd:   station.next_downtime_end   ?? null,
        },
        activeDowntime,
        glance: {
          bookingsToday:    usedToday,
          earningsTodayILS: earningsTodayCents / 100,
          openDisputeCount: openDisputes.length,
        },
        todayBookings,
        settlement,
        openDisputes,
      });
    } catch (err: any) {
      logger.error('[StationDashboard] GET dashboard failed', {
        stationId,
        error: err.message,
      });
      return res.status(500).json({ error: 'Failed to fetch station dashboard' });
    }
  }
);

export default router;

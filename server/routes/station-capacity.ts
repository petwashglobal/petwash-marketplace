/**
 * Station Capacity & Operational Tracking — Phase 10, Task #25
 *
 * Routes:
 *   GET  /api/stations/:stationId/capacity  — public; returns today's booking count vs
 *                                             capacity, equipment status, active downtime
 *   POST /api/stations/:stationId/downtime  — manager/owner only; log a downtime event
 *
 * Capacity guard:
 *   The GET endpoint exposes `atCapacity` (bool) so consumers (booking auto-assign, UI)
 *   can check before assigning a booking to a station.
 *
 * The `currentDayBookings` column is a cached counter reset at midnight by a lightweight
 * DB query in this route (GET computes the live count for the response; POST to /downtime
 * does not affect the counter — that is updated by the booking lifecycle).
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { stations, stationDowntime, insertStationDowntimeSchema } from '@shared/schema';
import { eq, and, isNull, lte, gte, sql } from 'drizzle-orm';
import { requireStationRole, resolveStationRole } from '../middleware/stationAuth';
import { logger } from '../lib/logger';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Computes the live booking count for `stationId` on today's calendar date
 * (midnight-to-midnight in UTC). Returns 0 on error.
 */
async function liveBookingCountToday(stationId: number): Promise<number> {
  try {
    const [row] = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM bookings
      WHERE station_id = ${stationId}
        AND date_trunc('day', start_time) = date_trunc('day', NOW())
        AND status NOT IN ('cancelled', 'rejected', 'expired')
    `);
    return Number((row as any).cnt ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Returns the currently-active downtime record for the station, if any.
 * A downtime is "active" if start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())
 * AND resolved_at IS NULL.
 */
async function getActiveDowntime(stationId: number) {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(stationDowntime)
      .where(
        and(
          eq(stationDowntime.stationId, stationId),
          lte(stationDowntime.startAt, now),
          isNull(stationDowntime.resolvedAt)
        )
      )
      .limit(1);

    // Secondary filter: end_at IS NULL OR end_at > now
    const active = rows.find(
      (r) => r.endAt == null || new Date(r.endAt) > now
    );
    return active ?? null;
  } catch {
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/stations/:stationId/capacity
 *
 * Public endpoint — no auth required.
 * Returns capacity status, today's live booking count, equipment status, and
 * any currently-active downtime record.
 */
router.get('/stations/:stationId/capacity', async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  if (!isFinite(stationId)) {
    return res.status(400).json({ error: 'stationId must be a positive integer' });
  }

  try {
    const [station] = await db
      .select({
        id: stations.id,
        name: stations.name,
        dailyCapacity: stations.dailyCapacity,
        currentDayBookings: stations.currentDayBookings,
        equipmentStatus: stations.equipmentStatus,
        nextDowntimeStart: stations.nextDowntimeStart,
        nextDowntimeEnd: stations.nextDowntimeEnd,
        isActive: stations.isActive,
      })
      .from(stations)
      .where(eq(stations.id, stationId))
      .limit(1);

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Live count is more accurate than the cached counter for the public-facing response
    const liveTodayCount = await liveBookingCountToday(stationId);
    const capacity = station.dailyCapacity ?? 20;
    const atCapacity = liveTodayCount >= capacity;
    const remainingSlots = Math.max(0, capacity - liveTodayCount);

    const activeDowntime = await getActiveDowntime(stationId);

    logger.info('[StationCapacity] GET capacity', {
      stationId,
      liveTodayCount,
      capacity,
      atCapacity,
      equipmentStatus: station.equipmentStatus,
      hasActiveDowntime: !!activeDowntime,
    });

    return res.json({
      stationId,
      name: station.name,
      isActive: station.isActive,
      capacity: {
        daily: capacity,
        usedToday: liveTodayCount,
        remaining: remainingSlots,
        atCapacity,
      },
      operationalStatus: {
        equipmentStatus: station.equipmentStatus ?? 'operational',
        nextDowntimeStart: station.nextDowntimeStart ?? null,
        nextDowntimeEnd: station.nextDowntimeEnd ?? null,
      },
      activeDowntime: activeDowntime
        ? {
            id: activeDowntime.id,
            reason: activeDowntime.reason,
            startAt: activeDowntime.startAt,
            endAt: activeDowntime.endAt,
            reportedBy: activeDowntime.reportedBy,
          }
        : null,
    });
  } catch (err: any) {
    logger.error('[StationCapacity] GET capacity failed', { stationId, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch station capacity' });
  }
});

/**
 * POST /api/stations/:stationId/downtime
 *
 * Log a downtime event for a station.
 * Requires: manager or owner role on that station.
 *
 * Body:
 *   reason    string  (required)
 *   startAt   ISO string (required; defaults to NOW if omitted)
 *   endAt     ISO string (optional)
 *
 * Side-effect: sets stations.equipment_status = 'offline' when startAt <= NOW.
 */
const downtimeBodySchema = z.object({
  reason: z.string().min(3).max(500),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional().nullable(),
});

router.post('/stations/:stationId/downtime', requireStationRole('manager'), async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  if (!isFinite(stationId)) {
    return res.status(400).json({ error: 'stationId must be a positive integer' });
  }

  const parsed = downtimeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
  }

  const callerUid = (req as any).stationOperatorUid as string | undefined;
  const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : new Date();
  const endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;

  if (endAt && endAt <= startAt) {
    return res.status(400).json({ error: 'endAt must be after startAt' });
  }

  try {
    const [inserted] = await db
      .insert(stationDowntime)
      .values({
        stationId,
        reason: parsed.data.reason,
        startAt,
        endAt,
        reportedBy: callerUid ?? null,
      })
      .returning();

    // If the downtime starts now (or in the past), flip the equipment status to 'offline'
    const now = new Date();
    if (startAt <= now) {
      await db
        .update(stations)
        .set({ equipmentStatus: 'offline', updatedAt: now })
        .where(eq(stations.id, stationId));
    } else {
      // Scheduled future downtime — persist the planned window on the station row
      await db
        .update(stations)
        .set({
          nextDowntimeStart: startAt,
          nextDowntimeEnd: endAt,
          updatedAt: now,
        })
        .where(eq(stations.id, stationId));
    }

    logger.info('[StationCapacity] Downtime logged', {
      stationId,
      reason: parsed.data.reason,
      startAt,
      endAt,
      callerUid,
    });

    return res.status(201).json({ ok: true, downtime: inserted });
  } catch (err: any) {
    logger.error('[StationCapacity] POST downtime failed', { stationId, error: err.message });
    return res.status(500).json({ error: 'Failed to log downtime' });
  }
});

export default router;

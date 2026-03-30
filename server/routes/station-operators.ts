/**
 * Station Operator Management — Phase 10, Task #24
 *
 * Routes:
 *   GET    /api/my-stations                          — any authenticated user; lists their stations with role + earnings
 *   GET    /api/stations/:stationId/operators        — manager or owner of that station
 *   POST   /api/stations/:stationId/operators        — owner only; assign user to station with role
 *   DELETE /api/stations/:stationId/operators/:userId — owner only; deactivate operator
 *
 * Earnings scoping (GET /api/my-stations):
 *   worker  — sees their own booking totals (bookings.provider_id = uid)
 *   manager — sees station-level totals (all bookings for that station)
 *   owner   — sees cross-station totals for all stations they own
 */

import { Router } from 'express';
import { db } from '../db';
import {
  stationOperators,
  stations,
  stationSettlements,
  insertStationOperatorSchema,
} from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { isSuperAdmin } from '../middleware/rbac';
import { requireStationRole, resolveStationRole } from '../middleware/stationAuth';
import { logger } from '../lib/logger';

const router = Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function resolveUidOrFail(req: any, res: any): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
    return null;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/my-stations
 * Returns all stations the authenticated user is linked to as an operator.
 * Earnings are scoped by role:
 *   worker  → their own booking totals only
 *   manager → full station-level settlement totals
 *   owner   → all stations they own (cross-station)
 */
router.get('/my-stations', async (req, res) => {
  const uid = await resolveUidOrFail(req, res);
  if (!uid) return;

  try {
    const operatorRows = await db
      .select({
        stationId: stationOperators.stationId,
        role: stationOperators.role,
        assignedAt: stationOperators.assignedAt,
        stationName: stations.name,
        stationCode: stations.stationCode,
        stationStatus: stations.status,
        isStationActive: stations.isActive,
      })
      .from(stationOperators)
      .innerJoin(stations, eq(stationOperators.stationId, stations.id))
      .where(
        and(
          eq(stationOperators.userId, uid),
          eq(stationOperators.isActive, true)
        )
      );

    const result = await Promise.all(
      operatorRows.map(async (row) => {
        const role = row.role as 'owner' | 'manager' | 'worker';
        let earningsTotalCents = 0;

        if (role === 'worker') {
          // Workers: sum of provider_payout from completed bookings assigned to them at this station
          const [w] = await db.execute(sql`
            SELECT coalesce(sum(provider_payout), 0)::float AS total
            FROM bookings
            WHERE station_id = ${row.stationId}
              AND provider_id = ${uid}
              AND status = 'completed'
          `);
          earningsTotalCents = Math.round(Number((w as any).total ?? 0) * 100);
        } else if (role === 'manager') {
          const [m] = await db
            .select({ total: sql<number>`coalesce(sum(station_amount_cents), 0)::int` })
            .from(stationSettlements)
            .where(eq(stationSettlements.stationId, row.stationId));
          earningsTotalCents = Number(m?.total ?? 0);
        } else if (role === 'owner') {
          const [o] = await db
            .select({ total: sql<number>`coalesce(sum(station_amount_cents), 0)::int` })
            .from(stationSettlements)
            .where(eq(stationSettlements.stationId, row.stationId));
          earningsTotalCents = Number(o?.total ?? 0);
        }

        return {
          stationId: row.stationId,
          stationName: row.stationName,
          stationCode: row.stationCode,
          stationStatus: row.stationStatus,
          isStationActive: row.isStationActive,
          role,
          assignedAt: row.assignedAt,
          earningsTotalCents,
          earningsILS: +(earningsTotalCents / 100).toFixed(2),
        };
      })
    );

    logger.info('[StationOperators] my-stations', { uid, count: result.length });
    return res.json({ stations: result, count: result.length });
  } catch (err: any) {
    logger.error('[StationOperators] my-stations failed', { uid, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

/**
 * GET /api/stations/:stationId/operators
 * Lists all active operators for a station.
 * Requires: manager or owner role on that station.
 */
router.get('/stations/:stationId/operators', requireStationRole('manager'), async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);

  try {
    const rows = await db
      .select({
        id: stationOperators.id,
        userId: stationOperators.userId,
        role: stationOperators.role,
        isActive: stationOperators.isActive,
        assignedAt: stationOperators.assignedAt,
      })
      .from(stationOperators)
      .where(
        and(
          eq(stationOperators.stationId, stationId),
          eq(stationOperators.isActive, true)
        )
      );

    return res.json({ operators: rows, count: rows.length });
  } catch (err: any) {
    logger.error('[StationOperators] GET operators failed', { stationId, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch operators' });
  }
});

/**
 * POST /api/stations/:stationId/operators
 * Assigns a user to a station with the given role.
 * Requires: owner role on that station.
 * Body: { userId: string, role: 'owner' | 'manager' | 'worker' }
 */
router.post('/stations/:stationId/operators', requireStationRole('owner'), async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  const callerUid = (req as any).stationOperatorUid as string;

  const parsed = insertStationOperatorSchema.safeParse({
    stationId,
    userId: req.body.userId,
    role: req.body.role ?? 'worker',
    isActive: true,
  });

  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: parsed.error.issues });
  }

  try {
    const [inserted] = await db
      .insert(stationOperators)
      .values(parsed.data)
      .onConflictDoUpdate({
        target: [stationOperators.stationId, stationOperators.userId],
        set: {
          role: parsed.data.role,
          isActive: true,
        },
      })
      .returning();

    logger.info('[StationOperators] Assigned operator', {
      stationId,
      userId: parsed.data.userId,
      role: parsed.data.role,
      callerUid,
    });

    return res.status(201).json({ ok: true, operator: inserted });
  } catch (err: any) {
    logger.error('[StationOperators] POST operators failed', { stationId, error: err.message });
    return res.status(500).json({ error: 'Failed to assign operator' });
  }
});

/**
 * DELETE /api/stations/:stationId/operators/:userId
 * Deactivates an operator (soft-delete).
 * Requires: owner role on that station.
 */
router.delete('/stations/:stationId/operators/:userId', requireStationRole('owner'), async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  const targetUserId = req.params.userId;
  const callerUid = (req as any).stationOperatorUid as string;

  if (!targetUserId || targetUserId.trim() === '') {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const [updated] = await db
      .update(stationOperators)
      .set({ isActive: false })
      .where(
        and(
          eq(stationOperators.stationId, stationId),
          eq(stationOperators.userId, targetUserId)
        )
      )
      .returning({ id: stationOperators.id });

    if (!updated) {
      return res.status(404).json({ error: 'Operator not found for this station' });
    }

    logger.info('[StationOperators] Removed operator', {
      stationId,
      targetUserId,
      callerUid,
    });

    return res.json({ ok: true, stationId, userId: targetUserId });
  } catch (err: any) {
    logger.error('[StationOperators] DELETE operators failed', { stationId, error: err.message });
    return res.status(500).json({ error: 'Failed to remove operator' });
  }
});

export default router;

/**
 * Station Settlements API — Phase 10, Task #21
 *
 * GET /api/stations/:stationId/settlements
 *   Returns settlement history for a station with running totals.
 *   Authorized for: admin (x-admin-secret header) OR the franchise owner of that station.
 *
 * POST /api/stations/:stationId/settlements/recompute/:bookingId
 *   Admin-only: force-recompute a specific booking's settlement (re-runs engine,
 *   overwrites existing record). Writes an audit entry.
 */

import { Router } from 'express';
import { db } from '../db';
import {
  stationSettlements,
  stations,
  franchiseOwners,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { computeAndPersistSettlement } from '../services/SettlementEngine';

const router = Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function resolveUid(req: any, res: any): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

function isAdminRequest(req: any): boolean {
  const adminSecret = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;
  return !!(adminSecret && req.headers['x-admin-secret'] === adminSecret);
}

/**
 * Verify that uid is either an admin or the franchise owner of stationId.
 * Returns true and populates req._isFranchiseOwner.
 */
async function authorizeSettlementAccess(
  req: any,
  res: any,
  stationId: number,
  uid: string
): Promise<boolean> {
  if (isAdminRequest(req)) return true;

  // Check if user is a franchise owner linked to this station
  const [row] = await db
    .select({ foId: franchiseOwners.id })
    .from(franchiseOwners)
    .innerJoin(stations, eq(stations.franchiseId, franchiseOwners.id))
    .where(
      and(
        eq(stations.id, stationId),
        eq(franchiseOwners.ownerUserId, uid)
      )
    )
    .limit(1);

  if (!row) {
    res.status(403).json({ error: 'Access denied — admin or franchise owner only' });
    return false;
  }

  req._franchiseOwnerId = row.foId;
  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/stations/:stationId/settlements
 * Query params: status (pending|settled|disputed), limit (default 50), offset (default 0)
 */
router.get('/:stationId/settlements', async (req, res) => {
  const uid = await resolveUid(req, res);
  if (!uid) return;

  const stationId = parseInt(req.params.stationId, 10);
  if (!isFinite(stationId)) {
    return res.status(400).json({ error: 'Invalid stationId' });
  }

  if (!(await authorizeSettlementAccess(req, res, stationId, uid))) return;

  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

  try {
    const conditions = [eq(stationSettlements.stationId, stationId)];
    if (status && ['pending', 'settled', 'disputed'].includes(status)) {
      conditions.push(eq(stationSettlements.status, status));
    }

    const rows = await db
      .select()
      .from(stationSettlements)
      .where(and(...conditions))
      .orderBy(desc(stationSettlements.computedAt))
      .limit(limit)
      .offset(offset);

    // Running totals
    const [totals] = await db
      .select({
        totalGrossCents:    sql<number>`coalesce(sum(gross_amount_cents), 0)::int`,
        totalPlatformCents: sql<number>`coalesce(sum(platform_fee_cents), 0)::int`,
        totalFranchiseCents: sql<number>`coalesce(sum(franchise_override_cents), 0)::int`,
        totalStationNetCents: sql<number>`coalesce(sum(station_net_cents), 0)::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(stationSettlements)
      .where(eq(stationSettlements.stationId, stationId));

    res.json({
      settlements: rows,
      totals: {
        grossAmountCents:       totals?.totalGrossCents ?? 0,
        platformFeeCents:       totals?.totalPlatformCents ?? 0,
        franchiseOverrideCents: totals?.totalFranchiseCents ?? 0,
        stationNetCents:        totals?.totalStationNetCents ?? 0,
        count:                  totals?.totalCount ?? 0,
      },
      pagination: { limit, offset },
    });
  } catch (err: any) {
    logger.error('[StationSettlements] GET failed', { stationId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

/**
 * POST /api/stations/:stationId/settlements/recompute/:bookingId
 * Admin-only: delete and recompute a single booking's settlement.
 */
router.post('/:stationId/settlements/recompute/:bookingId', async (req, res) => {
  const uid = await resolveUid(req, res);
  if (!uid) return;

  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: 'Admin only' });
  }

  const stationId = parseInt(req.params.stationId, 10);
  const { bookingId } = req.params;

  if (!isFinite(stationId) || !bookingId) {
    return res.status(400).json({ error: 'Invalid stationId or bookingId' });
  }

  try {
    // Remove existing record so engine can recompute
    await db
      .delete(stationSettlements)
      .where(eq(stationSettlements.bookingId, bookingId));

    const result = await computeAndPersistSettlement(bookingId);

    if (!result) {
      return res.status(404).json({ error: 'No eligible PostgreSQL booking found for this bookingId' });
    }

    logger.info('[StationSettlements] Recomputed by admin', { bookingId, adminUid: uid, newSettlementId: result.id });
    res.json({ ok: true, settlement: result });
  } catch (err: any) {
    logger.error('[StationSettlements] Recompute failed', { bookingId, error: err.message });
    res.status(500).json({ error: err.message ?? 'Recompute failed' });
  }
});

export default router;

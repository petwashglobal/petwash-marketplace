/**
 * Station Settlements API — Phase 10, Task #21
 *
 * GET /api/stations/:stationId/settlements
 *   Returns settlement history for a station with running totals.
 *   Authorization:
 *     - Admin:          x-admin-secret header matches ADMIN_SECRET env var (no bearer required)
 *     - Franchise owner: valid Firebase bearer token + ownerUserId matches franchiseOwners for that station
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
import { timingSafeAdminSecretMatch } from '../middleware/adminAuth';

const router = Router();

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isAdminRequest(req: any): boolean {
  return timingSafeAdminSecretMatch(req);
}

async function resolveUidOrNull(req: any): Promise<string | null> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * Returns true if request is authorized to view settlements for stationId.
 * Admin: x-admin-secret header — no bearer token required.
 * Franchise owner: valid bearer + ownerUserId === franchiseOwners row linked to that station.
 */
async function authorize(req: any, res: any, stationId: number): Promise<boolean> {
  // Admin path — header-secret-only, no bearer required
  if (isAdminRequest(req)) return true;

  // Franchise owner path — must have valid Firebase token
  const uid = await resolveUidOrNull(req);
  if (!uid) {
    res.status(401).json({ error: 'Unauthorized — provide Bearer token or admin secret' });
    return false;
  }

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

  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/stations/:stationId/settlements
 * Query params: status (pending|settled|disputed), limit (default 50, max 200), offset (default 0)
 */
router.get('/:stationId/settlements', async (req, res) => {
  const stationId = parseInt(req.params.stationId, 10);
  if (!isFinite(stationId)) {
    return res.status(400).json({ error: 'Invalid stationId' });
  }

  if (!(await authorize(req, res, stationId))) return;

  const status = req.query.status as string | undefined;
  const limit  = Math.min(parseInt(String(req.query.limit  ?? '50'),  10) || 50,  200);
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
      .orderBy(desc(stationSettlements.createdAt))
      .limit(limit)
      .offset(offset);

    // Running totals across all settlements for this station (status-independent)
    const [totals] = await db
      .select({
        totalAmountCents:    sql<number>`coalesce(sum(total_amount_cents), 0)::int`,
        platformAmountCents: sql<number>`coalesce(sum(platform_amount_cents), 0)::int`,
        franchiseAmountCents: sql<number>`coalesce(sum(franchise_amount_cents), 0)::int`,
        stationAmountCents:  sql<number>`coalesce(sum(station_amount_cents), 0)::int`,
        totalCount:          sql<number>`count(*)::int`,
      })
      .from(stationSettlements)
      .where(eq(stationSettlements.stationId, stationId));

    res.json({
      settlements: rows,
      totals: {
        totalAmountCents:     totals?.totalAmountCents    ?? 0,
        platformAmountCents:  totals?.platformAmountCents ?? 0,
        franchiseAmountCents: totals?.franchiseAmountCents ?? 0,
        stationAmountCents:   totals?.stationAmountCents  ?? 0,
        count:                totals?.totalCount          ?? 0,
      },
      pagination: { limit, offset },
    });
  } catch (err: any) {
    logger.error('[StationSettlements] GET failed', { stationId, error: err.message });
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

export default router;

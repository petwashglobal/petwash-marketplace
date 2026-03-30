/**
 * Station Operator Auth Middleware — Phase 10, Task #24
 *
 * Enforces role-based access for station-scoped routes.
 *
 * Role hierarchy (weakest → strongest):
 *   worker < manager < owner
 *
 * Usage:
 *   router.get('/path', requireStationRole('manager'), handler)
 *
 * Auth strategy: Firebase Bearer token → UID → stationOperators lookup.
 * Super-admins (isSuperAdmin email list) always pass.
 * ADMIN_SECRET header also bypasses for automation (same pattern as station-settlements).
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { stationOperators } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '../lib/firebase-admin';
import { isSuperAdmin } from './rbac';
import { logger } from '../lib/logger';

export type StationRole = 'worker' | 'manager' | 'owner';

const ROLE_RANK: Record<StationRole, number> = {
  worker: 1,
  manager: 2,
  owner: 3,
};

function isAdminSecret(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;
  return !!(secret && req.headers['x-admin-secret'] === secret);
}

async function resolveUid(req: Request): Promise<string | null> {
  // 1. Session-cookie flow: requireAuth sets req.user (bookings routes, most protected routes)
  const sessionUid = (req as any).user?.uid;
  if (sessionUid) return sessionUid;

  // 2. Firebase middleware flow: optFirebase / optionalFirebaseToken sets req.firebaseUser
  const fbUid = (req as any).firebaseUser?.uid;
  if (fbUid) return fbUid;

  // 3. Raw Bearer token (station-operator-only routes that skip requireAuth)
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
 * Returns the Express middleware function that requires the calling user
 * to hold at least `minRole` on the station identified by `:stationId`
 * in the route params.
 */
export function requireStationRole(minRole: StationRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isAdminSecret(req)) {
      return next();
    }

    const uid = await resolveUid(req);
    if (!uid) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }

    const email = (req as any).firebaseUser?.email ?? '';
    if (isSuperAdmin(email)) {
      return next();
    }

    const stationIdRaw = req.params.stationId;
    const stationId = parseInt(stationIdRaw, 10);
    if (!isFinite(stationId)) {
      return res.status(400).json({ error: 'Invalid stationId' });
    }

    try {
      const [row] = await db
        .select({ role: stationOperators.role })
        .from(stationOperators)
        .where(
          and(
            eq(stationOperators.stationId, stationId),
            eq(stationOperators.userId, uid),
            eq(stationOperators.isActive, true),
          )
        )
        .limit(1);

      if (!row) {
        logger.warn('[StationAuth] No active operator row', { uid, stationId, minRole });
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not an operator of this station' });
      }

      const userRank = ROLE_RANK[row.role as StationRole] ?? 0;
      const requiredRank = ROLE_RANK[minRole];

      if (userRank < requiredRank) {
        logger.warn('[StationAuth] Insufficient role', { uid, stationId, userRole: row.role, minRole });
        return res.status(403).json({
          error: 'INSUFFICIENT_ROLE',
          message: `This action requires role "${minRole}" or higher. Your role: "${row.role}"`,
        });
      }

      (req as any).stationOperatorRole = row.role;
      (req as any).stationOperatorUid = uid;
      return next();
    } catch (err: any) {
      logger.error('[StationAuth] DB error', { uid, stationId, error: err.message });
      return res.status(500).json({ error: 'Station auth check failed' });
    }
  };
}

/**
 * Resolves the calling user's role for a given station.
 * Returns null if the user is not an active operator of that station.
 * Super-admin and admin-secret both return 'owner' (highest).
 */
export async function resolveStationRole(
  req: Request,
  stationId: number
): Promise<StationRole | null> {
  if (isAdminSecret(req)) return 'owner';

  const uid = await resolveUid(req);
  if (!uid) return null;

  const email = (req as any).firebaseUser?.email ?? '';
  if (isSuperAdmin(email)) return 'owner';

  try {
    const [row] = await db
      .select({ role: stationOperators.role })
      .from(stationOperators)
      .where(
        and(
          eq(stationOperators.stationId, stationId),
          eq(stationOperators.userId, uid),
          eq(stationOperators.isActive, true),
        )
      )
      .limit(1);

    return (row?.role as StationRole) ?? null;
  } catch {
    return null;
  }
}

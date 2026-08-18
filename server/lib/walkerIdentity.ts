/**
 * walkerIdentity — the ONE server-side helper for translating between a
 * walker's Firebase UID and the WALKER-uuid string stored on
 * walk_bookings.walkerId.
 *
 * Per CEO 2026-08-18 §32 "no parallel domain services": the same join
 * (walker_profiles.userId ↔ walker_profiles.walkerId) is currently
 * reimplemented inside WalkSessionService (P1-14 fix, 5 methods) AND
 * inside serviceSessionAdapter (walk_bookings branch). If either drifts,
 * authorization drifts. This module owns the join so both paths agree.
 *
 * The two directions:
 *
 *   walkerUuidForCaller(callerUid): Promise<string | null>
 *     Given the caller's Firebase UID, return the WALKER-uuid registered
 *     to that user (or null if the caller isn't a registered walker).
 *     Used at write time — check "is this Firebase user the assigned
 *     walker for that booking?" needs the walker-side of the join.
 *
 *   walkerUidForUuid(walkerUuid): Promise<string | null>
 *     Given the WALKER-uuid stored on a booking, return the assigned
 *     walker's Firebase UID (or null if no matching walker_profiles row).
 *     Used at read time — projecting DTOs that need the walker's UID
 *     for downstream authorization checks (customer view, admin view).
 *
 * Neither helper caches — walker profiles change rarely but the auth
 * gate must be current. Callers that need to batch (e.g. project N walks
 * in one endpoint) should compose a single join rather than N helper
 * calls; helpers here are for point queries.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { walkerProfiles } from '@shared/schema';

export async function walkerUuidForCaller(callerUid: string | null | undefined): Promise<string | null> {
  if (!callerUid) return null;
  const [row] = await db
    .select({ walkerId: walkerProfiles.walkerId })
    .from(walkerProfiles)
    .where(eq(walkerProfiles.userId, callerUid))
    .limit(1);
  return (row?.walkerId || null) as string | null;
}

export async function walkerUidForUuid(walkerUuid: string | null | undefined): Promise<string | null> {
  if (!walkerUuid) return null;
  const [row] = await db
    .select({ userId: walkerProfiles.userId })
    .from(walkerProfiles)
    .where(eq(walkerProfiles.walkerId, walkerUuid))
    .limit(1);
  return (row?.userId || null) as string | null;
}

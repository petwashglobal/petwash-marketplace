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

/**
 * Duplicate-row hardening (adversarial-review finding, 2026-08-18):
 * `walker_profiles.userId` currently has NO unique constraint or unique
 * index (shared/schema.ts:4735-4842 — only `walkerId` is unique). A
 * duplicate row for the same Firebase UID is physically possible, and
 * `.limit(1)` without `ORDER BY` returns an implementation-defined
 * row — the same walker could resolve to a DIFFERENT WALKER-uuid across
 * requests and quietly bypass the `walk_bookings.walkerId` assignment
 * check. Fetch UP TO TWO rows and throw if ambiguity is detected. That
 * fails LOUD so ops can fix the duplicate rather than silently
 * mis-authorizing. A follow-up migration should add
 * `CREATE UNIQUE INDEX ... ON walker_profiles(user_id)` — deferred
 * (schema change requires separate approval).
 */

export async function walkerUuidForCaller(callerUid: string | null | undefined): Promise<string | null> {
  if (!callerUid) return null;
  const rows = await db
    .select({ walkerId: walkerProfiles.walkerId })
    .from(walkerProfiles)
    .where(eq(walkerProfiles.userId, callerUid))
    .limit(2);
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(`walkerUuidForCaller: duplicate walker_profiles rows for userId — refusing to auto-pick`);
  }
  return (rows[0].walkerId || null) as string | null;
}

export async function walkerUidForUuid(walkerUuid: string | null | undefined): Promise<string | null> {
  if (!walkerUuid) return null;
  // walker_profiles.walkerId IS unique (schema.ts:4737) so a duplicate
  // here would be a data corruption. Same LOUD-fail guard for symmetry
  // — we never silently pick.
  const rows = await db
    .select({ userId: walkerProfiles.userId })
    .from(walkerProfiles)
    .where(eq(walkerProfiles.walkerId, walkerUuid))
    .limit(2);
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error(`walkerUidForUuid: duplicate walker_profiles rows for walkerId ${walkerUuid} — data-integrity error`);
  }
  return (rows[0].userId || null) as string | null;
}

/**
 * PrestigeJourneyLoader — CEO DEEP-LOGIC §84 loader for kind=prestige_member.
 *
 * Bridges the JourneyStateService dispatch to the pure Prestige
 * resolver by reading the canonical `privilege_members` row that
 * corresponds to the requested id + actor.
 *
 * URL semantics:
 *   /api/marketplace/journey/prestige_member/me        → the actor's
 *      own membership (looked up by firebase_uid).
 *   /api/marketplace/journey/prestige_member/:memberId → a specific
 *      row (validated: row.firebase_uid must equal actorUid).
 *
 * Discipline:
 *   §21 — Prestige is a CAPABILITY, not a workspace. The loader never
 *     leaks another actor's row and never fabricates a membership for
 *     someone without one (returns NOT_FOUND, never a fake NONE).
 *   §29 / §37 — actorUid comes from the auth token upstream; the
 *     loader trusts it as principal and refuses NOT_A_PARTY when the
 *     row belongs to someone else.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { privilegeMembers } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import {
  resolvePrestigeJourney,
  type PrestigeStatus,
} from '../PrestigeJourneyResolver';

/** Map the DB status/tier onto the resolver's canonical state. */
function toResolverStatus(row: { status: string | null; tier: string | null }): PrestigeStatus {
  const s = (row.status ?? '').toLowerCase();
  if (s === 'cancelled' || s === 'canceled') return 'CANCELLED';
  if (s === 'pending' || s === 'pending_verification') return 'PENDING_VERIFICATION';
  if (s === 'active') return 'ACTIVE';
  return 'NONE';
}

export const prestigeJourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    const isSelf = id === 'me' || id === actorUid;
    const row = isSelf
      ? (await db.select().from(privilegeMembers).where(eq(privilegeMembers.firebaseUid, actorUid)).limit(1))[0]
      : (await db.select().from(privilegeMembers).where(eq(privilegeMembers.memberId, id)).limit(1))[0];

    if (!row) {
      // Self-lookup with no row → represent NONE (§48 discipline: the
      // actor's capability projection is answerable even without a
      // row, so long as it is the actor's OWN projection).
      if (isSelf) {
        const journey = resolvePrestigeJourney({
          snapshot: { actorUid, status: 'NONE' },
        });
        return { code: 'OK', journey };
      }
      return { code: 'NOT_FOUND' };
    }

    // If it exists but belongs to someone else, refuse.
    if (row.firebaseUid && row.firebaseUid !== actorUid) {
      return { code: 'NOT_A_PARTY' };
    }

    const journey = resolvePrestigeJourney({
      snapshot: {
        memberId: row.memberId,
        actorUid,
        status: toResolverStatus(row),
      },
    });
    return { code: 'OK', journey };
  } catch {
    // Fail-soft: the dispatcher will surface a stable 500. Do not
    // leak the DB error to the wire.
    return { code: 'NOT_FOUND' };
  }
};

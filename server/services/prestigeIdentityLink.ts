/**
 * CEO FLY MODE II §12–§20 (2026-08-29) — Prestige identity linking.
 *
 * Purpose: bridge legacy email-keyed Prestige memberships to the
 * canonical Firebase UID. Executes ONLY the safe-legacy-claim rule
 * (§14):
 *
 *   • The caller is a Firebase-authenticated human whose email_verified
 *     is TRUE (server-verified — never trust an unverified body field).
 *   • A privilege_members row matches by NORMALIZED lowercase email.
 *   • That row's firebase_uid IS NULL.
 *   • No other privilege_members row already links to this UID (§14
 *     "no another membership already linked to this UID").
 *
 * When ALL preconditions hold: atomically stamp firebase_uid on the
 * legacy row.
 *
 * When ANY precondition fails: return a `NoLinkReason` — the caller
 * MUST NOT auto-merge, MUST NOT force, MUST NOT rewrite records.
 * Conflicts are flagged for human reconciliation (§14).
 *
 * NOT covered here (per §15):
 *   • No linking on unverified email.
 *   • No linking from body-supplied email — the caller passes the
 *     server-derived email from the verified auth context, or nothing.
 *   • No name/phone heuristics — those are for a separate
 *     reconciliation surface a human operator drives.
 *
 * Idempotency (§18): the linking operation is UID + operation-keyed.
 * If the same UID is already linked to the same row, we return
 * ALREADY_LINKED_SAME_ROW — idempotent success, no throw.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { privilegeMembers } from '../../shared/schema';
import { logger } from '../lib/logger';

export type PrestigeLinkResult =
  | {
      ok: true;
      outcome: 'LINKED' | 'ALREADY_LINKED_SAME_ROW';
      memberId: string;
      firebaseUid: string;
    }
  | { ok: false; reason: NoLinkReason };

export type NoLinkReason =
  | 'MISSING_UID'
  | 'MISSING_EMAIL'
  | 'EMAIL_NOT_VERIFIED'
  | 'NO_LEGACY_MEMBER'
  | 'MEMBER_ALREADY_LINKED_TO_DIFFERENT_UID'
  | 'UID_ALREADY_LINKED_TO_DIFFERENT_MEMBER'
  | 'RACE_ON_LINK'
  | 'LOOKUP_FAILED';

export interface LinkPrestigeMembershipInput {
  /**
   * The authenticated Firebase UID — server-derived from the request's
   * decoded ID token / session cookie. NEVER a client body field.
   */
  firebaseUid: string;
  /**
   * The email from the same verified auth context — decoded from the
   * ID token, not from the request body.
   */
  emailFromAuthContext: string | null | undefined;
  /**
   * True iff the auth context confirms Firebase email_verified === true.
   * Server MUST derive this; a client-body "trust me" is refused.
   */
  emailVerified: boolean;
}

function normalize(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = String(email).trim().toLowerCase();
  return trimmed || null;
}

/**
 * Attempt the CEO §14 safe-legacy-claim atomic link.
 *
 * The write is a conditional UPDATE that requires firebase_uid IS NULL
 * on the target row — so a race between two servers picking the same
 * legacy row resolves via row-level locking + the partial-unique
 * index landed in migrations/0134_privilege_members_firebase_uid_*.
 * The second write returns 0 rows affected → RACE_ON_LINK.
 */
export async function linkPrestigeMembershipToFirebaseUid(
  input: LinkPrestigeMembershipInput,
): Promise<PrestigeLinkResult> {
  const uid = String(input.firebaseUid || '').trim();
  if (!uid) return { ok: false, reason: 'MISSING_UID' };

  const email = normalize(input.emailFromAuthContext);
  if (!email) return { ok: false, reason: 'MISSING_EMAIL' };

  if (!input.emailVerified) return { ok: false, reason: 'EMAIL_NOT_VERIFIED' };

  try {
    // Precondition read #1: is this UID already linked to a Prestige row?
    // If yes AND it matches the email row we would target, return
    // ALREADY_LINKED_SAME_ROW (idempotent). If yes AND it matches a
    // different row, refuse — conflict for a human to reconcile.
    const [existingByUid] = await db
      .select({
        memberId: privilegeMembers.memberId,
        email: privilegeMembers.email,
      })
      .from(privilegeMembers)
      .where(eq(privilegeMembers.firebaseUid, uid))
      .limit(1);
    if (existingByUid) {
      if (normalize(existingByUid.email) === email) {
        return {
          ok: true,
          outcome: 'ALREADY_LINKED_SAME_ROW',
          memberId: existingByUid.memberId,
          firebaseUid: uid,
        };
      }
      logger.warn('[PrestigeLink] UID already linked to a different membership — refusing auto-merge (CEO §14)', {
        uid,
      });
      return { ok: false, reason: 'UID_ALREADY_LINKED_TO_DIFFERENT_MEMBER' };
    }

    // Precondition read #2: does a legacy row with this email exist?
    const [legacyByEmail] = await db
      .select({
        memberId: privilegeMembers.memberId,
        firebaseUid: privilegeMembers.firebaseUid,
      })
      .from(privilegeMembers)
      .where(eq(sql`lower(${privilegeMembers.email})`, email))
      .limit(1);
    if (!legacyByEmail) return { ok: false, reason: 'NO_LEGACY_MEMBER' };
    if (legacyByEmail.firebaseUid && legacyByEmail.firebaseUid !== uid) {
      logger.warn('[PrestigeLink] Legacy member already linked to a different UID — refusing auto-merge (CEO §14)', {
        memberId: legacyByEmail.memberId,
      });
      return { ok: false, reason: 'MEMBER_ALREADY_LINKED_TO_DIFFERENT_UID' };
    }

    // Atomic write: WHERE clause pins firebase_uid IS NULL so a
    // simultaneous link attempt from another server loses the race.
    const updated = await db
      .update(privilegeMembers)
      .set({ firebaseUid: uid, updatedAt: new Date() })
      .where(and(
        eq(sql`lower(${privilegeMembers.email})`, email),
        isNull(privilegeMembers.firebaseUid),
      ))
      .returning({ memberId: privilegeMembers.memberId });

    if (updated.length === 0) {
      // Two possibilities: (a) another server won the race and stamped
      // firebase_uid in the microsecond between our precondition read
      // and our UPDATE, or (b) the partial-unique index caught a
      // conflict (already-linked-to-a-different-uid at commit time).
      logger.warn('[PrestigeLink] Atomic link WHERE-firebase_uid-IS-NULL matched 0 rows — retryable race or late conflict', {
        uid,
      });
      return { ok: false, reason: 'RACE_ON_LINK' };
    }

    logger.info('[PrestigeLink] Legacy Prestige membership linked to Firebase UID (CEO §14)', {
      uid,
      memberId: updated[0].memberId,
    });
    return {
      ok: true,
      outcome: 'LINKED',
      memberId: updated[0].memberId,
      firebaseUid: uid,
    };
  } catch (err: any) {
    logger.error('[PrestigeLink] linkPrestigeMembershipToFirebaseUid failed', {
      uid,
      error: err?.message,
    });
    return { ok: false, reason: 'LOOKUP_FAILED' };
  }
}

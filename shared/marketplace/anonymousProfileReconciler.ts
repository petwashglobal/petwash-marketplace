/**
 * AnonymousProfileReconciler — CEO P0-CEP Batch §1.
 *
 * Doctrine: "Batch tracks a device from the very first launch as
 * an ANONYMOUS profile — attributes, events, saved searches. The
 * moment the same person signs up or signs in, the anonymous
 * profile MERGES into the identified one. We must not lose the
 * pre-signup context (what they browsed, what they favourited,
 * what search brought them). And we must not confuse two people
 * who used the same phone at different times."
 *
 * This file DECLARES the shapes for anonymous vs identified
 * profiles, and the pure evaluator that verdicts a merge attempt:
 *
 *   reconcile({ anonymous, identified, now }) →
 *     MERGE_INTO_IDENTIFIED  — carry the anonymous context over,
 *                              then retire the anonymous profile.
 *     KEEP_SEPARATE          — refuse (identified profile is fresher,
 *                              or the anonymous profile is already
 *                              tied to a different UID, or the
 *                              anonymous profile is empty and useless).
 *     REJECT                 — inputs invalid (e.g. no anonymousId).
 *
 * Pure — no DB, no clock injection beyond `now`. The runtime
 * reconciler wires this evaluator to (a) the anonymous device store,
 * (b) users.identityAccounts, and (c) the outbox emitting
 * profile.reconciled events.
 *
 * Placed in shared/ so both the auth handler (server) and any
 * pre-signup client cache have one vocabulary.
 */

export interface AnonymousProfileSnapshot {
  /** Device-scoped id. Never a UID. */
  anonymousId: string;
  /**
   * When the device first appeared. Used to break ties when two
   * anonymous profiles would otherwise both claim the same UID.
   */
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Optional last recorded intent that would be worth preserving. */
  savedSearches?: readonly string[];
  favourites?: readonly string[];
  /** Whether the anonymous profile has any state worth carrying. */
  hasAttributes: boolean;
  /**
   * If this anonymous profile has already been reconciled into a
   * UID, that UID is here. Reconciling it again to a different
   * UID must fail.
   */
  reconciledToUid?: string;
}

export interface IdentifiedProfileSnapshot {
  uid: string;
  createdAt: Date;
  /**
   * If a previous reconcile already merged an anonymous profile
   * into this UID, its id is here. That is fine — a UID may have
   * been the destination of many device reconciles over time (same
   * user, many devices).
   */
  lastReconciledAnonymousId?: string;
  lastReconciledAt?: Date;
}

export interface ReconcileInput {
  anonymous: AnonymousProfileSnapshot;
  identified: IdentifiedProfileSnapshot;
  now: Date;
}

export type ReconcileVerdict =
  | { code: 'MERGE_INTO_IDENTIFIED'; carriedItems: { savedSearches: readonly string[]; favourites: readonly string[] } }
  | { code: 'KEEP_SEPARATE'; reasonCode:
      | 'ANONYMOUS_EMPTY'                     // nothing worth carrying
      | 'ANONYMOUS_ALREADY_BOUND_ELSEWHERE'   // reconciledToUid ≠ identified.uid
      | 'ANONYMOUS_TOO_OLD'                   // firstSeenAt older than identified.createdAt by a large window (device likely belongs to a different person)
    }
  | { code: 'REJECT'; reasonCode:
      | 'NO_ANONYMOUS_ID'
      | 'NO_IDENTIFIED_UID'
    };

const ANONYMOUS_TOO_OLD_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export function reconcileAnonymousProfile(input: ReconcileInput): ReconcileVerdict {
  const { anonymous, identified } = input;

  if (!anonymous.anonymousId.trim()) {
    return { code: 'REJECT', reasonCode: 'NO_ANONYMOUS_ID' };
  }
  if (!identified.uid.trim()) {
    return { code: 'REJECT', reasonCode: 'NO_IDENTIFIED_UID' };
  }

  if (anonymous.reconciledToUid && anonymous.reconciledToUid !== identified.uid) {
    return { code: 'KEEP_SEPARATE', reasonCode: 'ANONYMOUS_ALREADY_BOUND_ELSEWHERE' };
  }

  const savedSearches = anonymous.savedSearches ?? [];
  const favourites = anonymous.favourites ?? [];
  if (!anonymous.hasAttributes && savedSearches.length === 0 && favourites.length === 0) {
    return { code: 'KEEP_SEPARATE', reasonCode: 'ANONYMOUS_EMPTY' };
  }

  // If the anonymous profile is much older than the identified
  // profile, it likely belongs to a different person who once
  // used this device — carrying their intent to a fresh account
  // is a privacy hazard.
  //
  // We compare firstSeenAt to identified.createdAt (not to now), so
  // a very old device merging into a brand-new account trips the
  // guard, while a same-day sign-up flow does not.
  const anonymousAge = identified.createdAt.getTime() - anonymous.firstSeenAt.getTime();
  if (anonymousAge > ANONYMOUS_TOO_OLD_MS) {
    return { code: 'KEEP_SEPARATE', reasonCode: 'ANONYMOUS_TOO_OLD' };
  }

  return {
    code: 'MERGE_INTO_IDENTIFIED',
    carriedItems: { savedSearches, favourites },
  };
}

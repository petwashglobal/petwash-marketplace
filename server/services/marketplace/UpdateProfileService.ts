/**
 * UpdateProfileService — CEO P0-MY-ACCOUNT step 4.
 *
 * Atomic canonical write for the users row + Firebase-claim fan-out
 * + server readback. Doctrine constraints:
 *   • Only fields classified CANONICAL in ProfileFieldAuthorityMap
 *     are writable; any other target is rejected.
 *   • Contact-change requires the ContactChangeStateMachine to have
 *     produced VERIFIED_PENDING_COMMIT — this service NEVER changes
 *     email or phone directly. It leaves the plain PROFILE fields
 *     (name / dob / language / address / etc.) to the direct patch
 *     path and delegates email/phone to the verified-commit path.
 *   • Server readback is included in the response so the client can
 *     render server truth (never a false success).
 *   • Split-brain guard: caller supplies a canonicalWrite +
 *     firebaseUpdate effect. If Firebase succeeds but DB fails, or
 *     vice-versa, the response is UPDATE_PARTIAL_ROLLBACK_REQUIRED
 *     and the caller must reconcile.
 *
 * The service is pure at the decision boundary; effects come in via
 * two typed dependencies so tests can exercise every branch end-to-
 * end without touching Postgres / Firebase.
 */
import {
  canonicalEntryFor,
  type PersonalField,
} from './ProfileFieldAuthorityMap';

/** Fields the direct profile patch may set (excludes email/phone). */
export type DirectPatchField =
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'language'
  | 'profileImageUrl'
  | 'address'
  | 'city'
  | 'postalCode'
  | 'country';

export interface PatchInput {
  actorUid: string;
  patch: Partial<Record<DirectPatchField, string | null>>;
}

export interface CanonicalSnapshot {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  dateOfBirth?: string | null;
  language?: string | null;
  profileImageUrl?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface WriteEffects {
  /** Atomic write to the users row. Returns the row AS PERSISTED. */
  writeCanonical: (input: {
    actorUid: string;
    changes: Partial<Record<DirectPatchField, string | null>>;
  }) => Promise<CanonicalSnapshot>;
  /**
   * Fan out non-security claims to the identity provider (Firebase).
   * Errors here are surfaced by the split-brain guard.
   */
  updateFirebaseDisplayName?: (input: { actorUid: string; displayName: string }) => Promise<void>;
  /** Refresh the Prestige MIRROR row when relevant fields changed. */
  refreshPrestigeMirror?: (input: { actorUid: string; snapshot: CanonicalSnapshot }) => Promise<void>;
}

export type UpdateOutcome =
  | { code: 'OK'; snapshot: CanonicalSnapshot; fannedOut: string[] }
  | { code: 'REJECTED'; reasonCode:
      | 'NO_FIELDS'
      | 'FIELD_NOT_WRITABLE'
      | 'INVALID_ACTOR' }
  | { code: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED'; reasonCode: 'FIREBASE_UPDATE_FAILED' | 'PRESTIGE_MIRROR_FAILED'; snapshot: CanonicalSnapshot };

// ── Field-writable guard (uses ProfileFieldAuthorityMap) ──────────

const DIRECT_FIELDS: DirectPatchField[] = [
  'firstName', 'lastName', 'dateOfBirth', 'language',
  'profileImageUrl', 'address', 'city', 'postalCode', 'country',
];

function isDirectFieldAllowed(field: string): field is DirectPatchField {
  if (!DIRECT_FIELDS.includes(field as DirectPatchField)) return false;
  // Every DirectPatchField must map to a CANONICAL entry in the
  // authority map. Missing → this service refuses the write.
  return !!canonicalEntryFor(field as PersonalField);
}

// ── The main service ──────────────────────────────────────────────

export async function updateProfile(input: PatchInput, effects: WriteEffects): Promise<UpdateOutcome> {
  if (!input.actorUid || typeof input.actorUid !== 'string') {
    return { code: 'REJECTED', reasonCode: 'INVALID_ACTOR' };
  }
  const keys = Object.keys(input.patch);
  if (keys.length === 0) return { code: 'REJECTED', reasonCode: 'NO_FIELDS' };
  for (const k of keys) {
    if (!isDirectFieldAllowed(k)) return { code: 'REJECTED', reasonCode: 'FIELD_NOT_WRITABLE' };
  }

  // 1) Canonical DB write. If this fails the caller sees an error;
  //    we return the caller's exception path (throw).
  const snapshot = await effects.writeCanonical({
    actorUid: input.actorUid,
    changes: input.patch,
  });

  const fanned: string[] = [];

  // 2) Firebase displayName fan-out only when name actually changed.
  if (effects.updateFirebaseDisplayName && (input.patch.firstName != null || input.patch.lastName != null)) {
    const displayName = `${snapshot.firstName ?? ''} ${snapshot.lastName ?? ''}`.trim();
    try {
      await effects.updateFirebaseDisplayName({ actorUid: input.actorUid, displayName });
      fanned.push('FIREBASE_DISPLAY_NAME');
    } catch {
      return {
        code: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED',
        reasonCode: 'FIREBASE_UPDATE_FAILED',
        snapshot,
      };
    }
  }

  // 3) Prestige MIRROR refresh (identity fields).
  if (effects.refreshPrestigeMirror) {
    try {
      await effects.refreshPrestigeMirror({ actorUid: input.actorUid, snapshot });
      fanned.push('PRESTIGE_MIRROR');
    } catch {
      return {
        code: 'UPDATE_PARTIAL_ROLLBACK_REQUIRED',
        reasonCode: 'PRESTIGE_MIRROR_FAILED',
        snapshot,
      };
    }
  }

  return { code: 'OK', snapshot, fannedOut: fanned };
}

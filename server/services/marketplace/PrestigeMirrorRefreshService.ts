/**
 * PrestigeMirrorRefreshService — CEO P0-MY-ACCOUNT task #165.
 *
 * When UpdateProfileService writes the canonical users row, the
 * Prestige capability's MIRROR row (privilege_members) must reflect
 * the same identity so Prestige surfaces show the current name /
 * email / phone / dob / language.
 *
 * Rules:
 *   • Only fields declared MIRROR for privilege_members in
 *     ProfileFieldAuthorityMap are ever written by this service.
 *     Attempting to write anything else is a P0 bug and returns
 *     REJECTED(NOT_MIRROR).
 *   • No-op when the actor has no privilege_members row (missing
 *     Prestige capability is the common case).
 *   • Idempotent: repeated refreshes with the same snapshot produce
 *     the same row and never trigger cascading writes.
 *
 * Pure at the decision boundary; the actual UPDATE query is a
 * pluggable effect so tests exercise every branch without touching
 * Postgres.
 */
import {
  mirrorEntriesFor,
  type PersonalField,
} from './ProfileFieldAuthorityMap';

/** Identity fields that may be mirrored to privilege_members. */
export type PrestigeMirrorField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'dateOfBirth'
  | 'language';

export interface RefreshInput {
  actorUid: string;
  snapshot: Partial<Record<PrestigeMirrorField, string | null | undefined>>;
}

export interface RefreshEffects {
  /** Returns the number of rows affected. 0 means the actor has no Prestige row. */
  writeMirror: (input: {
    actorUid: string;
    changes: Partial<Record<PrestigeMirrorField, string | null>>;
  }) => Promise<number>;
}

export type RefreshOutcome =
  | { code: 'OK'; fieldsWritten: PrestigeMirrorField[] }
  | { code: 'NO_PRESTIGE_ROW' }
  | { code: 'REJECTED'; reasonCode: 'NOT_MIRROR' | 'INVALID_ACTOR' | 'NO_FIELDS' };

const MIRRORABLE: readonly PrestigeMirrorField[] = [
  'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'language',
];

/**
 * Guard: every field this service tries to write must be declared
 * MIRROR on privilege_members in ProfileFieldAuthorityMap. If the
 * map ever loses a field, this guard fails fast rather than
 * silently ceasing to mirror.
 */
function isMirrorable(field: string): field is PrestigeMirrorField {
  if (!MIRRORABLE.includes(field as PrestigeMirrorField)) return false;
  const mirrors = mirrorEntriesFor(field as PersonalField);
  return mirrors.some((m) => m.table === 'privilege_members');
}

export async function refreshPrestigeMirror(
  input: RefreshInput,
  effects: RefreshEffects,
): Promise<RefreshOutcome> {
  if (!input.actorUid || typeof input.actorUid !== 'string') {
    return { code: 'REJECTED', reasonCode: 'INVALID_ACTOR' };
  }
  const providedKeys = Object.keys(input.snapshot).filter(
    (k) => input.snapshot[k as PrestigeMirrorField] !== undefined,
  );
  if (providedKeys.length === 0) return { code: 'REJECTED', reasonCode: 'NO_FIELDS' };
  for (const k of providedKeys) {
    if (!isMirrorable(k)) return { code: 'REJECTED', reasonCode: 'NOT_MIRROR' };
  }

  const changes: Partial<Record<PrestigeMirrorField, string | null>> = {};
  for (const k of providedKeys) {
    const v = input.snapshot[k as PrestigeMirrorField];
    changes[k as PrestigeMirrorField] = v === undefined ? null : v;
  }

  const affected = await effects.writeMirror({ actorUid: input.actorUid, changes });
  if (affected === 0) return { code: 'NO_PRESTIGE_ROW' };
  return { code: 'OK', fieldsWritten: providedKeys as PrestigeMirrorField[] };
}

/**
 * ProfileFieldAuthorityMap — CEO P0-MY-ACCOUNT audit deliverable.
 *
 * Doctrine: "ONE HUMAN / ONE PETWASH ACCOUNT / ONE FIREBASE UID /
 * ONE CANONICAL PERSONAL PROFILE." Provider / Prestige are additive
 * capabilities; personal identity fields must NEVER be authored in
 * more than one place.
 *
 * This file is the machine-readable, source-anchored classification
 * of every account-adjacent field in the codebase. Every subsequent
 * commit in the P0-MY-ACCOUNT lane reads against this map. A new
 * write path landing on a MIRROR / LEGACY field breaks the
 * regression pin next to it.
 *
 * Classifications:
 *   CANONICAL — the one authoritative row for this field. My Account
 *               writes go here first; everything else refreshes.
 *   MIRROR    — legitimate read cache / capability-scoped copy.
 *               Reads OK. Writes forbidden except through the
 *               canonical write path fanning out.
 *   LEGACY    — historical duplicate. Do NOT write. Read only if a
 *               downstream still needs it during migration.
 *   BUG       — a duplicate that should not exist. Slated for
 *               deletion. Writes to this location are a P0 bug.
 *
 * Every entry names the exact SQL table + column so grep hits the
 * source. Filename is not enough — the classification travels with
 * the column tuple.
 */

export type FieldAuthority = 'CANONICAL' | 'MIRROR' | 'LEGACY' | 'BUG';

export type PersonalField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'dateOfBirth'
  | 'language'
  | 'profileImageUrl'
  | 'address'
  | 'city'
  | 'postalCode'
  | 'country';

export interface AuthorityEntry {
  field: PersonalField;
  table: string;                           // SQL table name
  column: string;                          // SQL column name
  authority: FieldAuthority;
  notes: string;
}

/**
 * The doctrine's authority contract. Additions land here in the
 * SAME commit as the schema change that introduces them.
 */
export const PROFILE_FIELD_AUTHORITY_MAP: readonly AuthorityEntry[] = [
  // ── CANONICAL row: users (Firebase UID keyed) ─────────────────
  { field: 'firstName',       table: 'users', column: 'first_name',        authority: 'CANONICAL', notes: 'My Account writes here first; Firebase claims fan-out downstream.' },
  { field: 'lastName',        table: 'users', column: 'last_name',         authority: 'CANONICAL', notes: 'Same as firstName — canonical.' },
  { field: 'email',           table: 'users', column: 'email',             authority: 'CANONICAL', notes: 'Must equal the verified Firebase primary email; change flow re-verifies.' },
  { field: 'phone',           table: 'users', column: 'phone',             authority: 'CANONICAL', notes: 'E.164 verified via OTP; change flow re-verifies.' },
  { field: 'dateOfBirth',     table: 'users', column: 'date_of_birth',     authority: 'CANONICAL', notes: 'Immutable after activation except by admin path.' },
  { field: 'language',        table: 'users', column: 'language',          authority: 'CANONICAL', notes: 'Notifications/UI locale.' },
  { field: 'profileImageUrl', table: 'users', column: 'profile_image_url', authority: 'CANONICAL', notes: 'Optional; no face-recognition inferred.' },
  { field: 'address',         table: 'users', column: 'address',           authority: 'CANONICAL', notes: 'Personal address. Provider business address lives on provider tables.' },
  { field: 'city',            table: 'users', column: 'city',              authority: 'CANONICAL', notes: '' },
  { field: 'postalCode',      table: 'users', column: 'postal_code',       authority: 'CANONICAL', notes: '' },
  { field: 'country',         table: 'users', column: 'country',           authority: 'CANONICAL', notes: 'Defaults to IL.' },

  // ── MIRROR rows: legitimate capability-scoped snapshots ───────
  { field: 'firstName',       table: 'privilege_members',  column: 'first_name', authority: 'MIRROR', notes: 'Prestige capability snapshot; refresh from users.' },
  { field: 'lastName',        table: 'privilege_members',  column: 'last_name',  authority: 'MIRROR', notes: 'Prestige mirror.' },
  { field: 'email',           table: 'privilege_members',  column: 'email',      authority: 'MIRROR', notes: 'Prestige mirror.' },
  { field: 'phone',           table: 'privilege_members',  column: 'phone',      authority: 'MIRROR', notes: 'Prestige mirror.' },
  { field: 'dateOfBirth',     table: 'privilege_members',  column: 'dob',        authority: 'MIRROR', notes: 'Prestige mirror; refreshes from users.' },
  { field: 'language',        table: 'privilege_members',  column: 'language',   authority: 'MIRROR', notes: 'Prestige mirror.' },

  // ── LEGACY rows: application intake tables ────────────────────
  // The provider / staff / marketplace application tables snapshot
  // the applicant's identity at intake time. They are LEGACY for
  // ongoing profile writes — they exist as an intake record only.
  { field: 'firstName',   table: 'provider_applications',    column: 'first_name',    authority: 'LEGACY', notes: 'Application intake snapshot; NEVER updated by My Account.' },
  { field: 'lastName',    table: 'provider_applications',    column: 'last_name',     authority: 'LEGACY', notes: 'Intake snapshot.' },
  { field: 'email',       table: 'provider_applications',    column: 'email',         authority: 'LEGACY', notes: 'Intake snapshot.' },
  { field: 'phone',       table: 'provider_applications',    column: 'phone',         authority: 'LEGACY', notes: 'Intake snapshot.' },
  { field: 'dateOfBirth', table: 'provider_applications',    column: 'date_of_birth', authority: 'LEGACY', notes: 'Intake snapshot.' },

  { field: 'firstName',   table: 'staff_applications',       column: 'first_name',    authority: 'LEGACY', notes: 'HR intake snapshot.' },
  { field: 'lastName',    table: 'staff_applications',       column: 'last_name',     authority: 'LEGACY', notes: 'HR intake snapshot.' },
  { field: 'email',       table: 'staff_applications',       column: 'email',         authority: 'LEGACY', notes: 'HR intake snapshot.' },

  // ── Provider display / business fields (SEPARATE domain) ──────
  // These are NOT personal-profile mirrors. Provider public display
  // name may differ from the human's legal name. They live in the
  // provider profile authority and are edited via Provider Settings.
  // Listed here for completeness so a My Account change never
  // silently overwrites them.
  { field: 'firstName', table: 'providers', column: 'business_display_name', authority: 'MIRROR', notes: 'PROVIDER-CONTROLLED. Not overwritten by personal-profile edits.' },
];

// ── Guards + helpers ──────────────────────────────────────────────

export function canonicalEntryFor(field: PersonalField): AuthorityEntry | undefined {
  return PROFILE_FIELD_AUTHORITY_MAP.find((e) => e.field === field && e.authority === 'CANONICAL');
}

export function mirrorEntriesFor(field: PersonalField): AuthorityEntry[] {
  return PROFILE_FIELD_AUTHORITY_MAP.filter((e) => e.field === field && e.authority === 'MIRROR');
}

/**
 * The rule the doctrine encodes: any WRITE to a non-CANONICAL entry
 * for a personal field is a P0 bug. This predicate lets writers
 * gate themselves so the "duplicate write authority" class of bug
 * is caught before it ships.
 */
export function isWriteAllowed(field: PersonalField, table: string, column: string): boolean {
  const canonical = canonicalEntryFor(field);
  if (!canonical) return false;
  return canonical.table === table && canonical.column === column;
}

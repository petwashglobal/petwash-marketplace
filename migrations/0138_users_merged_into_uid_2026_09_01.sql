-- =====================================================================
-- Migration 0138 · Phase 6.a → 6.b · users.merged_into_uid column
-- Date: 2026-09-01
-- Owner: auth-rebuild (CEO directive 2026-09-01, D6)
--
-- Purpose: give the SOFT-MERGE tool (server/routes/admin-identity-
-- soft-merge.ts) a schema slot to write into, so a legacy duplicate
-- identity can be marked as merged INTO a primary without ever
-- destructively re-parenting money / bookings / tax / audit rows.
--
-- SOFT-MERGE MODEL (CEO D6):
--   * When super-admin merges SECONDARY into PRIMARY:
--       UPDATE users
--          SET merged_into_uid = <PRIMARY>
--        WHERE id = <SECONDARY>;
--   * Identity resolution at login time follows merged_into_uid: any
--     hit on the SECONDARY resolves to the PRIMARY user row for auth
--     purposes.
--   * Historical financial / tax / audit / booking / receipt rows KEEP
--     their original uid — they are immutable evidence and never
--     rewritten.
--   * REVERSIBLE: clearing merged_into_uid restores the two separate
--     identities and their independent histories.
--
-- ADDITIVE ONLY. Nullable. No default. No writer today (Phase 6.b
-- lands the write path alongside the corresponding preview endpoint).
--
-- The column stores the PRIMARY user's uid — matching the existing
-- users.id column shape (Firebase UID, varchar). We index it so
-- (a) the resolver can look "what users merged INTO this uid" cheaply
-- for the /soft-merge/unmerge audit view, and (b) so a foreign-key
-- lookup during merge doesn't table-scan.
--
-- NO foreign key constraint on merged_into_uid → users.id: users.id
-- is a Firebase UID (external identity), and hard FK enforcement on
-- an identity column that can be re-issued outside our DB is risky.
-- Application-layer validation is enough — same pattern as identity_
-- accounts.user_id.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS merged_into_uid varchar(64);

-- Partial index: only merged rows carry a value, so a partial index
-- is small and cheap even at 10^7 users.
CREATE INDEX IF NOT EXISTS idx_users_merged_into_uid
  ON users (merged_into_uid)
  WHERE merged_into_uid IS NOT NULL;

COMMENT ON COLUMN users.merged_into_uid IS
  'Soft-merge target: when set, this user row is a merged secondary and identity resolution should return the users row with id = merged_into_uid. Reversible: clear this to restore the original identity. NEVER used to re-parent financial or audit rows. See server/routes/admin-identity-soft-merge.ts.';

-- =====================================================================
-- Rollback:
--   DROP INDEX IF EXISTS idx_users_merged_into_uid;
--   ALTER TABLE users DROP COLUMN merged_into_uid;
-- Safe: nothing depends on this column pre-Phase-6.b.
-- =====================================================================

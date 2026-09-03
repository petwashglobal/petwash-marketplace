-- =====================================================================
-- Migration 0134 · Phase 2 · user_passkeys lossless-cutover columns
-- Date: 2026-09-01
-- Owner: auth-rebuild (CEO directive 2026-09-01)
--
-- Purpose: expand `user_passkeys` (migrations/0044) so it can hold every
-- field the live Firestore WebAuthn writers persist today, without
-- data loss. Prerequisite for the Phase 2 Firestore→Postgres dual-write
-- shim.
--
-- ADDITIVE ONLY. Every column is nullable OR has a safe default. No
-- existing rows change. No indexes dropped. No table dropped. Safe to
-- roll back by dropping the added columns; nothing on main reads them
-- yet.
--
-- Origins per column: server/webauthn/service.ts +
-- server/webauthn/deviceRegistry.ts (web writer) and
-- server/routes/mobile-biometric.ts (mobile writer). Field audit:
-- tasks/aa913799be9f05f8f (2026-09-01).
-- =====================================================================

-- WebAuthn L2 backup semantics — currently only `backed_up` is stored.
-- Add `backup_eligible` (BE) and `backup_state` (BS) separately for
-- spec parity. `backed_up` stays for backward compat and is treated as
-- an alias for `backup_state` at read time.
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS backup_eligible boolean;
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS backup_state boolean;

-- Discoverable-credential flag (resident key). Both live writers create
-- discoverable creds today; record it explicitly for future non-
-- discoverable enrollment flows.
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT true;

-- Revocation. Firestore soft-deletes via `isRevoked=true`. Postgres needs
-- the same shape or every "list active passkeys" query would return
-- revoked rows.
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS is_revoked boolean NOT NULL DEFAULT false;
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS revoked_at timestamp;
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS revoked_reason varchar(40);
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS revoked_by varchar;
-- Active-only lookup index for the "any active passkey for this user?"
-- query pattern. Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_user_passkeys_active
  ON user_passkeys (user_id)
  WHERE is_revoked = false;

-- Live security gate: trust_score (0..100), drives whether a passkey
-- may be used for auth (server/webauthn/service.ts:422, :636, :803).
-- Web writer starts at 50; mobile writer starts at 100. Migration picks
-- 50 as the safer neutral default and lets calculateDeviceTrustScore
-- catch up on first auth.
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS trust_score smallint NOT NULL DEFAULT 50;

-- Usage counters (unified across web/mobile divergence).
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS last_auth_failure_at timestamp;

-- Attestation posture — auditor / risk view of "is this hardware-backed?"
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS attestation_format varchar(40);

-- Presentation metadata — replaces the `label` column at read time (but
-- `label` stays for backward compat). Enables the device-list UI without
-- a JOIN.
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS platform varchar(16);
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS os_version varchar(32);
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS browser_name varchar(32);
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS browser_version varchar(32);
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS device_name varchar(120);

-- Registration provenance snapshots (anti-phishing forensic — a small
-- inline snapshot; deeper history goes to audit_events).
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS registration_user_agent text;
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS registration_ip varchar(45);
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS registration_origin varchar(255);

-- Realm — Firestore splits by parent path (users/{uid} vs employees/{uid}).
-- Postgres has only user_id, so preserve the split until a unified role
-- discriminator lives on `users` and can be joined.
ALTER TABLE user_passkeys
  ADD COLUMN IF NOT EXISTS realm varchar(10) NOT NULL DEFAULT 'user';
CREATE INDEX IF NOT EXISTS idx_user_passkeys_realm_user
  ON user_passkeys (realm, user_id);

-- =====================================================================
-- Rollback (manual, safe):
--
--   ALTER TABLE user_passkeys DROP COLUMN backup_eligible;
--   ALTER TABLE user_passkeys DROP COLUMN backup_state;
--   ALTER TABLE user_passkeys DROP COLUMN is_discoverable;
--   ALTER TABLE user_passkeys DROP COLUMN is_revoked;
--   ALTER TABLE user_passkeys DROP COLUMN revoked_at;
--   ALTER TABLE user_passkeys DROP COLUMN revoked_reason;
--   ALTER TABLE user_passkeys DROP COLUMN revoked_by;
--   DROP INDEX IF EXISTS idx_user_passkeys_active;
--   ALTER TABLE user_passkeys DROP COLUMN trust_score;
--   ALTER TABLE user_passkeys DROP COLUMN usage_count;
--   ALTER TABLE user_passkeys DROP COLUMN consecutive_failures;
--   ALTER TABLE user_passkeys DROP COLUMN last_auth_failure_at;
--   ALTER TABLE user_passkeys DROP COLUMN attestation_format;
--   ALTER TABLE user_passkeys DROP COLUMN platform;
--   ALTER TABLE user_passkeys DROP COLUMN os_version;
--   ALTER TABLE user_passkeys DROP COLUMN browser_name;
--   ALTER TABLE user_passkeys DROP COLUMN browser_version;
--   ALTER TABLE user_passkeys DROP COLUMN device_name;
--   ALTER TABLE user_passkeys DROP COLUMN registration_user_agent;
--   ALTER TABLE user_passkeys DROP COLUMN registration_ip;
--   ALTER TABLE user_passkeys DROP COLUMN registration_origin;
--   ALTER TABLE user_passkeys DROP COLUMN realm;
--   DROP INDEX IF EXISTS idx_user_passkeys_realm_user;
-- =====================================================================

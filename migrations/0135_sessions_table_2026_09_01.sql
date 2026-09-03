-- =====================================================================
-- Migration 0135 · Phase 3 · first-class sessions table
-- Date: 2026-09-01
-- Owner: auth-rebuild (CEO directive 2026-09-01)
--
-- Purpose: introduce a Pet Wash-owned session table so we can revoke
-- individual sessions, list active devices per user, and support "sign
-- out this device" and "sign out everywhere" — neither of which is
-- possible against the opaque Firebase session cookie alone.
--
-- Per CEO D3:
--   - Pet Wash owns its own opaque random session identifier (32 bytes
--     hex, minted server-side, cryptographically random)
--   - Cookie carries the opaque id (HttpOnly, Secure, SameSite Lax,
--     rotated on privilege elevation)
--   - Server stores only the SHA-256 hash of the id (never the raw id)
--   - Per-session revocation via revoked_at + revoked_reason
--   - Redis cache invalidation on revoke — NOT TTL drift
--     (implemented in the Phase 3 session service, not this migration)
--
-- ADDITIVE ONLY. Table is created empty, no reader/writer today. The
-- Phase 3.x session service will mint rows on /api/auth/session and
-- read them on every authenticated request.
--
-- The `active_role` column belongs to Phase 5 (activeRole) but ships
-- here because moving it later would be a schema break. Nullable; only
-- populated once Phase 5 wires it.
-- =====================================================================

CREATE TABLE IF NOT EXISTS sessions_pw (
  -- Row id. Not the session identifier — the opaque id lives only in
  -- session_id_hash + the cookie. Row id is for internal joins.
  id                    bigserial PRIMARY KEY,

  -- SHA-256 hash of the opaque session id. Cookie carries the raw id;
  -- server hashes on lookup and matches. Storing only the hash means a
  -- DB leak does not expose live sessions.
  session_id_hash       varchar(64) NOT NULL,

  -- Canonical user id (users.id / Firebase UID).
  user_id               varchar NOT NULL,

  -- Provider that established this session (google | apple | phone |
  -- email | password | passkey | pin | firebase-legacy). Same vocabulary
  -- as identity_accounts.provider.
  auth_method           varchar(30),

  -- Which authorised role the caller is CURRENTLY operating in.
  -- Nullable — populated by the Phase 5 activeRole flow. Never grants
  -- authority; authority is always the capabilities aggregator.
  active_role           varchar(30),

  -- Optional per-installation reference. FK-style, not enforced yet
  -- (devices table lands in Phase 9). NULL = "unrecognized device".
  device_ref            varchar,

  -- Lifecycle timestamps.
  created_at            timestamp NOT NULL DEFAULT now(),
  last_seen_at          timestamp NOT NULL DEFAULT now(),
  expires_at            timestamp NOT NULL,
  revoked_at            timestamp,
  revoked_reason        varchar(60),

  -- Registration provenance snapshots. Full history goes to
  -- audit_events; these inline snapshots let us render "signed in from
  -- iPhone Safari, Tel Aviv" without a JOIN.
  registration_ip       varchar(45),
  registration_user_agent varchar(400),

  -- Last-seen provenance — updated by the session service on every
  -- request (rate-limited to avoid write amplification).
  last_seen_ip          varchar(45),
  last_seen_user_agent  varchar(400)
);

-- Primary lookup — hash → session (constant-time hash comparison happens
-- above the DB; the index is a simple B-tree). UNIQUE prevents duplicate
-- mints from a race.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_pw_session_id_hash
  ON sessions_pw (session_id_hash);

-- "List my active sessions" — partial index on non-revoked, non-expired.
-- The service filters again in SQL; the index just keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_sessions_pw_user_active
  ON sessions_pw (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

-- Housekeeping: expired-session sweep (a scheduled job flips revoked_at
-- on expired rows so revocation lookups stay uniform).
CREATE INDEX IF NOT EXISTS idx_sessions_pw_expires_at
  ON sessions_pw (expires_at)
  WHERE revoked_at IS NULL;

-- =====================================================================
-- Rollback:
--   DROP INDEX IF EXISTS uq_sessions_pw_session_id_hash;
--   DROP INDEX IF EXISTS idx_sessions_pw_user_active;
--   DROP INDEX IF EXISTS idx_sessions_pw_expires_at;
--   DROP TABLE IF EXISTS sessions_pw;
--
-- Safe: no writer exists yet. Table is empty in production.
-- =====================================================================

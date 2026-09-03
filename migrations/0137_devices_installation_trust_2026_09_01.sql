-- =====================================================================
-- Migration 0137 · Phase 9 · devices — installation trust model
-- Date: 2026-09-01
-- Owner: auth-rebuild (CEO directive 2026-09-01, D4 correction)
--
-- Purpose: the slim `devices` table Phase 9 introduces per CEO D4.
--
-- Per CEO D4 correction:
--   - device = known app/browser installation, NOT an invasive hardware
--     fingerprint
--   - passkeys belong to the USER, not to a device (synced passkeys)
--   - trust_level is a UX signal, NEVER an authentication factor by
--     itself. A recognized device may improve UX ("Welcome back") but
--     the user still needs proper authentication (passkey / Apple /
--     Google / recovery)
--
-- The heavy `user_devices` table (21 cols with IP location, WiFi SSID
-- encrypted, browser fingerprint, etc.) stays untouched — Phase 10
-- decides its retirement. This new table is intentionally slim.
--
-- ADDITIVE ONLY. No writer today. Phase 9 runtime code + regression
-- pin land in separate commits.
-- =====================================================================

CREATE TABLE IF NOT EXISTS devices_pw (
  -- Row id.
  id                bigserial PRIMARY KEY,

  -- Which canonical user this installation belongs to.
  user_id           varchar NOT NULL,

  -- Opaque installation identifier — persisted in the app's own storage
  -- (e.g. IndexedDB) and echoed back on every authenticated request.
  -- Server verifies (user_id, install_id) is a known pair. NOT a
  -- hardware fingerprint — the client generates it once per install
  -- via crypto.randomUUID().
  install_id        varchar(64) NOT NULL,

  -- Human-friendly installation label ("iPhone 15 · Safari",
  -- "MacBook Pro · Chrome"). Derived from client UA at first sight.
  label             varchar(120),

  -- Broad classification. NEVER used as auth factor.
  platform          varchar(16),        -- ios | android | macos | windows | linux | unknown
  form_factor       varchar(16),        -- mobile | tablet | desktop | unknown

  -- Trust level per D4. Progression is explicit — no implicit trust
  -- from IP / user-agent / fingerprint.
  --   unknown         — first sight, never seen this install
  --   otp_verified    — completed an OTP challenge from this install
  --   passkey_present — has an active user_passkeys row usable from
  --                     this install
  --   revoked         — user or admin revoked this install; sessions
  --                     originating here are refused
  trust_level       varchar(20) NOT NULL DEFAULT 'unknown',

  first_seen_at     timestamp NOT NULL DEFAULT now(),
  last_seen_at      timestamp NOT NULL DEFAULT now(),
  revoked_at        timestamp,
  revoked_reason    varchar(60)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_pw_user_install
  ON devices_pw (user_id, install_id);

CREATE INDEX IF NOT EXISTS idx_devices_pw_user_active
  ON devices_pw (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

-- =====================================================================
-- Rollback:
--   DROP INDEX IF EXISTS uq_devices_pw_user_install;
--   DROP INDEX IF EXISTS idx_devices_pw_user_active;
--   DROP TABLE IF EXISTS devices_pw;
--
-- Safe: no writer today. Table is empty in production.
-- =====================================================================

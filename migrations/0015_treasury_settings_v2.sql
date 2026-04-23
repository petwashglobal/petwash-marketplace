-- Migration: 0015_treasury_settings_v2
-- Phase 2 enhancements to treasury_settings:
--   1. Adds AES-256-GCM encrypted columns for IBAN and account number (replaces plain-text).
--   2. Adds masked display cache columns so the admin API can serve safe display values
--      without decrypting in the route layer.
--   3. Adds the treasury_settings_audit table for structural change audit trail.
--   4. Adds treasury_setting_id reference on station_settlements and super_app_payouts
--      so every settlement and payout is linked to the treasury record that was active
--      at the time — satisfying auditor and regulatory traceability requirements.
--
-- SECURITY NOTES:
--   - account_number_encrypted and iban_encrypted store AES-256-GCM ciphertext only.
--     They are populated by TreasuryConfigService.seedFromEnv() at server startup.
--   - The old plain-text iban and account_number columns are retained for the duration
--     of the migration window and should be NULL-ed out after the encrypted columns
--     are confirmed non-null in production (via a subsequent data migration step).
--   - treasury_settings_audit rows must never contain raw bank details — masked only.

-- ── 1. Encrypted columns on treasury_settings ────────────────────────────────

ALTER TABLE treasury_settings
  ADD COLUMN IF NOT EXISTS iban_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS account_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS iban_masked_cache VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_number_masked_cache VARCHAR(20),
  ADD COLUMN IF NOT EXISTS swift_masked_cache VARCHAR(20);

-- ── 2. treasury_settings_audit ───────────────────────────────────────────────
-- Structural change audit. Append-only — no DELETE or UPDATE on application role.

CREATE TABLE IF NOT EXISTS treasury_settings_audit (
  id                        SERIAL PRIMARY KEY,
  treasury_setting_id       INTEGER NOT NULL,
  action                    VARCHAR(40) NOT NULL,
  performed_by_uid          VARCHAR(128) NOT NULL,
  performed_by_email        VARCHAR(255) NOT NULL,
  -- JSON masked snapshots only — never raw IBAN or account number
  previous_masked_snapshot  TEXT,
  new_masked_snapshot       TEXT,
  note                      TEXT,
  performed_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_audit_setting
  ON treasury_settings_audit (treasury_setting_id);

CREATE INDEX IF NOT EXISTS idx_treasury_audit_time
  ON treasury_settings_audit (performed_at DESC);

-- ── 3. Reconciliation linkage ─────────────────────────────────────────────────
-- Link each settlement and payout to the treasury record active at the time.
-- This allows auditors to know exactly which treasury version was used.
-- Both columns are nullable: existing rows keep NULL and new rows will be set
-- by the service layer.

ALTER TABLE station_settlements
  ADD COLUMN IF NOT EXISTS treasury_setting_id INTEGER REFERENCES treasury_settings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_station_settlements_treasury
  ON station_settlements (treasury_setting_id)
  WHERE treasury_setting_id IS NOT NULL;

ALTER TABLE super_app_payouts
  ADD COLUMN IF NOT EXISTS treasury_setting_id INTEGER REFERENCES treasury_settings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_super_app_payouts_treasury
  ON super_app_payouts (treasury_setting_id)
  WHERE treasury_setting_id IS NOT NULL;

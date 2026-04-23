-- Migration: 0014_treasury_settings
-- Adds the treasury_settings and treasury_access_log tables for secure
-- company bank account identity management.
--
-- SECURITY NOTES:
--  - The sensitive columns (iban, account_number, branch_number, swift) will be
--    populated exclusively via TreasuryConfigService.seedFromEnv() which reads
--    from server-side environment variables. They are never set in migrations.
--  - Row-level security (if enabled): only the backend service role may DML.
--  - treasury_access_log is append-only — no DELETE or UPDATE permissions should
--    be granted to the application role.

-- ── treasury_settings ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS treasury_settings (
  id                        SERIAL PRIMARY KEY,

  -- Legal entity identity
  legal_entity_name         VARCHAR(120)  NOT NULL,
  legal_entity_name_he      VARCHAR(120),
  company_number            VARCHAR(20)   NOT NULL,

  -- Bank account identity (populated from env vars only — never hardcoded)
  bank_name                 VARCHAR(80)   NOT NULL,
  bank_code                 VARCHAR(10)   NOT NULL,
  branch_number             VARCHAR(10)   NOT NULL,
  account_number            VARCHAR(20)   NOT NULL,
  iban                      VARCHAR(34)   NOT NULL,
  swift                     VARCHAR(11)   NOT NULL,
  account_holder_name       VARCHAR(120)  NOT NULL,

  -- Document provenance
  account_opened_at         TIMESTAMP WITH TIME ZONE,
  source_document_date      TIMESTAMP WITH TIME ZONE,
  certificate_storage_path  TEXT,

  -- Verification status
  verification_status       VARCHAR(20)   NOT NULL DEFAULT 'pending',
  verified_by_uid           VARCHAR(128),
  verified_by_name          VARCHAR(120),
  verified_at               TIMESTAMP WITH TIME ZONE,
  verification_note         TEXT,

  -- Usage flags
  is_active_payout_source   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active_for_reconciliation BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_modified_by_uid      VARCHAR(128)
);

-- Ensure only one row ever exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_treasury_settings_singleton
  ON treasury_settings ((true));

-- ── treasury_access_log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS treasury_access_log (
  id            SERIAL PRIMARY KEY,
  actor_uid     VARCHAR(128)  NOT NULL,
  actor_email   VARCHAR(255)  NOT NULL,
  actor_role    VARCHAR(40)   NOT NULL,
  action        VARCHAR(40)   NOT NULL,
  description   TEXT          NOT NULL,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  performed_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_log_actor
  ON treasury_access_log (actor_uid);

CREATE INDEX IF NOT EXISTS idx_treasury_log_action
  ON treasury_access_log (action);

CREATE INDEX IF NOT EXISTS idx_treasury_log_time
  ON treasury_access_log (performed_at DESC);

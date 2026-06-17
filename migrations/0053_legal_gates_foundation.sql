-- Legal-gates foundation (additive, safe). Backs the consent/per-service
-- approval enforcement the legal spec requires. No existing table is altered.

-- 1) Per-service provider approval — a provider approved for one service is NOT
--    approved for another, and approved-for-booking is NOT approved-for-payout.
CREATE TABLE IF NOT EXISTS provider_services (
  id                 SERIAL PRIMARY KEY,
  provider_id        VARCHAR NOT NULL,
  service_type       VARCHAR NOT NULL,              -- dog_walking, pet_sitting, grooming, pet_training, ...
  service_status     VARCHAR NOT NULL DEFAULT 'not_started',
  profile_visible    BOOLEAN NOT NULL DEFAULT FALSE,
  booking_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  payout_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  paused_by_provider BOOLEAN NOT NULL DEFAULT FALSE,
  paused_by_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, service_type)
);
CREATE INDEX IF NOT EXISTS idx_provider_services_provider ON provider_services(provider_id);

-- 2) Consent requirements — which signed consent each role/action needs
--    (replaces hardcoded maps; drives requireConsent + reconfirmation windows).
CREATE TABLE IF NOT EXISTS consent_requirements (
  id            SERIAL PRIMARY KEY,
  role          VARCHAR NOT NULL,                   -- member | provider | supplier | partner | staff
  action        VARCHAR NOT NULL,                   -- wallet_pass_issue, provider_service_enable_booking, ...
  consent_type  VARCHAR NOT NULL,                   -- e.g. member-terms, provider-truth-declaration
  document_key  VARCHAR,                            -- maps to a doc in docs/legal/petwash-legal-suite
  required      BOOLEAN NOT NULL DEFAULT TRUE,
  reconfirm_days INTEGER,                           -- null = no periodic reconfirmation
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, action, consent_type)
);

-- 3) Reconfirmation records — six-month (or other) re-acceptance tracking.
CREATE TABLE IF NOT EXISTS reconfirmation_records (
  id                 SERIAL PRIMARY KEY,
  provider_id        VARCHAR NOT NULL,
  reconfirmation_type VARCHAR NOT NULL DEFAULT 'six_month',
  due_at             TIMESTAMPTZ NOT NULL,
  completed_at       TIMESTAMPTZ,
  status             VARCHAR NOT NULL DEFAULT 'pending',  -- pending | completed | overdue
  consent_record_id  VARCHAR,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, reconfirmation_type, due_at)
);
CREATE INDEX IF NOT EXISTS idx_reconfirmation_provider ON reconfirmation_records(provider_id);

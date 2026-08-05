-- 0114: staff_applications + staff_documents (careers / jobs intake, 2026-08-05)
-- These tables were defined ONLY in shared/schema.ts (staffApplications,
-- staffDocuments) with NO SQL migration, so in prod they did not exist. Effect:
--   • Public /careers/apply flow (POST /api/careers) 500'd on every job application.
--   • Admin "back end" panel (/admin/backend → /api/admin-panel/stats + /staff)
--     500'd the WHOLE overview because one COUNT hit a missing table.
-- Mirrors shared/schema.ts exactly. Prefix >88 → auto-applies on push. Idempotent
-- (IF NOT EXISTS): a no-op if the tables were already bootstrapped by the ORM.
-- NOTE: "references" is a reserved word in Postgres → it MUST stay double-quoted.

CREATE TABLE IF NOT EXISTS staff_applications (
  id                        SERIAL PRIMARY KEY,
  user_id                   VARCHAR,
  application_type          VARCHAR(100) NOT NULL,
  first_name                VARCHAR(255) NOT NULL,
  last_name                 VARCHAR(255) NOT NULL,
  email                     VARCHAR(255) NOT NULL,
  phone                     VARCHAR(50)  NOT NULL,
  date_of_birth             DATE         NOT NULL,
  address                   TEXT         NOT NULL,
  city                      VARCHAR(255) NOT NULL,
  state                     VARCHAR(100),
  country                   VARCHAR(100) NOT NULL,
  postal_code               VARCHAR(50),
  tax_id                    VARCHAR(50),
  business_name             VARCHAR(255),
  business_license          VARCHAR(255),
  bank_account_name         VARCHAR(255),
  bank_account_number       VARCHAR(255),
  bank_routing_number       VARCHAR(50),
  status                    VARCHAR(50)  NOT NULL DEFAULT 'pending',
  rejection_reason          TEXT,
  submitted_at              TIMESTAMP    DEFAULT now(),
  reviewed_at               TIMESTAMP,
  reviewed_by               VARCHAR,
  approved_at               TIMESTAMP,
  referral_source           VARCHAR(255),
  notes                     TEXT,
  created_at                TIMESTAMP    DEFAULT now(),
  updated_at                TIMESTAMP    DEFAULT now(),
  application_id            VARCHAR(50)  UNIQUE,
  membership_number         VARCHAR(20)  UNIQUE,
  position_id               VARCHAR(50),
  review_stage              VARCHAR(50),
  reviewer_notes            TEXT,
  fraud_risk_score          INTEGER      DEFAULT 0,
  shortlist_score           INTEGER,
  shortlist_recommendation  VARCHAR(30),
  shortlist_flags           JSONB        DEFAULT '[]'::jsonb,
  criminal_record           BOOLEAN      DEFAULT false,
  has_driving_license       BOOLEAN      DEFAULT false,
  driving_license_type      VARCHAR(20),
  years_of_experience       INTEGER      DEFAULT 0,
  "references"              JSONB        DEFAULT '[]'::jsonb,
  session_id                VARCHAR(255),
  current_step              INTEGER      DEFAULT 1,
  form_data                 JSONB
);

CREATE INDEX IF NOT EXISTS idx_staff_applications_email     ON staff_applications (email);
CREATE INDEX IF NOT EXISTS idx_staff_applications_status    ON staff_applications (status);
CREATE INDEX IF NOT EXISTS idx_staff_applications_type      ON staff_applications (application_type);
CREATE INDEX IF NOT EXISTS idx_staff_applications_app_id    ON staff_applications (application_id);
CREATE INDEX IF NOT EXISTS idx_staff_applications_position  ON staff_applications (position_id);
CREATE INDEX IF NOT EXISTS idx_staff_applications_shortlist ON staff_applications (shortlist_recommendation);

CREATE TABLE IF NOT EXISTS staff_documents (
  id                   SERIAL PRIMARY KEY,
  application_id       INTEGER NOT NULL REFERENCES staff_applications(id) ON DELETE CASCADE,
  document_type        VARCHAR(100) NOT NULL,
  document_url         TEXT         NOT NULL,
  status               VARCHAR(50)  NOT NULL DEFAULT 'pending',
  verification_method  VARCHAR(100),
  verification_score   DECIMAL(5,2),
  verified_at          TIMESTAMP,
  verified_by          VARCHAR,
  rejection_reason     TEXT,
  expiry_date          DATE,
  metadata             JSONB,
  created_at           TIMESTAMP    DEFAULT now(),
  updated_at           TIMESTAMP    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_application ON staff_documents (application_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_status      ON staff_documents (status);
CREATE INDEX IF NOT EXISTS idx_staff_documents_type        ON staff_documents (document_type);

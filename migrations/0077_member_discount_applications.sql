-- 0077_member_discount_applications.sql
-- Senior (65+) / disability wash-discount SELF-SERVICE APPLICATION flow.
--
-- CEO "FINAL CORRECTION" (2026-06-25): the senior/disability discount is an
-- OPTIONAL, manually-reviewed application. The member applies IN-APP, support
-- reviews at support@petwash.co.il, and only on APPROVAL does the discount
-- become active. The approved DECISION still lands in member_wash_discounts
-- (migration 0059) — the price engine already reads that table; this table holds
-- only the APPLICATION (applicant-supplied data + lifecycle), kept separate so
-- the price path is untouched.
--
-- PRIVACY (Amendment 13 / spec §10): ID / passport / disability-certificate
-- numbers are SENSITIVE. They are stored ENCRYPTED (secretFieldCrypto, same
-- envelope as national-ID elsewhere) — NEVER plaintext, NEVER in email (the
-- support email carries a masked value only). Full value is revealed only inside
-- secure admin, and every reveal is audit-logged.
--
-- Additive only — no existing table is altered. 2026-06-25.

CREATE TABLE IF NOT EXISTS member_discount_applications (
  id                    SERIAL PRIMARY KEY,
  -- Firebase UID of the applying member.
  user_id               VARCHAR(255) NOT NULL,
  -- senior | disability
  discount_type         VARCHAR(16)  NOT NULL,
  -- Lifecycle (spec §3): draft | submitted | pending_review | needs_more_info
  --                       | approved | rejected | expired | suspended
  status                VARCHAR(24)  NOT NULL DEFAULT 'pending_review',

  -- Applicant-supplied data ---------------------------------------------------
  date_of_birth         DATE,
  -- national_id | passport
  id_type               VARCHAR(16),
  -- ENCRYPTED national-ID / passport number. Never plaintext.
  id_number_enc         TEXT,
  id_country            VARCHAR(64),
  id_issue_date         DATE,
  -- Disability-specific (nullable for senior applications). ENCRYPTED.
  disability_ref_enc    TEXT,
  disability_issue_date DATE,
  disability_expiry_date DATE,
  issuing_authority     VARCHAR(160),

  -- Truth declaration (spec §3: "user signs declaration that info is true").
  declaration_signed_at TIMESTAMP,
  declaration_version   VARCHAR(32),

  -- Review trail --------------------------------------------------------------
  submitted_at          TIMESTAMP,
  reviewed_by_admin_id  VARCHAR(255),
  reviewed_at           TIMESTAMP,
  review_note           TEXT,
  -- Mirror of the percent granted on approval (5/7/10). Authoritative grant
  -- lives in member_wash_discounts; this is for the application view only.
  approved_percent      INTEGER,

  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_discount_apps_user
  ON member_discount_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_member_discount_apps_status
  ON member_discount_applications (status);

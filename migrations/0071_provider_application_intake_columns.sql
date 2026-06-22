-- FIX: real providers cannot register — provider onboarding "fails to lodge to the backend".
--
-- Root cause: POST /api/provider-onboarding/apply INSERTs into provider_applications
-- columns that exist in shared/schema.ts but were never added to the prod DB by a
-- numbered migration (CI runs apply-pending-migrations.ts only, NOT drizzle-kit push).
-- A missing column → Postgres 42703 undefined_column → the whole INSERT 500s → the
-- applicant sees "Error submitting application" and NOTHING (id number, tax status,
-- declarations, signature) is saved.
--
-- This migration ADDs every provider_applications column the intake handler writes,
-- all IF NOT EXISTS (idempotent — harmless where a prior drizzle-kit push already
-- created some). Types mirror shared/schema.ts:5208-5332 so a future push sees no diff.
-- APPLY in prod (CEO/ops). Additive, non-destructive.

ALTER TABLE provider_applications
  -- Criminal background check (2026 spec) + 10-year residential history
  ADD COLUMN IF NOT EXISTS criminal_check_status        varchar DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS criminal_check_provider      varchar,
  ADD COLUMN IF NOT EXISTS criminal_check_report_id     varchar,
  ADD COLUMN IF NOT EXISTS criminal_check_completed_at  timestamp,
  ADD COLUMN IF NOT EXISTS residential_history          text,
  ADD COLUMN IF NOT EXISTS criminal_check_consent       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS criminal_check_consent_date  timestamp,

  -- Israel-safe self-declaration + tamper-evident e-signature (must persist for legal proof)
  ADD COLUMN IF NOT EXISTS self_declaration_no_relevant_convictions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_declaration_at          timestamp,
  ADD COLUMN IF NOT EXISTS self_declaration_ip          varchar(64),
  ADD COLUMN IF NOT EXISTS declaration_attestation      jsonb,
  ADD COLUMN IF NOT EXISTS declaration_signature_sha256 varchar(64),
  ADD COLUMN IF NOT EXISTS requires_enhanced_verification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enhanced_verification_reasons text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- Role-specific certifications
  ADD COLUMN IF NOT EXISTS pet_first_aid_cert_url       varchar,
  ADD COLUMN IF NOT EXISTS pet_first_aid_expires_at     timestamp,
  ADD COLUMN IF NOT EXISTS pet_first_aid_provider       varchar,
  ADD COLUMN IF NOT EXISTS driving_record_url           varchar,
  ADD COLUMN IF NOT EXISTS driving_record_checked_at    timestamp,
  ADD COLUMN IF NOT EXISTS driving_record_status        varchar,
  ADD COLUMN IF NOT EXISTS driving_record_notes         text,

  -- Insurance policy monitoring
  ADD COLUMN IF NOT EXISTS insurance_policy_number      varchar,
  ADD COLUMN IF NOT EXISTS insurance_provider           varchar,
  ADD COLUMN IF NOT EXISTS insurance_expires_at         timestamp,
  ADD COLUMN IF NOT EXISTS insurance_coverage_amount    numeric(12,2),
  ADD COLUMN IF NOT EXISTS insurance_last_verified      timestamp,

  -- Israeli business/tax classification (also added in 0069; IF NOT EXISTS = safe re-assert)
  ADD COLUMN IF NOT EXISTS tax_status                   varchar(20),

  -- KYC2026 queryable fields (promoted for admin filtering)
  ADD COLUMN IF NOT EXISTS kyc_document_type            varchar,
  ADD COLUMN IF NOT EXISTS kyc_id_last_four             varchar(4),
  ADD COLUMN IF NOT EXISTS kyc_ocr_confidence           numeric(5,2),
  ADD COLUMN IF NOT EXISTS kyc_liveness_score           numeric(5,2),
  ADD COLUMN IF NOT EXISTS kyc_decision_flags           text,
  ADD COLUMN IF NOT EXISTS kyc_fraud_risk_level         varchar(20),

  -- Identity hardening (Israeli Privacy Law) + 18+ gate. The encrypted ID and the
  -- signed declaration above were being swallowed by best-effort UPDATEs when their
  -- columns were missing — these ensure they actually persist.
  ADD COLUMN IF NOT EXISTS israeli_id_encrypted         text,
  ADD COLUMN IF NOT EXISTS age_confirmed_18_plus        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_birth                date;

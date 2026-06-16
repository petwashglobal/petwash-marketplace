-- 0051 — Provider insurance + health-declaration document register (legal shield)
--
-- BACKGROUND
-- Benchmarking Rover (provider carries own liability; platform guarantee is
-- secondary) and Mad Paws (Allianz public-liability, secondary to the sitter's
-- own cover) shows the correct risk structure: the PROVIDER is primary and must
-- hold their own insurance + (in Israel) self-employed ביטוח לאומי, and must sign
-- a health + liability declaration; the platform is the secondary safety net.
--
-- This table is the REGISTER that proves, per provider, which documents are on
-- file and current — so PetWash can require valid cover before activating a
-- provider and surface expiry. It stores only METADATA + a private file ref +
-- the sealed declaration hash — NEVER the document contents or PII payload.
--
-- PURELY ADDITIVE / SAFE EXPAND. New table only; no existing row touched.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS provider_insurance_documents;

CREATE TABLE IF NOT EXISTS provider_insurance_documents (
  id              BIGSERIAL   PRIMARY KEY,
  provider_id     TEXT        NOT NULL,                 -- provider uid; decoupled, no FK
  doc_type        TEXT        NOT NULL
                    CHECK (doc_type IN (
                      'liability_insurance',     -- ביטוח אחריות / צד ג' (provider's own)
                      'professional_indemnity',
                      'health_declaration',      -- sealed declaration (hash below)
                      'bituach_leumi',           -- self-employed national insurance proof
                      'liability_acknowledgment',-- signed risk/indemnity acknowledgment
                      'police_check_cert',
                      'other'
                    )),
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','expired','rejected')),
  insurer         TEXT,                                 -- e.g. Harel, Clal, Allianz
  policy_number   TEXT,
  file_ref        TEXT,                                 -- private GCS object path; NOT the file
  declaration_hash TEXT,                                -- SHA-256 of the sealed declaration (no PII)
  issued_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,                          -- drives the "cover lapsed" gate
  verified_by     TEXT,                                 -- admin actor handle
  verified_at     TIMESTAMPTZ,
  notes           TEXT,                                 -- non-PII operational note only
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provins_provider ON provider_insurance_documents (provider_id, doc_type, status);
CREATE INDEX IF NOT EXISTS idx_provins_expiry ON provider_insurance_documents (expires_at);

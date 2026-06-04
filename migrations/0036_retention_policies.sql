-- 0036 — Retention policies (per data-class retention window + anonymisation method)
--
-- BACKGROUND
-- The Data & Intelligence architecture (docs/data-architecture) declares retention
-- as DATA, not as hardcoded constants, so a scheduled purge job can enforce
-- "drop/anonymise data class X after N days" without a code deploy, and so the
-- policy is auditable. Today retention lives as scattered defaults (e.g.
-- users.retention_policy = '7_years'); this table makes it first-class and
-- per-category. It is the declarative source the purge job reads.
--
-- This is PURELY ADDITIVE. It does not touch or delete any existing row, and no
-- purge runs from this migration — it only records the policy. Wiring the actual
-- scheduled purge is a separate, reviewed change.
--
-- COMPLIANCE NOTE (not legal advice)
-- The retention_days / legal_basis values seeded below are INDICATIVE starting
-- points from the architecture doc. Confirm every value against Israel's Privacy
-- Protection Law (Amendment 13) and, for EU users, the GDPR, with qualified
-- counsel before any purge job acts on them. Do not treat these as legal
-- determinations.
--
-- ROLLBACK
--   DROP TABLE IF EXISTS retention_policies;
-- No existing table or row is touched.

CREATE TABLE IF NOT EXISTS retention_policies (
  data_class            TEXT        PRIMARY KEY,
  retention_days        INTEGER     NOT NULL,
  anonymisation_method  TEXT        NOT NULL DEFAULT 'delete'
                          CHECK (anonymisation_method IN ('delete','anonymise','pseudonymise')),
  legal_basis           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retention_policies_days_positive CHECK (retention_days > 0)
);

-- Idempotent seed (re-running will not duplicate). INDICATIVE — confirm with counsel.
INSERT INTO retention_policies (data_class, retention_days, anonymisation_method, legal_basis, notes) VALUES
  ('raw_event',         400,  'delete',       'consent/legitimate-interest', 'Raw behavioural events; drop after ~13 months. INDICATIVE — confirm with counsel.'),
  ('wash_session',      1095, 'anonymise',    'contract',                    'Service history powering the member wash story (~3y). INDICATIVE.'),
  ('gift_message',      30,   'delete',       'contract',                    'Personal gift note; purge shortly after delivery. INDICATIVE.'),
  ('provider_rating',   1095, 'pseudonymise', 'legitimate-interest',         'Fair provider-scoring window (~3y). INDICATIVE.'),
  ('marketing_profile', 730,  'delete',       'consent',                     'Marketing profile; refreshed on re-consent (~2y). INDICATIVE.')
ON CONFLICT (data_class) DO NOTHING;

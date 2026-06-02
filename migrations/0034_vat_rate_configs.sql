-- 0034 — VAT rate config table (effective-dated, ops-editable default)
--
-- BACKGROUND
-- Israeli VAT (מע"מ) changes by Knesset budget decision (last: 17% → 18%
-- effective 1 January 2025). Today the platform's default rate lives as the
-- single canonical constant ISRAEL_VAT_RATE in shared/israel-compliance-config.ts
-- (see PR-W13). That is correct as a *deploy-time* default, but it has two
-- limits this table removes:
--   1. Changing the default requires a code deploy. A rate change should be an
--      ops config edit with an effective-from date, not an engineering release.
--   2. There is no first-class record of WHICH rate applied on a given date, so
--      a historical transaction cannot resolve its correct rate by lookup.
--
-- This table is the editable, effective-dated source for the DEFAULT rate.
-- It does NOT change how any existing transaction is calculated: every payment
-- continues to store its own pw_payments.vat_rate per row (Rule 1 — store the
-- rate on the transaction, never read a global at report time). New code that
-- needs "the default rate as of date D" resolves it from here (or from the
-- mirrored pure schedule VAT_RATE_SCHEDULE in shared/israel-compliance-config.ts
-- when the DB is not in scope, e.g. client/isomorphic code).
--
-- Seed reflects the published ITA history relevant to this company's lifetime:
--   • 0.1700 effective 2024-01-01 — the 17% era (any pre-2025 record)
--   • 0.1800 effective 2025-01-01 — current rate (ITA circular)
-- Earlier history (pre-2024) is intentionally not modeled: no PetWash
-- transaction predates the company.
--
-- ROLLBACK
-- Purely additive (new table). To roll back:
--   DROP TABLE IF EXISTS vat_rate_configs;
-- No existing table or row is touched.

CREATE TABLE IF NOT EXISTS vat_rate_configs (
  id                       BIGSERIAL PRIMARY KEY,
  country_code             CHAR(2)        NOT NULL DEFAULT 'IL',
  effective_from           DATE           NOT NULL,
  rate                     NUMERIC(5,4)   NOT NULL,           -- e.g. 0.1800 = 18%
  tax_classification_type  TEXT           NOT NULL DEFAULT 'standard'
                             CHECK (tax_classification_type IN ('standard','zero','exempt')),
  legal_basis              TEXT,
  created_by               TEXT           NOT NULL DEFAULT 'system_seed',
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT vat_rate_configs_rate_range CHECK (rate >= 0 AND rate <= 1),
  CONSTRAINT vat_rate_configs_unique_effective UNIQUE (country_code, effective_from, tax_classification_type)
);

-- Resolve "rate as of date D" = the latest row with effective_from <= D.
CREATE INDEX IF NOT EXISTS idx_vat_rate_configs_lookup
  ON vat_rate_configs (country_code, tax_classification_type, effective_from DESC);

-- Idempotent seed (re-running this migration will not duplicate rows).
INSERT INTO vat_rate_configs (country_code, effective_from, rate, tax_classification_type, legal_basis, created_by)
VALUES
  ('IL', DATE '2024-01-01', 0.1700, 'standard', 'Israeli VAT 17% (pre-2025 era)',                 'system_seed'),
  ('IL', DATE '2025-01-01', 0.1800, 'standard', 'Israeli VAT 18% effective 1.1.2025 (ITA circular)', 'system_seed')
ON CONFLICT (country_code, effective_from, tax_classification_type) DO NOTHING;

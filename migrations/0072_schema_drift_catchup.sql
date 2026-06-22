-- 0072_schema_drift_catchup.sql
-- Catch-up for schema drift: columns defined in shared/schema.ts that have NO
-- numbered migration. Deploy CI runs ONLY scripts/apply-pending-migrations.ts
-- (numbered migrations/*.sql) — it does NOT run `drizzle-kit push`. Prod was
-- historically bootstrapped by an out-of-band push, so these TABLES exist, but
-- columns added to schema.ts AFTER the last push were never migrated. Any
-- INSERT/SELECT touching them throws Postgres 42703 (undefined_column) -> 500.
-- Same failure class as provider_applications (fixed in 0071).
--
-- Scope: only HIGH-risk, route-touched drift VERIFIED against shared/schema.ts +
-- server/. Types mirror the schema exactly so a future `drizzle-kit push` sees
-- no diff. All IF NOT EXISTS — additive, non-destructive, idempotent. Apply in
-- prod (CEO/ops) — runs automatically on deploy via apply-pending-migrations.ts.

-- ── digital_receipts (schema.ts:12100) ───────────────────────────────────────
-- Table exists in prod (0066 already ALTERs it to add sumit_document_id). These
-- 3 columns were added later for the Israeli SHAAM Digital-Invoice Law 2026 +
-- credit-note linkage and are written on every receipt issuance / credit note
-- (server/services/IsraeliDigitalReceiptService.ts). Without them, issuing a
-- receipt above the SHAAM threshold or any credit note 500s.
ALTER TABLE digital_receipts
  ADD COLUMN IF NOT EXISTS original_receipt_id      integer,                    -- credit-note -> original receipt id
  ADD COLUMN IF NOT EXISTS shaam_required           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shaam_allocation_number  varchar;                    -- ITA SHAAM allocation no. (מספר הקצאה)

-- ── withholding_remittance_ledger (schema.ts:15645) ──────────────────────────
-- No base migration exists for this table — it lives in prod via the historical
-- push. CREATE TABLE IF NOT EXISTS makes a fresh/rebuilt environment correct and
-- is a no-op where the push already created it. The two trailing columns
-- (osek_type, commission_id) were added ~2 months after the table and are
-- written on the provider-payout / withholding path
-- (server/services/IsraeliDigitalReceiptService.ts:516).
CREATE TABLE IF NOT EXISTS withholding_remittance_ledger (
  id                        serial PRIMARY KEY,
  booking_id                varchar NOT NULL,
  provider_id               varchar NOT NULL,
  provider_type             varchar NOT NULL,
  withholding_amount        numeric(12,2) NOT NULL,
  withholding_rate          numeric(5,2)  NOT NULL,
  gross_payout_amount       numeric(12,2) NOT NULL,
  period                    varchar(10)   NOT NULL,
  status                    varchar       NOT NULL DEFAULT 'held',
  remitted_at               timestamp,
  ita_remittance_reference  varchar,
  reversed_at               timestamp,
  reverse_reason            text,
  osek_type                 varchar,
  commission_id             varchar,
  created_at                timestamp NOT NULL DEFAULT now(),
  updated_at                timestamp NOT NULL DEFAULT now()
);
-- Safety net if the table pre-exists from the push WITHOUT the late columns:
ALTER TABLE withholding_remittance_ledger
  ADD COLUMN IF NOT EXISTS osek_type      varchar,
  ADD COLUMN IF NOT EXISTS commission_id  varchar;

CREATE INDEX IF NOT EXISTS idx_wrl_booking  ON withholding_remittance_ledger (booking_id);
CREATE INDEX IF NOT EXISTS idx_wrl_provider ON withholding_remittance_ledger (provider_id);
CREATE INDEX IF NOT EXISTS idx_wrl_period   ON withholding_remittance_ledger (period);
CREATE INDEX IF NOT EXISTS idx_wrl_status   ON withholding_remittance_ledger (status);

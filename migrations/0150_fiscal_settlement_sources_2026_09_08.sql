-- Settlement source ingestion — the B and D layers, in production.
--
-- WHY
-- The fiscal watchdog can prove the issuance rail (A↔C) from data it already
-- has, but it cannot report a month CLOSED, because two layers only exist as
-- files today:
--   B  the Nayax reimbursement statement — what Nayax says it collected/paid
--   D  the bank statement — whether the money actually arrived
--
-- The bookkeeper asked for a three-way reconciliation including
-- "התקבולים בבנק" (receipts in the bank), so D is required, not optional. And
-- D is the only layer Nayax does not control: A, B and MoMa are all Nayax's own
-- data, so without D nothing proves cash.
--
-- A bank API or automated feed would be better. Until one exists, a controlled
-- import is the honest mechanism — and it must be an IMPORT with provenance,
-- not a figure someone types into a report.
--
-- RULES
--   • APPEND-ONLY. An imported row is evidence of what a source said. It is
--     never edited to make a reconciliation agree; a corrected file is a NEW
--     import, and both remain visible.
--   • Every row records WHERE it came from: file name, sha256 of the file, who
--     imported it, when. A figure with no provenance cannot support a fiscal
--     assertion.
--   • Dedupe is on the CONTENT, so re-importing the same file is harmless and
--     overlapping exports do not double-count.
--   • Bank rows hold no counterparty account numbers and no customer data —
--     value date, amount, narrative and the bank's own reference only.

-- ── D: bank credits ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_bank_credits (
  id               VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Value date: when the money was actually available, which is what
  -- reconciliation needs. Not the booking date.
  value_date       DATE        NOT NULL,
  amount_minor     BIGINT      NOT NULL,
  currency         VARCHAR(3)  NOT NULL DEFAULT 'ILS',
  -- The narrative is how a credit is attributed to Nayax at all. Kept verbatim.
  narrative        TEXT        NOT NULL DEFAULT '',
  bank_reference   VARCHAR,
  -- Provenance.
  source_file      VARCHAR     NOT NULL,
  source_sha256    VARCHAR(64) NOT NULL,
  imported_by      VARCHAR     NOT NULL,
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Content fingerprint: same date + amount + narrative + reference is the
  -- same credit however many times the file is re-imported.
  content_hash     VARCHAR(64) NOT NULL,
  CONSTRAINT fiscal_bank_credits_positive CHECK (amount_minor > 0)
);

-- THE DEDUPE GUARD. Re-importing a statement, or importing two overlapping
-- exports, must never invent a second credit — that would make a shortfall
-- look reconciled.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_bank_credit_content
  ON fiscal_bank_credits (content_hash);
CREATE INDEX IF NOT EXISTS idx_fiscal_bank_credit_date
  ON fiscal_bank_credits (value_date);

-- ── B: Nayax settlement statements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiscal_nayax_statements (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  period                VARCHAR(7)  NOT NULL,        -- YYYY-MM
  period_start          DATE,
  period_end            DATE,
  payout_date           DATE,
  -- What Nayax says it collected on our behalf, before its own deductions.
  gross_collected_minor BIGINT      NOT NULL DEFAULT 0,
  -- Everything Nayax withheld: fees incl. VAT plus deductions.
  withheld_minor        BIGINT      NOT NULL DEFAULT 0,
  -- The statement's own bottom line. NEGATIVE means Nayax is CHARGING, not
  -- paying out — June 2026 was −₪377.60 with zero revenue. Never assume a
  -- payout is positive.
  total_minor           BIGINT      NOT NULL,
  -- Typed lines, and the ones we could NOT type. A statement carrying an
  -- unclassified line cannot close a month: engineering does not invent the
  -- accounting meaning of an unknown Nayax label.
  lines                 JSONB       NOT NULL DEFAULT '[]'::jsonb,
  unclassified_count    INTEGER     NOT NULL DEFAULT 0,
  source_file           VARCHAR     NOT NULL,
  source_sha256         VARCHAR(64) NOT NULL,
  imported_by           VARCHAR     NOT NULL,
  imported_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One CURRENT statement per period, keyed on the file's own hash so a corrected
-- re-issue lands as a new row rather than silently replacing the first.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_nayax_statement_file
  ON fiscal_nayax_statements (period, source_sha256);
CREATE INDEX IF NOT EXISTS idx_fiscal_nayax_statement_period
  ON fiscal_nayax_statements (period, imported_at DESC);

COMMENT ON TABLE fiscal_bank_credits IS
  'Append-only imported bank credits — the D layer, and the only settlement source Nayax does not control. Deduped on content_hash so re-imports and overlapping exports cannot double-count. Never edited to make a reconciliation agree. Holds no counterparty account numbers or customer data.';
COMMENT ON TABLE fiscal_nayax_statements IS
  'Append-only imported Nayax reimbursement statements — the B layer. total_minor may be NEGATIVE (Nayax charging rather than paying). A statement with unclassified_count > 0 cannot close a month.';

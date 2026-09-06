-- Nayax ↔ SUMIT fiscal document links — the canonical coverage record.
--
-- WHY
-- k9000_wash_events.sumit_document_id is a single scalar and cannot express what
-- actually occurs:
--   • one transaction → an original AND a later credit document
--   • many transactions → ONE consolidated document
-- Both are real. As of 2026-09-06 SUMIT holds 481 individual final documents for
-- pre-cutover transactions (#10002–#10482), while the bookkeeper's instruction for
-- that period was one consolidated document. The data model must be able to state
-- either without pretending one is the other.
--
-- This table RECORDS observed relationships. It decides nothing: fiscal treatment
-- is the bookkeeper's determination. `source` keeps the provenance of every claim.
--
-- Additive only. No existing column or row is altered.

CREATE TABLE IF NOT EXISTS nayax_fiscal_document_links (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  nayax_transaction_id  VARCHAR NOT NULL,
  sumit_document_id     VARCHAR NOT NULL,
  sumit_document_number VARCHAR,
  sumit_document_type   VARCHAR,

  -- INDIVIDUAL_ORIGINAL | CONSOLIDATED_COVERAGE | CREDIT_REFUND
  link_type             VARCHAR NOT NULL,
  -- SUMIT_EXTERNAL_REFERENCE | BRIDGE_ISSUED | BOOKKEEPER_DIRECTED | MANUAL
  source                VARCHAR NOT NULL,

  -- When WE observed this, not when the document was issued.
  observed_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  note                  TEXT,

  created_at            TIMESTAMP DEFAULT NOW()
);

-- Re-observing the same relationship must never create a second row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nayax_fiscal_link
  ON nayax_fiscal_document_links (nayax_transaction_id, sumit_document_id, link_type);

CREATE INDEX IF NOT EXISTS idx_nayax_fiscal_link_txn
  ON nayax_fiscal_document_links (nayax_transaction_id);
CREATE INDEX IF NOT EXISTS idx_nayax_fiscal_link_doc
  ON nayax_fiscal_document_links (sumit_document_id);
CREATE INDEX IF NOT EXISTS idx_nayax_fiscal_link_type
  ON nayax_fiscal_document_links (link_type);

COMMENT ON TABLE nayax_fiscal_document_links IS
  'Observed Nayax transaction to SUMIT document coverage. Many-to-one capable. '
  'Canonical fiscal linkage; k9000_wash_events.sumit_document_id is legacy convenience only.';

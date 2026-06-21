-- 0066_sumit_document_linkage.sql
-- Persist the SUMIT (OfficeGuy) fiscal-document id back onto the records that
-- issue one, so the official tax-invoice/receipt is retrievable later from the
-- SUMIT panel. Additive + nullable — safe to apply anytime; columns stay NULL
-- while SUMIT is dormant (SUMIT_ENABLED=false) and fill in once it is wired.

ALTER TABLE digital_receipts
  ADD COLUMN IF NOT EXISTS sumit_document_id  varchar,
  ADD COLUMN IF NOT EXISTS sumit_document_url varchar;

ALTER TABLE e_vouchers
  ADD COLUMN IF NOT EXISTS sumit_document_id text;

-- Fast lookup of a receipt/voucher by its SUMIT document id (reconciliation).
CREATE INDEX IF NOT EXISTS idx_digital_receipts_sumit_doc
  ON digital_receipts (sumit_document_id);
CREATE INDEX IF NOT EXISTS idx_e_vouchers_sumit_doc
  ON e_vouchers (sumit_document_id);

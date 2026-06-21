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

-- K9000 wash: only a direct Nayax CARD sale (transaction_source='nayax') is a new
-- taxable cash sale that gets a SUMIT doc here. Credit/package redemptions were
-- already taxed at purchase and intentionally leave this NULL (no double VAT).
ALTER TABLE k9000_wash_events
  ADD COLUMN IF NOT EXISTS sumit_document_id varchar;

-- Fast lookup of a receipt/voucher by its SUMIT document id (reconciliation).
CREATE INDEX IF NOT EXISTS idx_digital_receipts_sumit_doc
  ON digital_receipts (sumit_document_id);
CREATE INDEX IF NOT EXISTS idx_e_vouchers_sumit_doc
  ON e_vouchers (sumit_document_id);
CREATE INDEX IF NOT EXISTS idx_k9000_wash_sumit_doc
  ON k9000_wash_events (sumit_document_id);

-- Migration: 0026_supplier_invoices_shaam
--
-- PR-S5 — Israel ITA Digital Invoice Law 2026 (SHAAM Allocation Number)
-- compliance hooks for the supplier-invoice pipeline.
--
-- Background: from 1 Jan 2026, every Israeli tax invoice / credit note above
-- ₪10,000 ex-VAT must carry a SHAAM allocation number (מספר הקצאה) obtained
-- from the ITA by the *issuer* before the document is issued. From 1 Jun 2026
-- the threshold drops to ₪5,000. A buyer (us) who pays an above-threshold
-- supplier invoice WITHOUT a valid allocation number cannot deduct the VAT.
--
-- This migration adds two columns to supplier_invoices:
--   shaam_required           — boolean, computed at ingest based on amount + date
--   shaam_allocation_number  — varchar(40), captured from OCR on the supplier's
--                              invoice (NOT requested by us — we are the buyer)
--
-- Fully additive. Both columns nullable. No existing column is touched. Every
-- existing INSERT/UPDATE keeps working. Idempotent.
--
-- No money movement. No SUMIT send. The screening pipeline (PR-S5b) will use
-- these columns to flag above-threshold invoices that lack an allocation
-- number, so finance never approves an invoice that would lose us the VAT.

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS shaam_required          boolean NOT NULL DEFAULT false;
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS shaam_allocation_number varchar(40);

-- Lookup by allocation number (audit trail / reconciliation against ITA later).
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_shaam_alloc
  ON supplier_invoices (shaam_allocation_number)
  WHERE shaam_allocation_number IS NOT NULL;

-- Find invoices that need allocation numbers but don't have them yet (the
-- "block this approval" query the screening pipeline runs).
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_shaam_required_missing
  ON supplier_invoices (shaam_required)
  WHERE shaam_required = true AND shaam_allocation_number IS NULL;

-- ROLLBACK (commented — for reference only)
-- DROP INDEX IF EXISTS idx_supplier_invoices_shaam_required_missing;
-- DROP INDEX IF EXISTS idx_supplier_invoices_shaam_alloc;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS shaam_allocation_number;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS shaam_required;

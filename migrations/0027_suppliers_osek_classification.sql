-- Migration: 0027_suppliers_osek_classification
--
-- PR-S5c — Israeli tax-status classification on suppliers, used by the
-- supplier-invoice screening pipeline to prevent VAT-deduction loss.
--
-- Three Israeli business types matter for VAT:
--   patur   — עוסק פטור (exempt dealer under the annual ceiling). Cannot
--             charge VAT. An invoice from a patur supplier with VAT > 0 is
--             a hard fail: we cannot reclaim VAT that was never legitimately
--             charged, and approving such an invoice loses us money.
--   murshe  — עוסק מורשה (licensed dealer, individual / partnership).
--             Charges and reclaims VAT.
--   chevra  — חברה בע"מ (limited company). Equivalent to murshe for VAT;
--             distinct here because withholding + corporate-tax + Form-857
--             reporting differ.
--
-- Fully additive. Existing rows default to 'unknown'. CHECK constraint
-- restricts to {unknown, patur, murshe, chevra}.
--
-- Companion doc: docs/finance/vat-attribution-matrix-2026-05-23.md

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS osek_classification varchar(20) NOT NULL DEFAULT 'unknown';
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS osek_certificate_url text;
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS osek_classification_verified_at timestamptz;
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS osek_classification_verified_by varchar(128);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_osek_classification_chk'
  ) THEN
    ALTER TABLE suppliers
      ADD CONSTRAINT suppliers_osek_classification_chk
      CHECK (osek_classification IN ('unknown', 'patur', 'murshe', 'chevra'));
  END IF;
END$$;

-- Common filter for the admin "uncategorized suppliers" view.
CREATE INDEX IF NOT EXISTS idx_suppliers_osek_classification
  ON suppliers (osek_classification);
-- Quickly find suppliers still missing classification (so finance can
-- categorise them before approving any of their invoices).
CREATE INDEX IF NOT EXISTS idx_suppliers_osek_unknown
  ON suppliers (osek_classification)
  WHERE osek_classification = 'unknown';

-- ROLLBACK (commented — for reference only)
-- DROP INDEX IF EXISTS idx_suppliers_osek_unknown;
-- DROP INDEX IF EXISTS idx_suppliers_osek_classification;
-- ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_osek_classification_chk;
-- ALTER TABLE suppliers DROP COLUMN IF EXISTS osek_classification_verified_by;
-- ALTER TABLE suppliers DROP COLUMN IF EXISTS osek_classification_verified_at;
-- ALTER TABLE suppliers DROP COLUMN IF EXISTS osek_certificate_url;
-- ALTER TABLE suppliers DROP COLUMN IF EXISTS osek_classification;

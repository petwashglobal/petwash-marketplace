-- 0093 — Fix the wrong company tax id default on digital_receipts (forensic F-01).
--
-- The digital_receipts.company_tax_id column carried a NOT NULL default of the
-- WRONG legacy company number '516788400'. Every application insert path already
-- sets the correct number explicitly (COMPANY_TAX_ID = '517145033' from
-- shared/finance-identity.ts), so no live row is affected — but a wrong default
-- on a TAX DOCUMENT table is a latent landmine: any future insert path that omits
-- the column would silently stamp a receipt with the wrong legal identity.
--
-- This aligns the live column default with the schema (shared/schema.ts) and the
-- canonical identity. It also corrects any historical row that somehow inherited
-- the wrong default (defensive; expected count = 0). Idempotent.

ALTER TABLE digital_receipts
  ALTER COLUMN company_tax_id SET DEFAULT '517145033';

-- Defensive backfill: fix any row that carries the retired wrong number.
UPDATE digital_receipts
  SET company_tax_id = '517145033'
  WHERE company_tax_id = '516788400';

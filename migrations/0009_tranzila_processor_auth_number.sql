-- Migration: 0009_tranzila_processor_auth_number
--
-- Adds processor_auth_number to tranzila_transactions.
--
-- Background:
--   The existing processor_reference column was documented as mapping to either
--   Tranzila's 'reference' OR 'auth_num' field, which is ambiguous.
--   processor_auth_number is a dedicated column for the bank-issued authorization
--   number (Tranzila field: auth_num / AuthNum).  This is the most reliable
--   reconciliation anchor — it appears on card statements and in bank settlement
--   reports.  processor_reference remains for the merchant-supplied reference string.
--
-- Safe to run multiple times (IF NOT EXISTS / idempotent).
-- The tranzila_transactions table is managed outside the main drizzle.config.ts
-- (schema lives in shared/schema-tranzila.ts).  Apply this migration manually
-- or via a dedicated migration runner before deploying code that uses this column.

ALTER TABLE tranzila_transactions
  ADD COLUMN IF NOT EXISTS processor_auth_number varchar;

COMMENT ON COLUMN tranzila_transactions.processor_auth_number
  IS 'Tranzila auth_num — bank authorization number issued on charge approval. '
     'Null for declined transactions. Primary reconciliation anchor with acquirer.';

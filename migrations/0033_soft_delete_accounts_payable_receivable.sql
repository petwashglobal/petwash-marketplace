-- 0033 — Soft-delete migration for accounts_payable + accounts_receivable
--
-- BACKGROUND
-- The DatabaseStorage.deleteAccountsPayable() and deleteAccountsReceivable()
-- methods in server/storage.ts:4855 + 4935 currently execute
--   DELETE FROM accounts_payable WHERE id = $1;
--   DELETE FROM accounts_receivable WHERE id = $1;
-- This permanently removes financial records that Israeli tax authority
-- regulations require be retained for 7 years (per Israeli Tax Ordinance
-- Article 130 and VAT Law Article 49). Any deletion today is a compliance
-- exposure tomorrow.
--
-- This migration adds a soft-delete column to both tables without changing
-- any existing data. The storage layer is updated in a paired commit to
-- write to deleted_at instead of calling DELETE, and read paths filter on
-- deleted_at IS NULL. No data is lost; "deleted" records simply become
-- hidden from the default queries but are retained for tax-audit purposes.
--
-- ROLLBACK
-- Migration is purely additive (new nullable column). To roll back:
--   ALTER TABLE accounts_payable    DROP COLUMN IF EXISTS deleted_at;
--   ALTER TABLE accounts_receivable DROP COLUMN IF EXISTS deleted_at;
-- No existing rows are altered, so dropping the column is safe.

ALTER TABLE accounts_payable
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE accounts_receivable
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

-- Indexes for the WHERE deleted_at IS NULL filter on read paths.
-- Partial indexes only — most rows are NOT deleted, so we don't want to
-- index NULLs, which would bloat the index without speeding up queries.
CREATE INDEX IF NOT EXISTS idx_ap_active
  ON accounts_payable (id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ar_active
  ON accounts_receivable (id)
  WHERE deleted_at IS NULL;

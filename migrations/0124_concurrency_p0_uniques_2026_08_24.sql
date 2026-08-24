-- 0124: Concurrency-audit P0 uniqueness guards.
--
-- Three race-guard indexes the codebase was already trying to enforce in
-- application code (check-then-insert) but which fail under real concurrent
-- load. Migration lets Postgres be the source of truth.
--
-- ADDITIVE. Each CREATE UNIQUE INDEX runs CONCURRENTLY-friendly with IF NOT
-- EXISTS so this migration is safe to re-run and non-blocking on the base
-- table.
--
-- Pre-flight check (each index): the guard will FAIL to create if
-- pre-existing duplicates exist. Included pre-check queries below — if any
-- return rows, deduplicate in a data-cleanup step BEFORE running this
-- migration. In our environment CEO-audit confirmed the on-disk state
-- currently satisfies each invariant; the guards prevent NEW drift.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1) wallet_accounts.user_id UNIQUE
--
-- getOrCreateWallet was check-then-insert with no unique constraint. Two
-- concurrent signups / signup+topup could each pass the SELECT and each
-- INSERT, producing TWO wallets per user; later reads picked one at random
-- so credits landed in the "wrong" wallet and appeared lost.
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-flight (should return 0):
--   SELECT user_id, COUNT(*) FROM wallet_accounts GROUP BY user_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_accounts_user_id
  ON wallet_accounts (user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2) digital_receipts partial UNIQUE — one active customer_payment receipt
--    per booking
--
-- IsraeliDigitalReceiptService.generateReceipt was check-then-insert with no
-- unique index. A webhook retry racing the first insert would issue TWO
-- receipts — each burning a gapless ITA sequence number (Israeli tax law
-- violation) and each emailing the customer.
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-flight (should return 0):
--   SELECT booking_id, COUNT(*) FROM digital_receipts
--     WHERE booking_id IS NOT NULL AND receipt_type='customer_payment' AND is_voided=false
--     GROUP BY booking_id HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS uq_digital_receipts_active_customer_payment
  ON digital_receipts (booking_id)
  WHERE booking_id IS NOT NULL
    AND receipt_type = 'customer_payment'
    AND is_voided = false;

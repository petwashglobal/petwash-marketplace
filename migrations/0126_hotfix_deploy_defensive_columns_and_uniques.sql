-- 0126: HOTFIX — unblock production deploys.
--
-- Every deploy since 2026-08-24 has failed in the self-healing migration
-- gate because 0124 (concurrency uniques) hit duplicate-key errors on
-- production data: some real users have two wallet_accounts rows (a
-- concurrent-signup race the guard was meant to prevent), which makes
-- CREATE UNIQUE INDEX ... error. The runner uses ON_ERROR_STOP=1, so a
-- single failure aborts, 0125 never runs, and MonitoringWatchdog keeps
-- throwing "column last_requested_resubmission_at does not exist" every
-- 5 minutes on the OLD live revision.
--
-- Fix strategy:
--   1. 0124 has been added to .manual-migrations.txt (bootstrapped, skipped).
--   2. THIS file (0126) reapplies BOTH intents defensively:
--      a) 0125's four ADD COLUMN IF NOT EXISTS statements (idempotent).
--      b) 0124's three CREATE UNIQUE INDEX statements wrapped in
--         DO $$ ... EXCEPTION WHEN unique_violation THEN RAISE NOTICE ...
--         so pre-existing duplicates ONLY log a NOTICE, never fail deploy.
--
-- Ops follow-up (when a maintenance window opens):
--   - Run the dedup queries printed inside each DO block below,
--   - Delete/merge the duplicate rows by hand (auditable),
--   - Then apply the strict-guard version in a later PR.
--
-- ADDITIVE + idempotent. Safe to re-run.

-- ═════════════════════════════════════════════════════════════════════════════
-- Part A — provider_applications resubmission columns (was in 0125)
--   MonitoringWatchdog.processApplicationTimeouts reads
--   `last_requested_resubmission_at` every 5 min. Without these columns the
--   watchdog throws, /health/strict counts the error, deploys are rejected.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE provider_applications
  ADD COLUMN IF NOT EXISTS resubmission_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_requested_resubmission_at timestamp,
  ADD COLUMN IF NOT EXISTS last_resubmitted_at timestamp,
  ADD COLUMN IF NOT EXISTS sub_status text;

CREATE INDEX IF NOT EXISTS idx_provider_apps_status_resubmission
  ON provider_applications (status, last_requested_resubmission_at)
  WHERE status = 'pending_resubmission';

-- ═════════════════════════════════════════════════════════════════════════════
-- Part B — 0124 defensive UNIQUE guards.
--   Each CREATE UNIQUE INDEX is wrapped so a duplicate-key raise from
--   pre-existing dirty data logs a NOTICE and continues, instead of
--   aborting the migration and blocking the deploy.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) wallet_accounts.user_id UNIQUE
--    Dedup ops query:
--      SELECT user_id, COUNT(*) FROM wallet_accounts
--       GROUP BY user_id HAVING COUNT(*) > 1;
DO $wallet_uq$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_accounts_user_id
      ON wallet_accounts (user_id);
    RAISE NOTICE '[0126] uq_wallet_accounts_user_id created (or already existed).';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '[0126] Duplicate wallet_accounts.user_id rows present — unique index NOT created. Dedupe by hand and re-run.';
  END;
END
$wallet_uq$;

-- 2) digital_receipts partial UNIQUE — one active customer_payment receipt per booking
--    Dedup ops query:
--      SELECT booking_id, COUNT(*) FROM digital_receipts
--       WHERE booking_id IS NOT NULL AND receipt_type='customer_payment' AND is_voided=false
--       GROUP BY booking_id HAVING COUNT(*) > 1;
DO $receipt_uq$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_digital_receipts_active_customer_payment
      ON digital_receipts (booking_id)
      WHERE booking_id IS NOT NULL
        AND receipt_type = 'customer_payment'
        AND is_voided = false;
    RAISE NOTICE '[0126] uq_digital_receipts_active_customer_payment created (or already existed).';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '[0126] Duplicate active customer_payment receipts present — unique index NOT created. Dedupe by hand and re-run.';
  END;
END
$receipt_uq$;

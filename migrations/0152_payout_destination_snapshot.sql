-- ─────────────────────────────────────────────────────────────────────────────
-- 0152 — the payout destination is SNAPSHOTTED, not looked up at transfer time
--
-- THE BUG (docs/security/money-authority-census-2026-09-08.md).
-- ProviderPayoutService.processIsraeliBankTransfer() reads
--
--     provider.bankAccountNumber   provider.bankName
--     provider.bankCode            provider.bankBranchCode   provider.legalName
--
-- NONE of which are columns on `providers`. That table has only a
-- `bank_account` jsonb. So the guard `if (!provider.bankAccountNumber || ...)`
-- is ALWAYS true and every payout returns "Provider bank details not
-- configured" before it ever reaches the BANK_PAYOUT_LIVE gate. The payout path
-- is dead, and the reason it is dead is a set of phantom field reads.
--
-- The tempting repair — add those columns to `providers` — is the wrong one
-- twice over. It creates a FOURTH home for bank data (the canonical store is
-- contractor_bank_details), and it makes the destination MUTABLE at transfer
-- time: change the profile after a payout is authorised and the money follows
-- the new destination.
--
-- super_app_payouts already carries provider_bank_iban / provider_bank_name,
-- clearly intended as a snapshot. Nothing has ever written them, and IBAN plus
-- name is not enough for a real Israeli transfer anyway.
--
-- This completes that snapshot. Written ONCE when the payout is authorised,
-- read by the executor, never re-derived. A payout authorised for destination A
-- can never be redirected to destination B by a later profile edit.
--
-- ADDITIVE AND INERT. Columns only; no behaviour changes until the executor
-- reads them (same PR) and the creation sites populate them (follow-up).
-- BANK_PAYOUT_LIVE stays off.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE super_app_payouts
  ADD COLUMN IF NOT EXISTS provider_bank_code            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS provider_bank_branch_code     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS provider_bank_account_number  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_bank_account_holder  VARCHAR(255),
  -- Which contractor_bank_details row this was taken from, and when. Lets an
  -- operator answer "was this destination verified at the time we authorised
  -- it?" without trusting the profile as it stands today.
  ADD COLUMN IF NOT EXISTS destination_source_id         VARCHAR(120),
  ADD COLUMN IF NOT EXISTS destination_verified_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS destination_snapshot_at       TIMESTAMP;

COMMENT ON COLUMN super_app_payouts.provider_bank_account_number IS
  'Destination snapshot taken at authorisation. NEVER re-read from the provider profile at transfer time.';
COMMENT ON COLUMN super_app_payouts.destination_snapshot_at IS
  'When the destination was frozen onto this payout. NULL means no snapshot — the executor must refuse.';

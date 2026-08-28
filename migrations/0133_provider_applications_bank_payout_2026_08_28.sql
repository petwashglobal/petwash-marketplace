-- CEO §73 #12 (2026-08-28): Bank / payout details on the provider application.
--
-- Providers went through the entire /apply wizard and NEVER entered bank
-- details. The `super_app_payouts` rail has provider_bank_iban /
-- provider_bank_name columns, but they were POPULATED FROM NOTHING —
-- every approved provider ended up with a payout row pointing at a
-- null IBAN, and payout admin had to chase every one by hand.
--
-- Add the canonical bank fields to provider_applications so the wizard
-- can collect them at intake and admin can review + approve payouts
-- against a real account. All fields nullable (rolling deploy — the
-- server accepts them before the client sends them) and additive.
--
-- The raw account_number stays behind a nullable ENCRYPTED column in a
-- future migration; this MVP just persists the routing-safe fields
-- (bank_name, branch_code, IBAN, holder name). IBAN alone is enough to
-- route an Israeli bank transfer through Mizrahi's ACH.

ALTER TABLE provider_applications
  ADD COLUMN IF NOT EXISTS bank_name              varchar(120),
  ADD COLUMN IF NOT EXISTS bank_branch_code       varchar(20),
  ADD COLUMN IF NOT EXISTS bank_iban              varchar(40),
  ADD COLUMN IF NOT EXISTS bank_account_holder    varchar(200),
  ADD COLUMN IF NOT EXISTS bank_details_at        timestamp;

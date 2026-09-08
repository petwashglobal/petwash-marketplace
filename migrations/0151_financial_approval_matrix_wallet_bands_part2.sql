-- ─────────────────────────────────────────────────────────────────────────────
-- 0151 — approval bands for the three remaining value-moving wallet routes
--
-- Extends 0150, which covered wallet_adjust / wallet_support / wallet_refund.
-- The census (docs/security/money-authority-census-2026-09-08.md) listed four
-- more routes as "derives its amount, needs canonical resolution rather than a
-- ceiling". Reading them, three need a case_type that 0150 does not define:
--
--   wallet_release      / release           POST /admin/wallet/release
--                                           amount is booking.wallet_hold_cents,
--                                           state must be 'hold_active'
--   wallet_payout_entry / mark_paid         POST /admin/wallet/payout-entries/mark-paid
--                                           amount is the SUM of the payable
--                                           provider_payout_entries
--   wallet_dispute      / apply_resolution  POST /admin/wallet/disputes/:ref/apply-resolution
--                                           refund + clawback, both caller-chosen
--
-- The fourth, /admin/wallet/support/release-hold, already matches 0150's
-- wallet_support / release_hold and needs no new row.
--
-- SAME BANDS AS 0150 deliberately — one policy, not a second one that drifts.
-- Change them at runtime through the matrix CRUD (admin/executive only), never
-- by editing this file after it has applied.
--
--   band 1   0 .. 50000 agorot   (≤ ₪500)      admin,      no second approver
--   band 2   50001 .. 500000     (≤ ₪5,000)    admin,      second: executive
--   band 3   500001 .. unbounded (> ₪5,000)    executive,  second: executive
--
-- IDEMPOTENT, keyed on the same natural tuple as 0150, so it is safe to
-- re-run and will never overwrite a threshold an operator deliberately set.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- (case_type, action_type) pairs for the wallet routes wired in this pass.
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('wallet_release',      'release'),
      ('wallet_payout_entry', 'mark_paid'),
      ('wallet_dispute',      'apply_resolution')
) AS t(case_type, action_type)
  LOOP
    -- band 1 — one admin, no second approver, up to ₪500
    INSERT INTO financial_approval_matrix
      (case_type, action_type, owner_scope, owner_id,
       min_amount_cents, max_amount_cents, required_role, second_approval_role, is_active)
    SELECT pair.case_type, pair.action_type, 'global', NULL,
           0, 50000, 'admin', NULL, TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM financial_approval_matrix
      WHERE case_type = pair.case_type AND action_type = pair.action_type
        AND owner_scope = 'global' AND owner_id IS NULL AND min_amount_cents = 0
    );

    -- band 2 — still an admin, but a second approver is required
    INSERT INTO financial_approval_matrix
      (case_type, action_type, owner_scope, owner_id,
       min_amount_cents, max_amount_cents, required_role, second_approval_role, is_active)
    SELECT pair.case_type, pair.action_type, 'global', NULL,
           50001, 500000, 'admin', 'executive', TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM financial_approval_matrix
      WHERE case_type = pair.case_type AND action_type = pair.action_type
        AND owner_scope = 'global' AND owner_id IS NULL AND min_amount_cents = 50001
    );

    -- band 3 — executive only, second approver required, no ceiling
    INSERT INTO financial_approval_matrix
      (case_type, action_type, owner_scope, owner_id,
       min_amount_cents, max_amount_cents, required_role, second_approval_role, is_active)
    SELECT pair.case_type, pair.action_type, 'global', NULL,
           500001, NULL, 'executive', 'executive', TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM financial_approval_matrix
      WHERE case_type = pair.case_type AND action_type = pair.action_type
        AND owner_scope = 'global' AND owner_id IS NULL AND min_amount_cents = 500001
    );
  END LOOP;
END $$;

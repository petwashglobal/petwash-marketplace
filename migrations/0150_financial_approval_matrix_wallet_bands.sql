-- ─────────────────────────────────────────────────────────────────────────────
-- Authority bands for the admin wallet routes that move value.
--
-- WHY THIS MIGRATION EXISTS AT ALL. checkFinancialAuthority() blocks when no
-- rule matches ("No approval rule found ... action blocked"). Nothing in this
-- repository has ever seeded financial_approval_matrix — the table is created
-- by 0079 and the only writer is the admin CRUD route — so wiring the authority
-- gate onto the wallet routes WITHOUT these rows would have failed every one of
-- them closed the moment it deployed. The control and the data it needs ship
-- together, or the control is an outage.
--
-- ── THE NUMBERS ARE DEFAULTS, NOT A POLICY DECISION ──────────────────────────
--
-- Approval thresholds are the CEO's call, not an engineering one. These are
-- deliberately conservative starting values, and they are grounded in the one
-- ceiling the codebase already chose for itself rather than invented from
-- nothing: /admin/wallet/support/credit has always capped a support credit at
-- ₪500 (50000 agorot). That existing decision is used as the "one admin, no
-- second approver" band; everything above it needs a second pair of eyes.
--
-- They are editable at runtime through the existing matrix CRUD
-- (/api/financial-approvals/matrix, admin/executive only since #2317) with NO
-- code change. Change them there once the real policy is set.
--
--   band 1   0 .. 50000 agorot   (≤ ₪500)      admin,      no second approver
--   band 2   50001 .. 500000     (≤ ₪5,000)    admin,      second: executive
--   band 3   500001 .. unbounded (> ₪5,000)    executive,  second: executive
--
-- IDEMPOTENT. Inserts only what is missing, keyed on the natural tuple
-- (case_type, action_type, owner_scope, owner_id, min_amount_cents), so this is
-- safe whether the table is empty or an operator has already added rules — and
-- it will never overwrite a threshold someone deliberately set.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  -- (case_type, action_type) pairs for the wallet routes wired in this pass.
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('wallet_adjust',  'credit'),
      ('wallet_adjust',  'debit'),
      ('wallet_support', 'credit'),
      ('wallet_support', 'issue_refund'),
      ('wallet_support', 'release_hold'),
      -- POST /admin/wallet/refund. Its amountCents is a caller-CHOSEN partial
      -- figure (the route only bands it when one is supplied; a full refund is
      -- bounded by the booking), so it takes the same three bands.
      --
      -- This row and the KNOWN_UNSEEDED waiver in
      -- scripts/guards/wallet_authority_vocabulary.py MUST land together: that
      -- guard fails a waiver for a pair that is now seeded, precisely so a
      -- stale waiver cannot hide the next real gap. Both are in this commit.
      ('wallet_refund',  'refund')
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

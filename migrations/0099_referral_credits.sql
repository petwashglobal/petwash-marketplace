-- 0099 — durable referral credits.
--
-- WHY: server/routes/referral.ts held EVERY piece of referral state in
-- in-process JavaScript Maps — codes, referral records, stats, and
-- `userCredits` (real ₪25 credit balances). The router is mounted at
-- /api/referral and a customer-facing ReferralPage reads it, so a customer could
-- refer a friend, be shown a balance, and lose it on the next deploy. We deploy
-- several times a day.
--
-- Those credits were also never spendable: they were plain numbers on an object,
-- never in walletAccounts, never in the hash-chained ledger. So the feature
-- reported success while granting nothing real.
--
-- This table makes the OBLIGATION durable. It deliberately does NOT move money:
-- a row here says "this member earned ₪X and it is owed", and issuance into the
-- wallet stays an explicit, audited step — same pattern as the refund rail.
-- Recording truthfully first, paying second.

CREATE TABLE IF NOT EXISTS referral_credits (
  id             SERIAL PRIMARY KEY,
  user_id        VARCHAR(255) NOT NULL,          -- who earned it (Firebase UID)
  referral_id    INTEGER      REFERENCES referrals(id) ON DELETE SET NULL,
  role           VARCHAR(16)  NOT NULL,          -- 'inviter' | 'invitee'
  amount_ils     NUMERIC(10,2) NOT NULL,
  status         VARCHAR(24)  NOT NULL DEFAULT 'earned', -- earned | issued | void
  reason         TEXT,
  -- Idempotency: one credit per (referral, role). A retried /complete cannot
  -- double-credit, and this is enforced by the database rather than by a check.
  CONSTRAINT uq_referral_credit_per_role UNIQUE (referral_id, role),
  issued_at      TIMESTAMPTZ,
  issued_ref     VARCHAR(128),                   -- wallet ledger txn id once paid
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_referral_credit_amount_positive CHECK (amount_ils > 0)
);

CREATE INDEX IF NOT EXISTS idx_referral_credits_user   ON referral_credits (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_credits_status ON referral_credits (status) WHERE status = 'earned';

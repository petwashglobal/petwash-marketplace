-- 0115: idempotency key for loyalty reward redemption (redeem-path audit R5).
--
-- Background: POST /api/loyalty/rewards/redeem wraps its three writes (deduct
-- points, mint user_redemptions voucher, log points_transactions) in a
-- transaction, but there was NO idempotency key on the issuance. A double
-- submit (double-click / client retry) therefore minted TWO REWARD-* vouchers
-- and debited points twice.
--
-- Fix: a client-supplied request id, namespaced to
--   loyalty:redeem:{userId}:{rewardId}:{clientReqId}
-- is stored on user_redemptions and made UNIQUE. The route checks it inside the
-- transaction (fast path) and this partial unique index is the race-safe
-- backstop: a concurrent second insert fails closed (23505) and the route
-- returns the FIRST redemption instead of minting a second voucher.
--
-- Partial (WHERE NOT NULL) so legacy rows and callers that send no key are
-- unaffected. No pre-existing data can violate it (the column is new/NULL).

ALTER TABLE user_redemptions
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(191);

CREATE UNIQUE INDEX IF NOT EXISTS user_redemptions_idempotency_key_uq
  ON user_redemptions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

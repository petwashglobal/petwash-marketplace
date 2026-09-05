-- 0114: type-aware loyalty-ledger idempotency guard (redeem-path audit R8).
--
-- Background: 0101 added `points_txn_source_uq` on
--   points_transactions (user_id, source, source_id)  WHERE source_id IS NOT NULL
-- to block a concurrent double-EARN. That guard is real but TOO BROAD: the
-- reversal path (loyaltyEarn.reverseLoyaltyPoints) writes a 'reversed' row with
-- the SAME (user_id, source, source_id) as the original 'earned' row — that is
-- how it correlates the refund to the award. Under the 3-column index the
-- reversal INSERT collides with the award row (23505), so every reversal threw
-- — and because the old code decremented the balance in a SEPARATE statement
-- first, points were deducted with NO audit row. A latent money-integrity bug
-- behind KIOSK_PRESTIGE_SYNC_ENABLED (nayax-monyx-events reverseAwardedPoints).
--
-- Fix: make the uniqueness TYPE-aware. Two rows of the SAME type (two 'earned',
-- two 'reversed') for one (user, source, source_id) are still forbidden — the
-- double-award / double-reverse guard the audit asked for — but an 'earned' and
-- its matching 'reversed' can now coexist.
--
-- Safety: the new index is strictly MORE permissive than the old one (adds a
-- 4th column), so it cannot fail to build on data the 3-column index already
-- allowed. The app-level in-transaction check + isUniqueViolation() handling in
-- loyaltyEarn.ts is the fast path; this index is the race-safe DB backstop.

CREATE UNIQUE INDEX IF NOT EXISTS points_txn_source_type_uq
  ON points_transactions (user_id, source, source_id, type)
  WHERE source_id IS NOT NULL;

DROP INDEX IF EXISTS points_txn_source_uq;

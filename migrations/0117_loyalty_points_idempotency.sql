-- 0117: enforce loyalty-point idempotency at the storage layer
-- (Item 222, CEO 2026-08-18 MONEY-CODE approval).
--
-- Rationale: `points_transactions` today has only non-unique indexes on
-- (user_id) and (created_at). Every earn caller has to do its own
-- SELECT-then-INSERT dedupe by (user_id, source, source_id) — see
-- awardLoyaltyPoints() in server/services/loyaltyEarn.ts. That works right
-- up until two webhook retries collide: both check for the existing row,
-- both see none, both INSERT, and the customer earns points twice for one
-- payment. This migration closes that race at the storage layer so no
-- caller can ever bypass it.
--
-- Partial unique — only enforces uniqueness when source_id is set. Rows
-- with source_id NULL (bonus events without a stable ref) stay
-- unconstrained; those events aren't idempotent-eligible in the first
-- place and shouldn't be forced to be.
--
-- Safe to apply on production even if duplicates already exist: the
-- CREATE UNIQUE INDEX ... IF NOT EXISTS is a no-op on re-run, and the
-- WHERE source_id IS NOT NULL clause excludes the null-sourceId rows
-- that were never intended to be idempotent. If pre-existing rows have
-- duplicate (user_id, source, source_id) tuples with source_id set,
-- the index build will fail loudly — that's the correct outcome, since
-- those rows represent already-shipped double-credits that need to be
-- reviewed manually before the guard can be enforced.

CREATE UNIQUE INDEX IF NOT EXISTS
  points_transactions_user_source_ref_uniq_idx
ON points_transactions (user_id, source, source_id)
WHERE source_id IS NOT NULL;

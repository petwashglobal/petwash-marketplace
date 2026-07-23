-- 0101: the two long-deferred DB-level double-credit guards, shipped after a
-- live prod dup-check (2026-07-24, direct Neon query): BOTH groupings have
-- ZERO duplicates (points_transactions: 5 rows, credit_transactions: 0 rows),
-- so these partial UNIQUE indexes cannot fail to apply.
--
-- 1) Loyalty earn idempotency (board: "earn-idempotency SELECT-then-INSERT
--    race — no unique on pointsTransactions"). App-level in-tx checks exist;
--    this is the DB backstop that makes a concurrent double-earn impossible.
CREATE UNIQUE INDEX IF NOT EXISTS points_txn_source_uq
  ON points_transactions (user_id, source, source_id)
  WHERE source_id IS NOT NULL;

-- 2) Wallet credit dedupe (the explicit TODO in PurchaseActivationService:
--    "credit_transactions needs a partial UNIQUE index to make the
--    wallet-credit dedupe race-safe at the DB level").
CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_source_uq
  ON credit_transactions (wallet_id, source_type, source_id)
  WHERE source_id IS NOT NULL;

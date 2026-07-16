-- H1 + H6b (go-live audit): DB-level idempotency backstops for money writes.
-- DEFENSIVE: if historical duplicate rows exist, we must NOT brick the deploy
-- gate — create the unique index only when the data allows it, and RAISE a
-- WARNING (visible in migration logs) otherwise so ops can clean up first.

-- H6b: EgiftFinancialService upserts with
--   ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
-- which requires a matching partial UNIQUE index; today only a plain index
-- exists, so every such upsert throws 42P10.
DO $$
BEGIN
  IF EXISTS (
    SELECT idempotency_key FROM egift_events
     WHERE idempotency_key IS NOT NULL
     GROUP BY idempotency_key HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'egift_events has duplicate idempotency_key values — unique index NOT created; dedupe manually then re-run';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_egift_events_idempotency_key
      ON egift_events (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  END IF;
END
$$;

-- H1: one credit grant per (wallet, source_type, source_id) — the DB backstop
-- behind the in-transaction dup check (which this PR also moves inside the
-- wallet row lock). Partial: rows without a sourceId are exempt by design.
DO $$
BEGIN
  IF EXISTS (
    SELECT wallet_id, source_type, source_id FROM credit_transactions
     WHERE source_id IS NOT NULL
     GROUP BY wallet_id, source_type, source_id HAVING COUNT(*) > 1
  ) THEN
    RAISE WARNING 'credit_transactions has duplicate (wallet_id, source_type, source_id) rows — unique index NOT created; investigate double-credits then re-run';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_txn_wallet_source
      ON credit_transactions (wallet_id, source_type, source_id)
      WHERE source_id IS NOT NULL;
  END IF;
END
$$;

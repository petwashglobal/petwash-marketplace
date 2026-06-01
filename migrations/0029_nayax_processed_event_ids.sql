-- Migration: 0029_nayax_processed_event_ids
--
-- Closes hostile-audit critical: Nayax webhook replay attack possible
-- after process restart or on second Cloud Run instance because the
-- existing dedup was either in-memory (lost on restart) or Redis-backed
-- with a fail-OPEN fallback (when Redis goes down, duplicates pass
-- through and get double-credited).
--
-- New model: insert-first into a Postgres table with TEXT PRIMARY KEY
-- on event_id. INSERT ... ON CONFLICT DO NOTHING RETURNING event_id —
-- if no row is returned, the event was already processed and the
-- webhook handler short-circuits with 200 OK without reprocessing.
--
-- Fully ADDITIVE. New table only. No existing column touched.
-- Idempotent (IF NOT EXISTS).
--
-- Storage growth: at ~100 Nayax events/min (high estimate) → ~4.3M rows/month.
-- A separate cleanup job (deferred to follow-up) will DELETE rows older
-- than 30 days (Nayax's typical retry window). Until then the table
-- grows ~1.5GB/year — trivial for Cloud SQL.

CREATE TABLE IF NOT EXISTS nayax_processed_event_ids (
  -- Nayax-supplied identifier (eventId OR transactionId — whichever is
  -- present on the webhook payload). Stored as TEXT to accommodate
  -- whatever format Nayax sends (UUIDs, numeric ids, prefixed strings).
  event_id      text PRIMARY KEY,
  -- When we first processed this event. Subsequent attempts with the
  -- same event_id are short-circuited as duplicates.
  processed_at  timestamptz NOT NULL DEFAULT now(),
  -- Optional context for forensics — which webhook handler claimed
  -- the event first (terminal / payment / refund / chargeback).
  source_route  varchar(60)
);

-- Cleanup queries will use processed_at; index it for the future
-- delete-old-rows cron.
CREATE INDEX IF NOT EXISTS idx_nayax_processed_event_ids_processed_at
  ON nayax_processed_event_ids (processed_at);

-- ROLLBACK (commented — for reference only)
-- DROP INDEX IF EXISTS idx_nayax_processed_event_ids_processed_at;
-- DROP TABLE IF EXISTS nayax_processed_event_ids;
-- After rollback the route falls back to the old Redis-based dedup
-- (which is still present in the code on this commit's predecessor).
-- Production must NOT roll back without first re-enabling that path.

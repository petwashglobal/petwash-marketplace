-- 0121: Nayax webhook dedup poison-event fix (P0-A, 2026-08-20 audit).
--
-- The previous dedup pattern (nayax_processed_event_ids) INSERTed the event_id
-- BEFORE the business handler ran. If the handler threw or returned 500 after
-- the claim, Nayax's retry saw the row as claimed, our middleware returned 200
-- with deduplicated:true, and the business event was LOST FOREVER — payment
-- uncredited, refund unbooked, settlement unreconciled.
--
-- This migration turns nayax_processed_event_ids into a proper webhook inbox
-- with an explicit state machine:
--   RECEIVED          — row inserted on arrival, handler about to run
--   PROCESSING        — handler has started
--   COMPLETED         — handler committed successfully; safe to short-circuit
--   FAILED_RETRYABLE  — transient failure; a Nayax retry MUST re-run the handler
--   FAILED_FINAL      — permanent failure (bad payload, etc.); short-circuit as
--                       processed to stop Nayax retry storms
--
-- The row is always inserted first (audit trail), but "processed = dedup" now
-- means COMPLETED (or FAILED_FINAL), not "row exists". A stale PROCESSING row
-- (>10 min) is treated as a crashed handler and the retry is re-run.
--
-- Additive-only: keeps the existing event_id PK, source_route column, and the
-- processed_at index. Every ALTER uses IF NOT EXISTS / DEFAULT so re-apply is
-- safe on partially-migrated environments.

ALTER TABLE nayax_processed_event_ids
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED';

-- Historical rows predate the state machine; anything already in the table was
-- inserted by the old insert-first-then-run flow, so from the caller's point of
-- view its downstream side-effects either landed OR the whole event was lost.
-- Marking them COMPLETED keeps replays short-circuiting exactly as before —
-- the new state machine only governs rows written from this migration onward.

ALTER TABLE nayax_processed_event_ids
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

ALTER TABLE nayax_processed_event_ids
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE nayax_processed_event_ids
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE nayax_processed_event_ids
  ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Guardrail: status must be one of the five known values. If future code adds
-- another state, extend this constraint in a follow-up migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'nayax_processed_event_ids_status_check'
  ) THEN
    ALTER TABLE nayax_processed_event_ids
      ADD CONSTRAINT nayax_processed_event_ids_status_check
      CHECK (status IN ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED_RETRYABLE', 'FAILED_FINAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nayax_processed_event_ids_status_last_attempt
  ON nayax_processed_event_ids (status, last_attempt_at);

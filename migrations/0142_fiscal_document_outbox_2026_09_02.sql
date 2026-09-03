-- Release-blocker A3 / A4 / A5 — durable outbox for fiscal work that
-- previously disappeared into a non-blocking `.catch()` on booking
-- completion (VAT ledger write, Israeli digital receipt, Academy
-- receipt, Walk-My-Pet legacy bridge).
--
-- CEO 2026-09-02 release freeze: "A legal receipt is not 'best effort'.
-- Persist durable fiscal-document work and retry it until completed or
-- explicitly failed for intervention."
--
-- Design:
--   - kind         : which fiscal task this row represents.
--   - source_key   : idempotency key — (kind, source_key) is UNIQUE so
--                    duplicate enqueue is safe on retry.
--   - payload      : the JSON args to hand back to the retry worker.
--   - status       : lifecycle. pending → succeeded / failed_needs_review.
--   - attempts     : how many worker retries have run.
--   - next_attempt_at : exponential-backoff schedule; the drainer picks
--                       rows where status='pending' AND next_attempt_at <= now().
--   - last_error   : most recent failure text (truncated).
--
-- The drainer worker + admin surface are separate commits — this
-- migration + the enqueue service are the minimum durable persistence.

CREATE TABLE IF NOT EXISTS fiscal_document_outbox (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT NOT NULL,
  source_key        TEXT NOT NULL,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  next_attempt_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  succeeded_at      TIMESTAMPTZ,
  CONSTRAINT fiscal_document_outbox_status_check
    CHECK (status IN ('pending', 'succeeded', 'failed_needs_review'))
);

-- Idempotency guard — a second enqueue for the same (kind, source_key)
-- is a no-op via ON CONFLICT DO NOTHING at the write site.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_document_outbox_kind_source
  ON fiscal_document_outbox (kind, source_key);

-- Drainer index — worker walks pending rows by due-time.
CREATE INDEX IF NOT EXISTS idx_fiscal_document_outbox_drainer
  ON fiscal_document_outbox (status, next_attempt_at)
  WHERE status = 'pending';

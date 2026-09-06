-- Nayax refund events — the refund state machine.
--
-- Separate from nayax_fiscal_document_links by design: that table records
-- "transaction ↔ document" and cannot hold attempt timestamps, claim state,
-- resolution provenance or error history.
--
-- original_transaction_id is NULLABLE because Nayax does not tell us the parent.
-- Measured on the 2026 export (2026-09-06), across all six known refund pairs:
--   Authorization RRN        differs 0/6
--   Acquirer Transaction ID  empty on both sides
--   Batch Ref Number         differs 0/6
--   Card Number / Machine    match 6/6 — and are NOT sufficient: across 518 card
--                            sales, 23.6% are not uniquely identified by
--                            (card, machine, amount); 41 pairs are mutually
--                            ambiguous within ±4 days.
-- So the parent stays unknown until something authoritative says otherwise, and
-- only NAYAX_AUTHORITATIVE or HUMAN_RESOLVED may authorise a credit document.
-- HEURISTIC_SUGGESTION is for a review screen and never authorises issuance.
--
-- Additive only. No existing column or row is altered.

CREATE TABLE IF NOT EXISTS nayax_refund_events (
  id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  refund_transaction_id       VARCHAR NOT NULL,
  machine_id                  VARCHAR NOT NULL,

  amount_minor                INTEGER NOT NULL,
  currency                    VARCHAR(3) NOT NULL DEFAULT 'ILS',
  observed_at                 TIMESTAMP NOT NULL DEFAULT NOW(),

  original_transaction_id     VARCHAR,
  -- NAYAX_AUTHORITATIVE | HUMAN_RESOLVED | HEURISTIC_SUGGESTION
  original_resolution_source  VARCHAR,

  -- OBSERVED | AWAITING_ORIGINAL | READY | CLAIMED | PENDING_LOOKUP
  -- | ISSUED | NEEDS_RECONCILIATION
  state                       VARCHAR NOT NULL DEFAULT 'OBSERVED',

  external_reference          VARCHAR NOT NULL,

  -- Persisted BEFORE the first create call. Recovery searches SUMIT around THIS
  -- instant, never the settlement time: on the 480 real documents the
  -- service->issue gap ran to a median of 30 days and a max of 56.
  first_create_attempt_at     TIMESTAMP,
  last_attempt_at             TIMESTAMP,
  attempt_count               INTEGER NOT NULL DEFAULT 0,

  sumit_credit_document_id     VARCHAR,
  sumit_credit_document_number VARCHAR,
  last_error                   TEXT,

  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- Nayax does not formally guarantee Transaction ID uniqueness across the
-- operator, so the safe key is machine + refund id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nayax_refund_event
  ON nayax_refund_events (machine_id, refund_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nayax_refund_external_ref
  ON nayax_refund_events (external_reference);
CREATE INDEX IF NOT EXISTS idx_nayax_refund_state
  ON nayax_refund_events (state);
CREATE INDEX IF NOT EXISTS idx_nayax_refund_original
  ON nayax_refund_events (original_transaction_id);

COMMENT ON COLUMN nayax_refund_events.original_transaction_id IS
  'The sale being reversed. NULL until authoritatively or humanly resolved — '
  'Nayax does not provide a parent transaction reference in the export.';
COMMENT ON COLUMN nayax_refund_events.first_create_attempt_at IS
  'Persisted before the first SUMIT create call. Recovery searches around this '
  'instant, never the Nayax settlement time.';

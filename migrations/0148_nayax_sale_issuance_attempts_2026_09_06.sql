-- Nayax SALE issuance attempts — the claim ledger for the income rail.
--
-- WHY THIS EXISTS
-- ---------------
-- Until now the sale path selected its candidates purely from the live Nayax
-- feed and consulted no persisted state, and nothing recorded that a document
-- had been issued for a sale. The hourly cron's own comment claimed the rail was
-- "idempotent (deterministic key per Nayax tx), so overlapping runs can never
-- double-issue a document". That was not true:
--
--   * the deterministic key reaches SUMIT only as an Idempotency-Key header and
--     an ExternalReference. SUMIT does not deduplicate on either — which is the
--     entire reason findDocumentByExternalReference (read-before-recreate)
--     exists. If SUMIT deduplicated, that lookup would be unnecessary.
--   * nothing wrote a sale's document into nayax_fiscal_document_links, so a
--     second run re-selected every already-invoiced wash.
--
-- An hourly cron over a rolling window would therefore have issued a fresh tax
-- invoice for every eligible wash, every hour. This table is what makes the
-- claim in that comment actually true.
--
-- Mirrors nayax_refund_events deliberately: same claim-before-create discipline,
-- same recovery contract. It is SEPARATE from nayax_fiscal_document_links
-- because that table records "transaction <-> document" and cannot hold attempt
-- timestamps, claim state or error history.
--
-- Additive only. No existing column or row is altered.

CREATE TABLE IF NOT EXISTS nayax_sale_issuance_attempts (
  id                          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  nayax_transaction_id        VARCHAR NOT NULL,
  machine_id                  VARCHAR NOT NULL,

  amount_minor                INTEGER NOT NULL,
  currency                    VARCHAR(3) NOT NULL DEFAULT 'ILS',

  -- The Nayax close. The document's fiscal date (bookkeeper, 2026-09-06).
  settled_at                  TIMESTAMP,

  -- READY | CLAIMED | PENDING_LOOKUP | ISSUED | NEEDS_RECONCILIATION | WITHHELD
  state                       VARCHAR NOT NULL DEFAULT 'READY',

  external_reference          VARCHAR NOT NULL,

  -- Persisted BEFORE the first create call. Recovery searches SUMIT around THIS
  -- instant, never the settlement time: on the 481 real documents the
  -- service->issue gap ran to a median of 30 days and a max of 56, so a window
  -- centred on the wash would report ABSENT for documents that plainly exist.
  first_create_attempt_at     TIMESTAMP,
  last_attempt_at             TIMESTAMP,
  attempt_count               INTEGER NOT NULL DEFAULT 0,

  sumit_document_id           VARCHAR,
  sumit_document_number       VARCHAR,
  last_error                  TEXT,

  created_at                  TIMESTAMP DEFAULT NOW(),
  updated_at                  TIMESTAMP DEFAULT NOW()
);

-- Nayax does not formally guarantee Transaction ID uniqueness across the
-- operator, so the safe key is machine + transaction. THIS INDEX IS THE
-- DUPLICATE GUARD: a second run cannot insert a second claim for the same sale.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nayax_sale_issuance
  ON nayax_sale_issuance_attempts (machine_id, nayax_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nayax_sale_external_ref
  ON nayax_sale_issuance_attempts (external_reference);
CREATE INDEX IF NOT EXISTS idx_nayax_sale_state
  ON nayax_sale_issuance_attempts (state);

COMMENT ON TABLE nayax_sale_issuance_attempts IS
  'Claim ledger for K9000 sale invoicing. Its unique index on '
  '(machine_id, nayax_transaction_id) is what prevents a repeated cron run from '
  'issuing a second tax invoice for the same wash.';
COMMENT ON COLUMN nayax_sale_issuance_attempts.first_create_attempt_at IS
  'Persisted before the first SUMIT create call. Recovery searches around this '
  'instant, never the Nayax settlement time.';

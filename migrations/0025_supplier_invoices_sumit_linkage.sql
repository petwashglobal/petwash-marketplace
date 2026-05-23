-- Migration: 0025_supplier_invoices_sumit_linkage
--
-- PR-S2 from docs/finance/sumit-readiness-check-2026-05-23.md.
-- Adds SUMIT (sumit.co.il) document-linkage columns to supplier_invoices
-- and an append-only outbound-events audit table for every SUMIT call.
--
-- Fully ADDITIVE. Every new column is nullable with no default. No existing
-- column is touched. Every existing INSERT/UPDATE/read keeps working.
-- Idempotent (IF NOT EXISTS / DO-block existence check on constraint).
--
-- This migration moves NO money. No SUMIT send happens until PR-S4 adds
-- the admin "Send to SUMIT" button gated by
-- ff.supplier_invoice_control.sumit_send.enabled (default OFF). The
-- columns and the events table can stay empty in production indefinitely.
--
-- Rollback (commented at bottom): drop indexes, drop constraint, drop
-- columns, drop the events table. Safe to roll back AS LONG AS no rows
-- have been written — verify with the SELECT in the rollback block.

------------------------------------------------------------------
-- 1. SUMIT linkage columns on supplier_invoices
------------------------------------------------------------------

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS sumit_document_id      varchar(64);
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS sumit_status           varchar(20);
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS sumit_sent_at          timestamptz;
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS sumit_confirmed_at     timestamptz;
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS sumit_last_error       text;
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS sumit_idempotency_key  varchar(80);

-- Constrain sumit_status to a known set so PR-S4 cannot accidentally
-- write a typoed value. NULL means "never attempted" (default state).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'supplier_invoices_sumit_status_chk'
  ) THEN
    ALTER TABLE supplier_invoices
      ADD CONSTRAINT supplier_invoices_sumit_status_chk
      CHECK (
        sumit_status IS NULL OR
        sumit_status IN ('pending', 'sent', 'confirmed', 'failed')
      );
  END IF;
END$$;

-- Lookups: find an invoice by SUMIT's id (webhook handler will use this),
-- find invoices stuck in 'pending' or 'sent' (reconciliation job will use
-- this), and dedupe by idempotency key on retries.
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoices_sumit_document
  ON supplier_invoices (sumit_document_id)
  WHERE sumit_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_sumit_status
  ON supplier_invoices (sumit_status)
  WHERE sumit_status IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoices_sumit_idem
  ON supplier_invoices (sumit_idempotency_key)
  WHERE sumit_idempotency_key IS NOT NULL;

------------------------------------------------------------------
-- 2. Outbound-events audit table
------------------------------------------------------------------
-- One row per SUMIT request/response or inbound webhook. Append-only.
-- Used for: replay, debug, reconciliation, compliance audit. Never
-- mutated after insert (no UPDATE on this table).

CREATE TABLE IF NOT EXISTS sumit_outbound_events (
  id                    serial PRIMARY KEY,
  invoice_id            integer REFERENCES supplier_invoices(id) ON DELETE CASCADE NOT NULL,
  event_type            varchar(40) NOT NULL,
    -- create_document | create_document_retry |
    -- webhook_received | reconcile_lookup
  direction             varchar(10) NOT NULL,
    -- outbound (we called SUMIT) | inbound (SUMIT called us)
  sumit_document_id     varchar(64),
  idempotency_key       varchar(80) NOT NULL,
  request_payload       jsonb,
    -- redacted: never store SUMIT_API_KEY here, only the document body
  response_status_code  integer,
  response_body         jsonb,
  error_message         text,
  actor                 varchar(128),
    -- admin user who triggered the send (for audit chain); null for inbound
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sumit_outbound_events_invoice
  ON sumit_outbound_events (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sumit_outbound_events_created_desc
  ON sumit_outbound_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sumit_outbound_events_idem
  ON sumit_outbound_events (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sumit_outbound_events_doc
  ON sumit_outbound_events (sumit_document_id)
  WHERE sumit_document_id IS NOT NULL;

------------------------------------------------------------------
-- ROLLBACK (commented — for reference only)
------------------------------------------------------------------
-- Safety check before running rollback (must return 0):
--   SELECT COUNT(*) FROM supplier_invoices
--    WHERE sumit_document_id IS NOT NULL OR sumit_status IS NOT NULL;
--   SELECT COUNT(*) FROM sumit_outbound_events;
--
-- DROP INDEX IF EXISTS idx_sumit_outbound_events_doc;
-- DROP INDEX IF EXISTS idx_sumit_outbound_events_idem;
-- DROP INDEX IF EXISTS idx_sumit_outbound_events_created_desc;
-- DROP INDEX IF EXISTS idx_sumit_outbound_events_invoice;
-- DROP TABLE IF EXISTS sumit_outbound_events;
--
-- DROP INDEX IF EXISTS uq_supplier_invoices_sumit_idem;
-- DROP INDEX IF EXISTS idx_supplier_invoices_sumit_status;
-- DROP INDEX IF EXISTS uq_supplier_invoices_sumit_document;
-- ALTER TABLE supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_sumit_status_chk;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS sumit_idempotency_key;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS sumit_last_error;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS sumit_confirmed_at;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS sumit_sent_at;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS sumit_status;
-- ALTER TABLE supplier_invoices DROP COLUMN IF EXISTS sumit_document_id;

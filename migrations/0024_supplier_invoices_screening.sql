-- Migration: 0024_supplier_invoices_screening
--
-- PR: First Safe PR for the Supplier / Invoice / SUMIT / Fraud-Control system
-- (per SDD docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md).
--
-- Adds two tables for the inbound supplier-invoice screening pipeline.
-- Fully ADDITIVE — every column is nullable or has a safe default; no existing
-- table is touched; every existing INSERT/UPDATE/read keeps working. Idempotent
-- (IF NOT EXISTS on columns + indexes).
--
-- This migration moves NO money. No payment execution, no SUMIT send, no Masav.
-- All new routes are gated behind ff.supplier_invoice_control.enabled (default
-- OFF) — the tables can stay empty in production until the flag is flipped.
--
-- Rollback (commented at bottom): drop indexes, drop tables (safe — no FKs into
-- them from existing data).

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id                       serial PRIMARY KEY,
  supplier_id              integer REFERENCES suppliers(id) ON DELETE RESTRICT,
  -- File / OCR fields
  file_url                 text,
  file_hash                varchar(64) NOT NULL,
  source                   varchar(40) DEFAULT 'admin_upload',
  ocr_invoice_number       varchar(120),
  ocr_supplier_name        varchar(255),
  ocr_business_number      varchar(40),
  ocr_invoice_date         date,
  ocr_amount_before_vat    numeric(12,2),
  ocr_vat_amount           numeric(12,2),
  ocr_total_amount         numeric(12,2),
  ocr_currency             varchar(8),
  ocr_raw_text             text,
  -- Fraud engine enrichment (reuses ReceiptFraudDetection)
  fraud_engine_score       integer,
  fraud_engine_flags       text[],
  -- Screening result
  risk_score               integer NOT NULL DEFAULT 0,
  risk_level               varchar(10) NOT NULL DEFAULT 'green', -- green | yellow | red
  status                   varchar(30) NOT NULL DEFAULT 'uploaded',
    -- uploaded | ocr_processing | needs_review | ready_for_approval |
    -- ready_for_accountant | rejected | blocked
  -- Approval / four-eyes
  uploaded_by              varchar(128),
  approved_by              varchar(128),
  approved_at              timestamptz,
  rejected_by              varchar(128),
  rejected_at              timestamptz,
  rejection_reason         text,
  approval_note            text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier  ON supplier_invoices (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_file_hash ON supplier_invoices (file_hash);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status    ON supplier_invoices (status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_risk      ON supplier_invoices (risk_level);
-- Per-supplier duplicate-invoice-number lookup (a supplier should not invoice
-- the same number twice). Non-unique here on purpose — uniqueness is enforced
-- in the screening logic, not at the DB level, so rejected/legacy rows do not
-- collide with a re-submission.
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_invnum
  ON supplier_invoices (supplier_id, ocr_invoice_number);

CREATE TABLE IF NOT EXISTS supplier_invoice_checks (
  id           serial PRIMARY KEY,
  invoice_id   integer REFERENCES supplier_invoices(id) ON DELETE CASCADE NOT NULL,
  check_type   varchar(60) NOT NULL,
    -- exact_duplicate_file | duplicate_invoice_number |
    -- supplier_name_mismatch | business_number_mismatch | bank_mismatch |
    -- bank_missing_from_invoice | vat_math_mismatch |
    -- fraud_engine_score | fraud_engine_unavailable |
    -- ocr_unavailable | high_amount | missing_tax_documents |
    -- no_job_linked
  result       varchar(10) NOT NULL,  -- pass | warning | fail
  score_impact integer     NOT NULL DEFAULT 0,
  details      jsonb,
  checked_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_checks_invoice ON supplier_invoice_checks (invoice_id);

-- ROLLBACK (commented — for reference only)
-- DROP INDEX IF EXISTS idx_supplier_invoice_checks_invoice;
-- DROP INDEX IF EXISTS idx_supplier_invoices_supplier_invnum;
-- DROP INDEX IF EXISTS idx_supplier_invoices_risk;
-- DROP INDEX IF EXISTS idx_supplier_invoices_status;
-- DROP INDEX IF EXISTS idx_supplier_invoices_file_hash;
-- DROP INDEX IF EXISTS idx_supplier_invoices_supplier;
-- DROP TABLE IF EXISTS supplier_invoice_checks;
-- DROP TABLE IF EXISTS supplier_invoices;

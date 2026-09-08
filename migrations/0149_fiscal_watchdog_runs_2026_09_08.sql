-- Fiscal watchdog run evidence — durable, append-only.
--
-- WHY
-- A watchdog whose runs leave no trace cannot be audited, and "it was green
-- last month" is not a defensible answer to a bookkeeper or an assessor. Every
-- execution records what it looked at, how fresh that data was, what it found,
-- who was told and whether the telling succeeded.
--
-- The bookkeeper's written instruction of 2026-09-06 makes data accuracy the
-- company's responsibility ("באחריות המפתח / החברה בלבד"). This table is how
-- that responsibility is evidenced over time rather than asserted.
--
-- RULES
--   • APPEND-ONLY in practice. Never UPDATE a completed run to make it look
--     better; a re-run is a NEW row. The history of failures is the point.
--   • Holds no cardholder data and no customer PII — counts, totals, statuses
--     and exception identifiers only. Reports are emailed to staff, so this
--     must stay safe to read in full.
--   • report_hash lets a stored run be tied to the exact report that was sent,
--     so a recipient can prove what they received.

CREATE TABLE IF NOT EXISTS fiscal_watchdog_runs (
  id                    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                VARCHAR NOT NULL,
  -- 'daily' | 'monthly' | 'manual' — why this run happened.
  run_kind              VARCHAR NOT NULL DEFAULT 'daily',
  -- The period reconciled, YYYY-MM. NULL for an all-data sweep.
  period                VARCHAR(7),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at           TIMESTAMPTZ,

  -- The state machine's verdict. CLOSED is reserved for every source present
  -- and reconciled; anything else names what is still missing.
  status                VARCHAR NOT NULL,

  -- Per-leg outcome, so a green overall status can never hide a leg that was
  -- simply not checked.
  ac_result             VARCHAR,          -- Nayax ↔ SUMIT
  ab_result             VARCHAR,          -- Nayax internal consistency
  bd_result             VARCHAR,          -- statement ↔ bank

  -- SOURCE FRESHNESS. A pass built on stale data is not a pass, so the as-of
  -- of every layer is part of the evidence, not a log line.
  source_a_latest_at    TIMESTAMPTZ,
  source_b_period       VARCHAR(7),
  source_c_fetched_at   TIMESTAMPTZ,
  source_d_latest_at    TIMESTAMPTZ,
  sources_fresh         BOOLEAN,

  -- Counts and totals. Minor units for money — never floats for fiscal values.
  txn_count             INTEGER NOT NULL DEFAULT 0,
  expect_invoice_count  INTEGER NOT NULL DEFAULT 0,
  documented_count      INTEGER NOT NULL DEFAULT 0,
  documented_minor      BIGINT  NOT NULL DEFAULT 0,
  critical_count        INTEGER NOT NULL DEFAULT 0,
  warning_count         INTEGER NOT NULL DEFAULT 0,

  -- Exceptions as structured JSON: check name, identifier, amount_minor,
  -- detail. No PAN, no cardholder name, no customer contact.
  exceptions            JSONB   NOT NULL DEFAULT '[]'::jsonb,

  -- Delivery evidence.
  recipients            JSONB   NOT NULL DEFAULT '[]'::jsonb,
  delivery_state        VARCHAR,          -- 'sent' | 'partial' | 'failed' | 'not_attempted'
  delivery_error        TEXT,
  sent_at               TIMESTAMPTZ,
  report_hash           VARCHAR(64),      -- sha256 of the report body actually sent

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (run_id) — a re-run gets a new run_id, never overwrites.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_watchdog_run_id
  ON fiscal_watchdog_runs (run_id);

-- The two questions actually asked of this table: "what is the latest state of
-- period X" and "show me every failure".
CREATE INDEX IF NOT EXISTS idx_fiscal_watchdog_period
  ON fiscal_watchdog_runs (period, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiscal_watchdog_status
  ON fiscal_watchdog_runs (status, started_at DESC);

COMMENT ON TABLE fiscal_watchdog_runs IS
  'Append-only evidence of every fiscal watchdog execution: sources and their freshness, per-leg results, exceptions, recipients and delivery outcome. Never UPDATE a completed run to improve it — re-run and insert a new row. Contains no cardholder data or customer PII.';

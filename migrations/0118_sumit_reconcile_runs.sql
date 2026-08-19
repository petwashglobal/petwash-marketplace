-- 0118: SUMIT daily reconciler run log (Phase 2 Item 11 of the SUMIT full-service
-- adoption, CEO 2026-08-19). Additive-only.
--
-- Rationale: SumitReconciliationService.runDailyReconcile() walks a bounded
-- sample of sumit_customers rows and diffs what SUMIT knows about each
-- customer's fiscal documents against what PetWash's local receipt/purchase
-- tables know. It never modifies data. This table is the persisted log so
-- the admin endpoint GET /api/admin/sumit/reconcile-report can render the
-- last run's mismatch list without re-hitting SUMIT.
--
-- Not-touched: users / customers / sumit_customers / digital_receipts /
-- purchases / any money-side column. The reconciler is READ-ONLY; this
-- table holds the OUTPUT of that reconcile, nothing else.

CREATE TABLE IF NOT EXISTS sumit_reconcile_runs (
  id             SERIAL       PRIMARY KEY,
  run_at         TIMESTAMP    NOT NULL DEFAULT now(),
  checked_users  INTEGER      NOT NULL DEFAULT 0,
  mismatches     INTEGER      NOT NULL DEFAULT 0,
  skipped        INTEGER      NOT NULL DEFAULT 0,
  sample_size    INTEGER      NOT NULL DEFAULT 0,
  status         VARCHAR(32)  NOT NULL,               -- 'ok' | 'dormant' | 'flag_off' | 'error'
  reason         TEXT,
  report         JSONB        NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sumit_reconcile_runs_run_at
  ON sumit_reconcile_runs (run_at DESC);

-- 0079_treasury_phantom_tables.sql
-- Build the 6 treasury / financial-approval tables the code already queries via
-- raw SQL but that were NEVER migrated → every /api/treasury and
-- /api/financial-approvals call + the 15-min reconciliation cron 500'd at query
-- time. CEO decision 2026-06-26: BUILD. Columns derived by unioning every
-- SELECT/INSERT/UPDATE site (see PR description).
--
-- NOTES / safety:
--  • Additive only (CREATE … IF NOT EXISTS). No FK constraints (two id conventions
--    coexist), no CHECK on `status` (treasury + prestige use different status
--    vocabularies on payout_batches — an enum would break one of them).
--  • payout_batches is shared by treasury.ts AND prestige-pass.ts/daily-close —
--    columns below are the UNION of both. batch_id is UNIQUE (prestige-pass does
--    INSERT … ON CONFLICT (batch_id) DO UPDATE).
--  • items/failures/reconciliation_results.batch_id reference payout_batches.id
--    (the integer PK), per the JOINs (pb.id = pbi.batch_id).
--  • *_cents on payout_batches are bigint (set via SUM()); per-row cents elsewhere
--    are integer. Defaults matter: several INSERTs omit status/resolved/retry_count/
--    is_active and the reads depend on the defaults below.
-- 2026-06-26.

-- ── 1. payout_batches ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_batches (
  id                     SERIAL PRIMARY KEY,
  batch_id               TEXT        NOT NULL,
  owner_scope            TEXT        DEFAULT 'company',
  owner_id               TEXT,
  total_net_cents        BIGINT      DEFAULT 0,
  currency               TEXT        DEFAULT 'ILS',
  status                 TEXT        NOT NULL DEFAULT 'pending',
  notes                  TEXT,
  created_by_uid         TEXT,
  total_providers        INTEGER     DEFAULT 0,
  gross_total_cents      BIGINT,
  commission_total_cents BIGINT,
  net_total_cents        BIGINT,
  entry_count            INTEGER     DEFAULT 0,
  total_amount_cents     BIGINT,
  submitted_at           TIMESTAMPTZ,
  paid_at                TIMESTAMPTZ,
  failed_at              TIMESTAMPTZ,
  reconciled_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_batches_batch_id ON payout_batches (batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status      ON payout_batches (status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_created_at  ON payout_batches (created_at);

-- ── 2. payout_batch_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_batch_items (
  id            SERIAL PRIMARY KEY,
  batch_id      INTEGER NOT NULL,   -- → payout_batches.id
  settlement_id INTEGER NOT NULL,   -- → station_settlements.id
  amount_cents  INTEGER,
  status        TEXT    DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch      ON payout_batch_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_settlement ON payout_batch_items (settlement_id);

-- ── 3. payout_failures ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_failures (
  id            SERIAL PRIMARY KEY,
  batch_id      INTEGER NOT NULL,   -- → payout_batches.id
  reason        TEXT,
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payout_failures_batch    ON payout_failures (batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_failures_resolved ON payout_failures (resolved);

-- ── 4. reconciliation_results ──────────────────────────────────────────────
-- (No UNIQUE on batch_id: the retry path DELETEs by batch_id before re-inserting,
--  so a unique would risk silently dropping a legitimate recon row. Plain index.)
CREATE TABLE IF NOT EXISTS reconciliation_results (
  id                  SERIAL PRIMARY KEY,
  batch_id            INTEGER,            -- → payout_batches.id (nullable: unmatched)
  bank_transaction_id INTEGER,            -- → bank_transactions.id (nullable)
  status              TEXT NOT NULL,      -- matched | partial | unmatched
  amount_expected     INTEGER,
  amount_actual       INTEGER,
  difference_cents    INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_results_batch  ON reconciliation_results (batch_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_results_status ON reconciliation_results (status);

-- ── 5. financial_approval_matrix ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_approval_matrix (
  id                   SERIAL PRIMARY KEY,
  case_type            TEXT    NOT NULL,           -- refund | payout_release | dispute_close
  action_type          TEXT    NOT NULL,           -- approve | release
  owner_scope          TEXT    NOT NULL DEFAULT 'global',
  owner_id             TEXT,
  min_amount_cents     INTEGER NOT NULL DEFAULT 0,
  max_amount_cents     INTEGER,                     -- NULL = unbounded
  required_role        TEXT    NOT NULL,
  second_approval_role TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_fin_approval_matrix_lookup ON financial_approval_matrix (case_type, action_type, is_active);
CREATE INDEX IF NOT EXISTS idx_fin_approval_matrix_owner  ON financial_approval_matrix (owner_scope, owner_id);

-- ── 6. financial_approval_log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_approval_log (
  id                     SERIAL PRIMARY KEY,
  case_type              TEXT    NOT NULL,
  case_ref_id            TEXT    NOT NULL,          -- text: joined to refund/batch/settlement ids
  action_type            TEXT    NOT NULL,
  amount_cents           INTEGER,
  owner_scope            TEXT    DEFAULT 'global',
  owner_id               TEXT,
  requested_by_uid       TEXT,
  approved_by_uid        TEXT,
  second_approved_by_uid TEXT,
  approval_rule_id       INTEGER,                   -- → financial_approval_matrix.id
  status                 TEXT    NOT NULL,          -- pending | pending_second | approved | rejected | executed
  note                   TEXT,
  approved_at            TIMESTAMPTZ,
  executed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fin_approval_log_case    ON financial_approval_log (case_type, case_ref_id);
CREATE INDEX IF NOT EXISTS idx_fin_approval_log_status  ON financial_approval_log (status);
CREATE INDEX IF NOT EXISTS idx_fin_approval_log_created ON financial_approval_log (created_at);
CREATE INDEX IF NOT EXISTS idx_fin_approval_log_rule    ON financial_approval_log (approval_rule_id);

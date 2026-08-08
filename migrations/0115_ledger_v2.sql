-- 0115: Unified append-only, double-entry ledger v2 — SCHEMA ONLY, DARK (2026-08-08)
--
-- Foundation for docs/design/2026-08-08-unified-append-only-ledger.md (SDD).
-- This lands the SINGLE source-of-truth money ledger that consolidates wallet /
-- eGift / escrow / loyalty / commission / VAT — the cure for the known
-- double-release / phantom-"secured" / self-mint / double-pay bug classes.
--
-- SAFETY: purely additive, NO callers yet (LEDGER_V2_ENABLED defaults OFF). No
-- existing table is touched, renamed, or dropped. Idempotent (IF NOT EXISTS) so a
-- re-run is a no-op. Prefix >88 → auto-applies on push, but with zero behavior
-- change because nothing reads or writes these tables in this PR.
--
-- The structural money-safety guarantees live in the CONSTRAINTS below:
--   • ledger_v2_transactions.CHECK(total_debits = total_credits)  → a movement cannot
--     be persisted unbalanced (kills self-mint).
--   • ledger_v2_transactions.idempotency_key UNIQUE               → a retried booking/
--     payment cannot create a second transaction (kills double-pay).
--   • ledger_v2_pending_transfers resolve-once (status UPDATE ... WHERE status='open')
--     → an escrow/J5 hold cannot be released twice (kills double-release).
--   • ledger_v2_entries.CHECK(amount_cents > 0), append-only (no updated_at, no delete).

-- ── 7c. ledger_v2_transactions — the balance-enforcing envelope + idempotency anchor ──
CREATE TABLE IF NOT EXISTS ledger_v2_transactions (
  transaction_id   VARCHAR(80)  PRIMARY KEY,
  idempotency_key  VARCHAR(160) NOT NULL UNIQUE,
  event_type       VARCHAR(60)  NOT NULL,
  total_debits     INTEGER      NOT NULL,
  total_credits    INTEGER      NOT NULL,
  response_json    JSONB        DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ledger_v2_txn_balanced CHECK (total_debits = total_credits),
  CONSTRAINT ledger_v2_txn_nonneg   CHECK (total_debits >= 0)
);

-- ── 7a. ledger_v2_accounts — the chart of accounts ──
CREATE TABLE IF NOT EXISTS ledger_v2_accounts (
  id           SERIAL PRIMARY KEY,
  account_id   VARCHAR(160) NOT NULL UNIQUE,   -- stable slug e.g. 'cust:{uid}:cash'
  account_type VARCHAR(20)  NOT NULL,          -- asset | liability | equity | revenue | expense | contra
  owner_type   VARCHAR(20)  NOT NULL,          -- customer | provider | platform | system
  owner_id     VARCHAR(128),                   -- uid for per-user accounts; null for singletons
  bucket       VARCHAR(40)  NOT NULL,          -- cash_wallet | egift | promo | wash_package | loyalty | ...
  currency     VARCHAR(3)   NOT NULL DEFAULT 'ILS',
  normal_side  VARCHAR(10)  NOT NULL,          -- debit | credit
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ledger_v2_accounts_owner_bucket_uq UNIQUE (owner_type, owner_id, bucket, currency)
);

-- ── 7d. ledger_v2_pending_transfers — holds, J5 authorizations, escrow (resolve ONCE) ──
CREATE TABLE IF NOT EXISTS ledger_v2_pending_transfers (
  id                SERIAL PRIMARY KEY,
  pending_id        VARCHAR(80)  NOT NULL UNIQUE,
  kind              VARCHAR(30)  NOT NULL,      -- wallet_hold | j5_authorization | escrow_hold
  from_account_id   VARCHAR(160) NOT NULL,
  to_account_id     VARCHAR(160) NOT NULL,      -- the reserve/holding account
  amount_cents      INTEGER      NOT NULL,
  status            VARCHAR(12)  NOT NULL DEFAULT 'open',  -- open | posted | voided | expired
  booking_id        VARCHAR(120),
  payment_ref       VARCHAR(120),
  idempotency_key   VARCHAR(160) UNIQUE,
  open_entry_txn    VARCHAR(80),
  resolve_entry_txn VARCHAR(80),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  CONSTRAINT ledger_v2_pending_amount_pos CHECK (amount_cents > 0),
  CONSTRAINT ledger_v2_pending_status_ck  CHECK (status IN ('open','posted','voided','expired'))
);

-- ── 7b. ledger_v2_entries — append-only, double-entry (superset of wallet_ledger_entries) ──
-- HARD RULE: no updated_at, no soft-delete. Append only. Corrections = reversal rows.
CREATE TABLE IF NOT EXISTS ledger_v2_entries (
  id              BIGSERIAL PRIMARY KEY,
  entry_id        VARCHAR(80)  NOT NULL UNIQUE,   -- LE-...
  transaction_id  VARCHAR(80)  NOT NULL,          -- groups the >=2 rows of ONE movement
  account_id      VARCHAR(160) NOT NULL,
  direction       VARCHAR(10)  NOT NULL,          -- debit | credit
  amount_cents    INTEGER      NOT NULL,
  currency        VARCHAR(3)   NOT NULL DEFAULT 'ILS',
  event_type      VARCHAR(60)  NOT NULL,
  division_code   VARCHAR(40),
  source_type     VARCHAR(40),
  idempotency_key VARCHAR(160),
  booking_id      VARCHAR(120),
  payment_ref     VARCHAR(120),
  pending_id      VARCHAR(80),
  reversal_of     VARCHAR(80),
  vat_mode        VARCHAR(24),                    -- deferred_liability | taxable_sale
  created_by      VARCHAR(128) NOT NULL,
  ip_address      VARCHAR(45),
  metadata        JSONB        DEFAULT '{}'::jsonb,
  previous_hash   VARCHAR(64)  NOT NULL,
  entry_hash      VARCHAR(64)  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ledger_v2_entries_amount_pos CHECK (amount_cents > 0),
  CONSTRAINT ledger_v2_entries_dir_ck     CHECK (direction IN ('debit','credit'))
);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_txn_idx      ON ledger_v2_entries (transaction_id);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_acct_id_idx  ON ledger_v2_entries (account_id, id);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_booking_idx  ON ledger_v2_entries (booking_id);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_idem_idx     ON ledger_v2_entries (idempotency_key);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_payment_idx  ON ledger_v2_entries (payment_ref);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_event_idx    ON ledger_v2_entries (event_type);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_created_idx  ON ledger_v2_entries (created_at);
CREATE INDEX IF NOT EXISTS ledger_v2_entries_division_idx ON ledger_v2_entries (division_code);

-- ── 7e. ledger_v2_balance_cache — DERIVED, non-authoritative (drop & rebuild anytime) ──
CREATE TABLE IF NOT EXISTS ledger_v2_balance_cache (
  account_id      VARCHAR(160) PRIMARY KEY,
  available_cents INTEGER      NOT NULL DEFAULT 0,
  pending_cents   INTEGER      NOT NULL DEFAULT 0,
  posted_cents    INTEGER      NOT NULL DEFAULT 0,
  last_entry_id   BIGINT       NOT NULL DEFAULT 0,
  rebuilt_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

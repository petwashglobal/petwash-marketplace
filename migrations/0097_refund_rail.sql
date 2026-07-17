-- Refund rail Phase 1 — the canonical refund ledger.
-- Every refund obligation (whether executed now against the wallet, or recorded
-- pending for a card/Phase-2 rail) lands here exactly once, keyed by an
-- idempotency key, so "refund owed but money never moved" is no longer silent.
-- See docs/finance/refund-rail-design-2026-06-23.md.

CREATE TABLE IF NOT EXISTS refund_transactions (
  id                    SERIAL PRIMARY KEY,
  refund_id             VARCHAR(64)  NOT NULL UNIQUE,          -- public opaque id (rfnd_…)
  idempotency_key       VARCHAR(255) NOT NULL UNIQUE,          -- one refund per obligation
  source_type           VARCHAR(40)  NOT NULL,                 -- booking | escrow | marketplace | academy | k9000 | egift
  source_id             VARCHAR(128) NOT NULL,
  user_id               VARCHAR(128) NOT NULL,                 -- customer being refunded (Firebase UID / super-app id)
  instrument            VARCHAR(24)  NOT NULL,                 -- wallet | egift | loyalty | promo | wash_pack | card
  charged_cents         INTEGER,                               -- original charge (context; may be null)
  fee_cents             INTEGER      NOT NULL DEFAULT 0,       -- retained cancellation fee
  refund_cents          INTEGER      NOT NULL,                 -- amount to return (> 0)
  currency              VARCHAR(8)   NOT NULL DEFAULT 'ILS',
  status                VARCHAR(16)  NOT NULL DEFAULT 'pending', -- pending|approved|executing|succeeded|failed|rejected
  rail_ref              VARCHAR(128),                          -- wallet txnId / Nayax ref once executed
  sumit_credit_doc_ref  VARCHAR(128),                          -- Phase 2 SUMIT CreditInvoice ref
  billing_record_id     VARCHAR(128),
  audit_hash            VARCHAR(128),
  approval_id           VARCHAR(128),                          -- refund_approvals link when gated
  reason                TEXT,
  initiated_by          VARCHAR(64),                           -- 'escrow_cancel' | admin uid | 'system'
  created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT refund_transactions_refund_cents_positive CHECK (refund_cents > 0)
);

CREATE INDEX IF NOT EXISTS refund_tx_status_idx      ON refund_transactions (status);
CREATE INDEX IF NOT EXISTS refund_tx_source_idx      ON refund_transactions (source_type, source_id);
CREATE INDEX IF NOT EXISTS refund_tx_user_idx        ON refund_transactions (user_id);

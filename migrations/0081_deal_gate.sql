-- 0081_deal_gate.sql — Deal Gate money/legal backbone (CEO master spec 2026-06-27).
--
-- ADDITIVE ONLY. New tables; no existing column/behaviour changed. Risky money
-- actions live behind flags (CANCELLATION_FEES_ENABLED / NO_SHOW_FEES_ENABLED /
-- CARD_FEE_RECOVERY_ENABLED / AUTO_REFUNDS_ENABLED / PROVIDER_COMPENSATION_ENABLED,
-- all default OFF) — these tables RECORD what would/did apply; the flags gate the
-- live charge. All monetary columns are INTEGER CENTS (ILS × 100), matching
-- pw_payments. Apply via: gh workflow run petwash-ci.yml -f run_migrations=true.

-- ── B. deal_acceptances — the two-sided legal record at the Deal Gate ──────────
CREATE TABLE IF NOT EXISTS deal_acceptances (
  id                          SERIAL PRIMARY KEY,
  booking_id                  VARCHAR NOT NULL,
  customer_user_id            VARCHAR NOT NULL,
  provider_user_id            VARCHAR,
  customer_accepted_at        TIMESTAMP,
  provider_accepted_at        TIMESTAMP,
  customer_terms_version      VARCHAR,
  provider_terms_version      VARCHAR,
  cancellation_policy_version VARCHAR,
  price_breakdown_version     VARCHAR,
  payment_provider            VARCHAR,            -- SUMIT | UPAY | NAYAX | MANUAL
  payment_transaction_id      VARCHAR,
  payment_authorised_at       TIMESTAMP,
  payment_captured_at         TIMESTAMP,
  amount_total_cents          INTEGER,
  currency                    VARCHAR NOT NULL DEFAULT 'ILS',
  ip_address                  VARCHAR,
  device_info                 VARCHAR,
  language                    VARCHAR DEFAULT 'he',
  status                      VARCHAR NOT NULL DEFAULT 'pending', -- pending | confirmed | void
  created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_acceptances_booking ON deal_acceptances (booking_id);
CREATE INDEX IF NOT EXISTS idx_deal_acceptances_customer ON deal_acceptances (customer_user_id);

-- ── D. booking_payments — per-booking payment record (SUMIT/uPay/Nayax) ────────
-- Deal-Gate payment ledger keyed to a booking. Complements the unified pw_payments
-- table (which is the canonical finance row); this is the booking-facing record the
-- Deal Gate validator + admin booking views read.
CREATE TABLE IF NOT EXISTS booking_payments (
  id                      SERIAL PRIMARY KEY,
  booking_id              VARCHAR NOT NULL,
  customer_user_id        VARCHAR NOT NULL,
  provider_user_id        VARCHAR,
  payment_provider        VARCHAR NOT NULL,        -- SUMIT | UPAY | NAYAX | MANUAL
  external_transaction_id VARCHAR,
  pw_payment_id           VARCHAR,                 -- FK-ish link to pw_payments.payment_id
  amount_cents            INTEGER NOT NULL,
  currency                VARCHAR NOT NULL DEFAULT 'ILS',
  status                  VARCHAR NOT NULL DEFAULT 'created', -- created|authorised|captured|failed|refunded
  authorised_at           TIMESTAMP,
  captured_at             TIMESTAMP,
  failed_at               TIMESTAMP,
  failure_reason          VARCHAR,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON booking_payments (booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_payments_ext ON booking_payments (payment_provider, external_transaction_id);

-- ── D. booking_refunds — policy-driven refund record (never delete a txn) ──────
CREATE TABLE IF NOT EXISTS booking_refunds (
  id                            SERIAL PRIMARY KEY,
  booking_id                    VARCHAR NOT NULL,
  payment_id                    VARCHAR,
  requested_by                  VARCHAR,
  reason                        VARCHAR,
  original_amount_cents         INTEGER NOT NULL DEFAULT 0,
  cancellation_fee_cents        INTEGER NOT NULL DEFAULT 0,
  payment_fee_cents             INTEGER NOT NULL DEFAULT 0,    -- card/processor fee retained
  platform_fee_cents            INTEGER NOT NULL DEFAULT 0,    -- PetWash fee retained
  provider_compensation_cents   INTEGER NOT NULL DEFAULT 0,
  refund_amount_cents           INTEGER NOT NULL DEFAULT 0,
  refund_provider               VARCHAR,                       -- SUMIT | UPAY | NAYAX | WALLET | MANUAL
  external_refund_id            VARCHAR,
  shadow_only                   BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE while AUTO_REFUNDS_ENABLED=false
  status                        VARCHAR NOT NULL DEFAULT 'pending_review',
  -- not_required|pending_review|approved|processing|refunded|partially_refunded|declined|failed
  approved_by                   VARCHAR,
  approved_at                   TIMESTAMP,
  policy_version                VARCHAR,
  accounting_document_id        VARCHAR,
  created_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_refunds_booking ON booking_refunds (booking_id);

-- ── E. booking_price_breakdowns — exact breakdown accepted by the user ─────────
CREATE TABLE IF NOT EXISTS booking_price_breakdowns (
  id                          SERIAL PRIMARY KEY,
  booking_id                  VARCHAR NOT NULL,
  service_amount_cents        INTEGER NOT NULL DEFAULT 0,
  provider_amount_cents       INTEGER NOT NULL DEFAULT 0,
  petwash_platform_fee_cents  INTEGER NOT NULL DEFAULT 0,
  payment_card_fee_cents      INTEGER NOT NULL DEFAULT 0,
  discount_amount_cents       INTEGER NOT NULL DEFAULT 0,
  cancellation_fee_if_late_cents INTEGER NOT NULL DEFAULT 0,  -- shadow "would apply"
  no_show_fee_if_applicable_cents INTEGER NOT NULL DEFAULT 0, -- shadow "would apply"
  vat_amount_cents            INTEGER NOT NULL DEFAULT 0,
  total_amount_cents          INTEGER NOT NULL DEFAULT 0,
  currency                    VARCHAR NOT NULL DEFAULT 'ILS',
  version                     VARCHAR NOT NULL DEFAULT 'v1',
  accepted_by_customer_at     TIMESTAMP,
  accepted_by_provider_at     TIMESTAMP,
  created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_price_breakdowns_booking ON booking_price_breakdowns (booking_id);

-- ── L. booking_status_events — audit log for EVERY status change ───────────────
CREATE TABLE IF NOT EXISTS booking_status_events (
  id            SERIAL PRIMARY KEY,
  booking_id    VARCHAR NOT NULL,
  old_status    VARCHAR,
  new_status    VARCHAR NOT NULL,
  changed_by    VARCHAR,             -- user uid | 'system' | 'admin:<uid>'
  actor_role    VARCHAR,             -- customer | provider | admin | system
  reason        VARCHAR,
  metadata_json JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_status_events_booking ON booking_status_events (booking_id, created_at);

-- 0113: guest eGift orders (public checkout, 2026-08-01)
-- Pending gift-card order between "start" (buyer picks amount) and the SUMIT return
-- (payment verified → voucher issued). Amount is server-owned (no price tampering).
-- Voucher issued ONLY after SUMIT confirms. No card data — SUMIT hosts the payment.
-- Mirrors shared/schema.ts `egiftGuestOrders`. Prefix >88 → auto-applies on push.

CREATE TABLE IF NOT EXISTS egift_guest_orders (
  id                   SERIAL PRIMARY KEY,
  external_id          VARCHAR(128) UNIQUE NOT NULL,
  sender_email         VARCHAR(255) NOT NULL,
  sender_name          VARCHAR(128),
  recipient_email      VARCHAR(255) NOT NULL,
  recipient_name       VARCHAR(128) NOT NULL,
  recipient_phone      VARCHAR(32),
  message              TEXT,
  amount_ils_cents     INTEGER      NOT NULL,
  status               VARCHAR(16)  NOT NULL DEFAULT 'pending',
  voucher_id           VARCHAR(64),
  sumit_transaction_id VARCHAR(128),
  created_at           TIMESTAMP    NOT NULL DEFAULT now(),
  issued_at            TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_egift_guest_external ON egift_guest_orders (external_id);

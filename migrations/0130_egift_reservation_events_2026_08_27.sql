-- 0130: universal eGift stored-value — reservation event vocabulary + per-egift reservation table.
--
-- CEO 2026-08-27 §21-24. Two things land together:
--
--   (a) egift_event_type enum gains RESERVED / RESERVATION_RELEASED /
--       VALUE_RESTORED / PURCHASE_REFUNDED / FROZEN / UNFROZEN / ADJUSTMENT
--       — the append-only vocabulary the CEO named. Enum extension is
--       idempotent (Postgres ADD VALUE IF NOT EXISTS).
--
--   (b) egift_reservations — per-egift reservation ledger. Enables
--       AVAILABLE → RESERVED → COMMITTED/RELEASED atomic transitions so
--       concurrent spends against the SAME eGift can't oversell. The
--       existing walletHolds table is generic + wallet-scoped, not
--       per-egift.
--
-- READ-ONLY at this migration: the tables exist; the money paths are
-- unchanged until CEO clears MARKETPLACE_EGIFT_FISCAL_ACTIVATION (§20).
-- Adding the schema first means no more silent migrations later.

-- ─── (a) Enum extension — idempotent per value ───────────────────────
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'RESERVATION_RELEASED';
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'VALUE_RESTORED';
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'PURCHASE_REFUNDED';
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'FROZEN';
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'UNFROZEN';
ALTER TYPE egift_event_type ADD VALUE IF NOT EXISTS 'ADJUSTMENT';

-- ─── (b) Per-egift reservation table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS egift_reservations (
  id                    SERIAL PRIMARY KEY,
  reservation_id        VARCHAR(64) UNIQUE NOT NULL,
  egift_id              VARCHAR(64) NOT NULL,
  user_id               VARCHAR(255),
  wallet_id             VARCHAR(64),
  amount_cents          INTEGER NOT NULL CHECK (amount_cents > 0),
  currency              VARCHAR(8) NOT NULL DEFAULT 'ILS',
  -- Commercial event this reservation is destined for (SHOP / K9000 /
  -- SITTER / WALK / ACADEMY / PETTREK). Kept as free text so a new
  -- vertical doesn't need a schema migration to land a reservation.
  intended_commercial   VARCHAR(64) NOT NULL,
  intended_source_type  VARCHAR(64),
  intended_source_id    VARCHAR(128),
  -- One of: 'RESERVED' | 'COMMITTED' | 'RELEASED' | 'EXPIRED'.
  status                VARCHAR(24) NOT NULL DEFAULT 'RESERVED',
  reserved_at           TIMESTAMP   NOT NULL DEFAULT now(),
  committed_at          TIMESTAMP,
  released_at           TIMESTAMP,
  expires_at            TIMESTAMP   NOT NULL,
  idempotency_key       VARCHAR(128),
  metadata              JSONB       DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_egift_reservations_egift
  ON egift_reservations (egift_id, status);

CREATE INDEX IF NOT EXISTS idx_egift_reservations_user
  ON egift_reservations (user_id, status);

CREATE INDEX IF NOT EXISTS idx_egift_reservations_expiry
  ON egift_reservations (expires_at)
  WHERE status = 'RESERVED';

-- Idempotency arbiter (partial — nulls allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_egift_reservations_idempotency_key
  ON egift_reservations (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

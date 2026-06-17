-- Service-handoff verification + hash-chained check-in/out ledger (additive).
-- Confirms the right person at a booking handoff and makes check-in/out
-- tamper-evident.

-- One active verification per booking. Code is stored HASHED only (salted SHA-256).
CREATE TABLE IF NOT EXISTS booking_verifications (
  id             SERIAL PRIMARY KEY,
  booking_id     VARCHAR NOT NULL UNIQUE,
  code_hash      VARCHAR NOT NULL,
  code_salt      VARCHAR NOT NULL,
  method         VARCHAR NOT NULL DEFAULT 'code',   -- code | last4_mobile | manual_admin
  target_user_id VARCHAR,                            -- who must present the code
  expires_at     TIMESTAMPTZ NOT NULL,
  verified       BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at    TIMESTAMPTZ,
  attempts       INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hash-chained check-in/out ledger ("blockchain-style": each hash includes the
-- previous one, so editing a past row breaks the chain).
CREATE TABLE IF NOT EXISTS service_checkin_events (
  id                  SERIAL PRIMARY KEY,
  event_id            VARCHAR NOT NULL UNIQUE,
  booking_id          VARCHAR NOT NULL,
  event_type          VARCHAR NOT NULL,              -- check_in | check_out
  method              VARCHAR NOT NULL,              -- code | last4_mobile | manual_admin
  actor_id            VARCHAR NOT NULL,
  conduct_ack         BOOLEAN NOT NULL DEFAULT FALSE,
  conduct_ack_version VARCHAR,
  jurisdiction        VARCHAR,                        -- IL | GR | ...
  prev_hash           VARCHAR,
  hash                VARCHAR NOT NULL,
  at                  TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkin_booking ON service_checkin_events(booking_id);

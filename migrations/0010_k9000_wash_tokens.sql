-- Migration: 0010_k9000_wash_tokens
--
-- Adds k9000_wash_tokens — the authoritative, DB-persisted, crash-safe
-- single-use gate for K9000 QR wash tokens.
--
-- One row per QR token.  Nonce is the primary key (matches the nonce
-- embedded in the HMAC-signed QR payload).  The four explicit token states
-- (pending → consumed | expired | failed_compensated) satisfy the
-- K9000 member-redeem spec requirement that token lifecycle must be enforced
-- server-side with an explicit, persistent state machine.
--
-- This complements the existing in-process + Redis nonce blacklist:
--   - Redis provides fast cross-process replay protection
--   - This table provides crash-safe persistence (survives process restart)
--   - Together they form two independent layers — both must pass for a wash
--
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS k9000_wash_tokens (
  nonce             varchar(64)  PRIMARY KEY,
  user_id           varchar(128) NOT NULL,
  pass_serial       varchar(128) NOT NULL,
  kiosk_id          varchar(100),
  redemption_type   varchar(30)  NOT NULL,
  -- pending | consumed | expired | failed_compensated
  status            varchar(30)  NOT NULL DEFAULT 'pending',
  session_id        varchar(128),         -- FK to bay_sessions.id; set on consume
  expires_at        timestamp    NOT NULL,
  generated_at      timestamp    NOT NULL DEFAULT NOW(),
  consumed_at       timestamp,
  compensated_at    timestamp,
  correlation_id    varchar(64)
);

CREATE INDEX IF NOT EXISTS idx_wash_token_user    ON k9000_wash_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_wash_token_status  ON k9000_wash_tokens (status);
CREATE INDEX IF NOT EXISTS idx_wash_token_expires ON k9000_wash_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_wash_token_session ON k9000_wash_tokens (session_id);

COMMENT ON TABLE k9000_wash_tokens IS
  'Persistent single-use gate for K9000 HMAC QR wash tokens. '
  'One row per token; nonce is PK to guarantee atomic INSERT uniqueness. '
  'States: pending → consumed | expired | failed_compensated.';

COMMENT ON COLUMN k9000_wash_tokens.nonce IS
  'UUID nonce from the HMAC-signed QR payload. '
  'Uniqueness enforced at DB level — INSERT conflicts = replay rejected.';

COMMENT ON COLUMN k9000_wash_tokens.status IS
  'pending: generated, not yet scanned. '
  'consumed: machine accepted QR and session started. '
  'expired: TTL elapsed before scan. '
  'failed_compensated: machine never ACKed START_PUMP; credit was auto-restored.';

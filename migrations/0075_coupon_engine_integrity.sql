-- 0075_coupon_engine_integrity.sql
-- Coupon engine integrity + unique-per-user codes (CEO-approved 2026-06-24).
--
-- WHY: CouponService + KioskCouponService use four tables via raw SQL that were
-- never in a migration (coupon_issuances, coupon_validation_attempts,
-- coupon_audit_log, kiosk_coupon_tokens). If a prod DB lacks them, issued
-- coupons + fraud logging fail silently. This makes them first-class, and adds
-- the NEW unique-per-user `code` (un-spreadable: a code belongs to ONE user;
-- sharing it online fails for everyone else). Fully idempotent — safe to run
-- whether the tables already exist in prod or not.

-- ── Per-user issuances (the unique-per-user voucher instances) ────────────────
CREATE TABLE IF NOT EXISTS coupon_issuances (
  id              SERIAL PRIMARY KEY,
  coupon_id       INTEGER NOT NULL REFERENCES coupons(id),
  user_id         VARCHAR NOT NULL,
  issued_by_admin VARCHAR,
  issued_at       TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP,
  redeemed_at     TIMESTAMP,
  redemption_id   INTEGER,
  is_active       BOOLEAN DEFAULT TRUE
);
-- NEW: unique, hard-to-guess, per-user code string (un-spreadable).
ALTER TABLE coupon_issuances ADD COLUMN IF NOT EXISTS code VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_issuances_code
  ON coupon_issuances(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupon_issuances_user ON coupon_issuances(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_issuances_coupon ON coupon_issuances(coupon_id);

-- ── Validation attempts (abuse gate + fraud log) ─────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_validation_attempts (
  id                 SERIAL PRIMARY KEY,
  user_id            VARCHAR,
  ip_address         VARCHAR(64),
  device_fingerprint VARCHAR(120),
  code_attempted     VARCHAR(60),
  result             VARCHAR(20) NOT NULL,   -- valid | invalid | blocked
  error_code         VARCHAR(60),
  attempted_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cva_user_time ON coupon_validation_attempts(user_id, attempted_at);
CREATE INDEX IF NOT EXISTS idx_cva_ip_time   ON coupon_validation_attempts(ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_cva_code_time ON coupon_validation_attempts(code_attempted, attempted_at);
CREATE INDEX IF NOT EXISTS idx_cva_result    ON coupon_validation_attempts(result, attempted_at);

-- ── Admin audit log (who created/changed/issued/deactivated) ─────────────────
CREATE TABLE IF NOT EXISTS coupon_audit_log (
  id            SERIAL PRIMARY KEY,
  coupon_id     INTEGER,
  admin_user_id VARCHAR NOT NULL,
  action        VARCHAR(60) NOT NULL,
  details       JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coupon_audit_coupon ON coupon_audit_log(coupon_id, created_at);

-- ── Kiosk short-lived pre-validated tokens ───────────────────────────────────
CREATE TABLE IF NOT EXISTS kiosk_coupon_tokens (
  id                   SERIAL PRIMARY KEY,
  token                VARCHAR(120) NOT NULL,
  coupon_id            INTEGER NOT NULL,
  issuance_id          INTEGER,
  user_id              VARCHAR NOT NULL,
  station_id           VARCHAR(60),
  bay_id               VARCHAR(60),
  discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  gross_amount_cents   INTEGER NOT NULL DEFAULT 0,
  expires_at           TIMESTAMP NOT NULL,
  idempotency_key      VARCHAR(128),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled
  created_at           TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kiosk_coupon_tokens_token ON kiosk_coupon_tokens(token);

-- ── coupon_redemptions: columns the code already writes via raw SQL ──────────
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS cancelled_at     TIMESTAMP;
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS cancel_reason    TEXT;
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS idempotency_key  VARCHAR(128);
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS ledger_entry_id  VARCHAR(120);
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS issuance_id      INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_redemptions_idempotency
  ON coupon_redemptions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ── coupons: campaign_type used via raw SQL (campaign | issued) ──────────────
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS coupon_type VARCHAR(20) DEFAULT 'campaign';

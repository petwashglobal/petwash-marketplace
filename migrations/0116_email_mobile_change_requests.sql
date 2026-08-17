-- PR-AUTH-SECURITY-9 §§6-7 — Email + Mobile change verification queues
-- Additive: two independent request tables holding short-lived tokens for the
-- verify step of an email or mobile change. Neither table stores plaintext
-- OTP or raw token — only a SHA-256 hash. Rows expire quickly (TTL ≤ 30 min
-- on the app side) and the app hard-deletes on consume; a cron/expiry sweep
-- can also purge by expires_at.
--
-- Idempotent: uses IF NOT EXISTS so re-running the migration is safe.
-- No column added to users — the atomic email/phone flip lands via UPDATE
-- on the existing users columns (users.email, users.email_verified,
-- users.phone_e164, users.phone_verified) plus a Firebase Admin updateUser
-- call inside the same server transaction.

CREATE TABLE IF NOT EXISTS email_change_requests (
  id           serial PRIMARY KEY,
  user_id      varchar(128) NOT NULL,
  new_email    varchar(320) NOT NULL,      -- normalized lowercase
  token_hash   varchar(64)  NOT NULL,      -- sha256 hex of the link token
  expires_at   timestamptz  NOT NULL,
  consumed_at  timestamptz,                -- NULL until verified; set on confirm
  request_ip   varchar(64),
  request_ua   text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_change_requests_user  ON email_change_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_change_requests_token ON email_change_requests (token_hash);
CREATE INDEX IF NOT EXISTS idx_email_change_requests_exp   ON email_change_requests (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS mobile_change_requests (
  id                serial PRIMARY KEY,
  user_id           varchar(128) NOT NULL,
  new_mobile_e164   varchar(20)  NOT NULL, -- server-canonicalized E.164
  otp_hash          varchar(64)  NOT NULL, -- sha256 hex of the 6-digit OTP
  attempts          integer      NOT NULL DEFAULT 0,
  expires_at        timestamptz  NOT NULL,
  consumed_at       timestamptz,
  request_ip        varchar(64),
  request_ua        text,
  created_at        timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mobile_change_requests_user ON mobile_change_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_change_requests_exp  ON mobile_change_requests (expires_at) WHERE consumed_at IS NULL;

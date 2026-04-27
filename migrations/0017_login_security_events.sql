-- Migration: login_security_events table
-- New-login alert & recent-login security system for Pet Wash™
-- Privacy-safe: stores only masked IP, hashes, and approximate location

DO $$ BEGIN
  CREATE TYPE login_security_event_type AS ENUM (
    'login_success',
    'new_device_login',
    'new_browser_login',
    'new_location_login',
    'high_risk_login'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "login_security_events" (
  "id"               serial PRIMARY KEY,
  "user_id"          varchar(128)                    NOT NULL,
  "email"            varchar(255),
  "event_type"       login_security_event_type       NOT NULL DEFAULT 'login_success',
  -- IP stored as masked (last octet replaced with 'xxx') — never store raw
  "masked_ip"        varchar(64),
  -- HMAC-SHA256 hash of raw IP + per-user salt — used for device/location comparison
  "ip_hash"          varchar(64),
  "country"          varchar(100),
  "city"             varchar(100),
  "device"           varchar(100),
  "browser"          varchar(100),
  "os"               varchar(100),
  -- SHA-256 hash of raw user-agent string — NOT the raw string
  "user_agent_hash"  varchar(64),
  "risk_score"       integer                         NOT NULL DEFAULT 0,
  "risk_flags"       jsonb                           NOT NULL DEFAULT '[]'::jsonb,
  "is_new_device"    boolean                         NOT NULL DEFAULT false,
  "is_new_browser"   boolean                         NOT NULL DEFAULT false,
  "is_new_location"  boolean                         NOT NULL DEFAULT false,
  "is_high_risk_ip"  boolean                         NOT NULL DEFAULT false,
  "created_at"       timestamp                       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_login_sec_events_user"
  ON "login_security_events" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_login_sec_events_user_created"
  ON "login_security_events" ("user_id", "created_at");

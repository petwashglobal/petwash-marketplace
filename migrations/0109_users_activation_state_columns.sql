-- 0109 — users activation state-machine columns (drift repair).
--
-- These columns are defined in shared/schema.ts (the ACTIVATION STATE MACHINE
-- block) and ARE present in production today — but they reached prod via
-- `drizzle-kit push`, never as a committed .sql migration. So a DB rebuilt from
-- migrations alone would be missing them and EVERY new signup would fail to
-- activate (markMobileVerified / markEmailVerified / computeStatus write these).
--
-- This migration makes the schema reproducible. Every statement is
-- ADD COLUMN IF NOT EXISTS → a safe no-op against the current prod DB, and the
-- source of truth for a fresh environment. Additive only; no data change.
-- (2026-07-31)

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "activation_status"            varchar(30) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "mobile_verified_at"           timestamp,
  ADD COLUMN IF NOT EXISTS "email_verified_at"            timestamp,
  ADD COLUMN IF NOT EXISTS "account_activated_at"         timestamp,
  ADD COLUMN IF NOT EXISTS "accepted_terms_at"            timestamp,
  ADD COLUMN IF NOT EXISTS "last_activation_email_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "activation_version"           integer NOT NULL DEFAULT 1;

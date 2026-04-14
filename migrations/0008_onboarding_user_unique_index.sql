-- Migration: onboarding_cases unique index
-- Commit f79b75a1 added idx_onboarding_user_unique to shared/schema.ts to fix
-- the SELECT-then-INSERT race in complete-registration.ts.
-- This migration applies the constraint to the live database.
--
-- Run command (production):
--   psql $DATABASE_URL -f migrations/0008_onboarding_user_unique_index.sql
-- Or via drizzle-kit:
--   npx drizzle-kit push
--
-- Safe to re-run: IF NOT EXISTS guards prevent duplicate errors.

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_user_unique
  ON onboarding_cases (user_id);

-- Migration: 0022_provider_service_areas_city_symbol
--
-- PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1)
-- Constitutional reference:
--   docs/location/PRIVACY.md §3 (T0 inventory — provider
--                                service area is publicly
--                                visible)
--   docs/location/PRIVACY.md §4 (T0 access matrix — public)
--   docs/location/PROGRAM.md  §3.7 (provider service-area
--                                   citySymbol coverage)
--
-- Why this exists
-- ───────────────
-- Today provider service-area selection is free-text city
-- strings across five tables:
--   • contractor_service_areas.city     (varchar)
--   • walker_profiles.city               (varchar NOT NULL)
--   • sitter_profiles.city               (varchar NOT NULL)
--   • trainers.service_area              (text, comma-list)
--   • drivers.areas_of_service           (text — DEFERRED)
--
-- This migration adds canonical citySymbol-backed columns
-- alongside the legacy columns. The new columns are
-- populated in a separate backfill PR (Phase 2) and become
-- the authoritative read source in Phase 4.
--
-- Phase 1 (this migration) is fully ADDITIVE:
--   • Every new column is NULLABLE (or has a safe default).
--   • Every existing column is UNTOUCHED.
--   • Every existing INSERT / UPDATE keeps working.
--   • Every existing read path keeps working.
--   • Mobile API responses are byte-identical pre vs post.
--
-- Idempotent: every column + index uses IF NOT EXISTS so
-- this migration is safe to re-run.
--
-- NOT in this migration
-- ─────────────────────
--   • No backfill           — separate PR (Phase 2)
--   • No UI change           — separate PR (Phase 3)
--   • No read switch         — separate PR (Phase 4)
--   • No legacy DROP COLUMN  — separate PR (Phase 5)
--   • No drivers.areas_of_service — deferred (PetTrek
--                                   dispatch is lat/lng-based;
--                                   drivers do not need
--                                   symbols yet)
--
-- Rollback
-- ────────
-- The DROP statements at the bottom of this file (commented
-- out) are the safe reverse. To revert this migration:
--   1. Confirm Phase-2 backfill has NOT run.
--   2. Confirm no UI writes the new columns yet.
--   3. Run the four DROP INDEX + four ALTER TABLE DROP
--      COLUMN statements (or `drizzle-kit migration:down`).

-- ────────────────────────────────────────────────────────
-- 1. contractor_service_areas — add city_symbol + index
-- ────────────────────────────────────────────────────────

ALTER TABLE contractor_service_areas
  ADD COLUMN IF NOT EXISTS city_symbol varchar(20);

CREATE INDEX IF NOT EXISTS idx_contractor_areas_city_symbol
  ON contractor_service_areas (city_symbol);

-- ────────────────────────────────────────────────────────
-- 2. walker_profiles — add city_symbol + index
-- ────────────────────────────────────────────────────────

ALTER TABLE walker_profiles
  ADD COLUMN IF NOT EXISTS city_symbol varchar(20);

CREATE INDEX IF NOT EXISTS idx_walker_profiles_city_symbol
  ON walker_profiles (city_symbol);

-- ────────────────────────────────────────────────────────
-- 3. sitter_profiles — add city_symbol + index
-- ────────────────────────────────────────────────────────

ALTER TABLE sitter_profiles
  ADD COLUMN IF NOT EXISTS city_symbol varchar(20);

CREATE INDEX IF NOT EXISTS idx_sitter_profiles_city_symbol
  ON sitter_profiles (city_symbol);

-- ────────────────────────────────────────────────────────
-- 4. trainers — add service_city_symbols TEXT[] + GIN index
-- ────────────────────────────────────────────────────────
--
-- Trainers cover multiple cities. The free-text service_area
-- string today is a Hebrew-comma / English-comma list. The
-- new TEXT[] column preserves that semantic natively and
-- supports O(1) containment queries via the GIN index.

ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS service_city_symbols text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE INDEX IF NOT EXISTS idx_trainers_service_city_symbols
  ON trainers USING GIN (service_city_symbols);

-- ────────────────────────────────────────────────────────
-- ROLLBACK (commented — for reference only)
-- ────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS idx_trainers_service_city_symbols;
-- DROP INDEX IF EXISTS idx_sitter_profiles_city_symbol;
-- DROP INDEX IF EXISTS idx_walker_profiles_city_symbol;
-- DROP INDEX IF EXISTS idx_contractor_areas_city_symbol;
-- ALTER TABLE trainers
--   DROP COLUMN IF EXISTS service_city_symbols;
-- ALTER TABLE sitter_profiles
--   DROP COLUMN IF EXISTS city_symbol;
-- ALTER TABLE walker_profiles
--   DROP COLUMN IF EXISTS city_symbol;
-- ALTER TABLE contractor_service_areas
--   DROP COLUMN IF EXISTS city_symbol;

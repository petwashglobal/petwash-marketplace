-- 0074_pets_country_of_birth.sql
--
-- Adds pets.country_of_birth (shared/schema.ts) so a pet's birth country can be
-- recorded — useful for import/relocation readiness (e.g. a dog born in Australia
-- that may later move to Israel). Additive, nullable, idempotent; cannot break
-- the deploy. CI applies numbered migrations (--lenient), not drizzle-kit push,
-- so a code-only column would otherwise 42703 in production.

ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "country_of_birth" varchar;

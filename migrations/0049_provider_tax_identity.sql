-- 0049_provider_tax_identity.sql
-- Wolt-style provider code + Israeli tax identity for the providers table.
--
-- WHY: a provider was identified only by a raw serial id. This adds (1) a
-- human-readable operational code (PW-PRV-<year>-<5-digit id>, like Wolt's
-- courier ID / our K9000 station codes — NOT a legal identifier), and (2)
-- the legally load-bearing fields needed to lawfully PAY a provider in
-- Israel: osek (business-tax) number + type, Bituach Leumi status, and bank
-- details with an ownership-confirmed flag (verify-before-pay, Wolt pattern).
--
-- Additive only — all columns nullable (bank_ownership_confirmed defaults
-- false), safe on existing rows. provider_code is NULL until assigned; the
-- partial-unique index permits many NULLs and rejects duplicate codes.

ALTER TABLE "providers"
  ADD COLUMN IF NOT EXISTS "provider_code" varchar(32),
  ADD COLUMN IF NOT EXISTS "osek_number" varchar(20),
  ADD COLUMN IF NOT EXISTS "osek_type" varchar(12),
  ADD COLUMN IF NOT EXISTS "bituach_leumi_status" varchar(20),
  ADD COLUMN IF NOT EXISTS "bank_account" jsonb,
  ADD COLUMN IF NOT EXISTS "bank_ownership_confirmed" boolean DEFAULT false;

-- Unique provider_code. Postgres allows multiple NULLs under a unique index,
-- so unassigned providers don't collide; once assigned, codes are unique.
CREATE UNIQUE INDEX IF NOT EXISTS "providers_provider_code_unique"
  ON "providers" ("provider_code");

-- Migration: 0019_provider_self_declaration
-- Israel-safe provider self-declaration (2026 spec).
--
-- Adds five columns to provider_applications so the new self-declaration
-- + enhanced-verification policy can be persisted alongside the existing
-- KYC + police-check flow. All columns are nullable or have defaults so
-- this migration is safe to run on populated tables (no backfill needed).
--
-- Policy summary:
--   • ID upload — already enforced by existing schema (government_id_url).
--   • Police clearance — OPTIONAL by default; REQUIRED when
--     requires_enhanced_verification = true.
--   • Self-declaration checkbox — REQUIRED for every provider; the route
--     rejects /apply submissions where this is false.

ALTER TABLE provider_applications
  ADD COLUMN IF NOT EXISTS self_declaration_no_relevant_convictions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_declaration_at timestamp,
  ADD COLUMN IF NOT EXISTS self_declaration_ip varchar(64),
  ADD COLUMN IF NOT EXISTS requires_enhanced_verification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enhanced_verification_reasons text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Index for admin-side filtering: "show me providers awaiting enhanced
-- verification". Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_provider_applications_enhanced
  ON provider_applications (requires_enhanced_verification)
  WHERE requires_enhanced_verification = true;

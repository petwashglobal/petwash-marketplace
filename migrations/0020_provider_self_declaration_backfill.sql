-- Migration: 0020_provider_self_declaration_backfill
--
-- One-time grandfather backfill for providers approved BEFORE the new
-- Israel-safe self-declaration policy introduced in migration 0019.
--
-- WHY THIS EXISTS
-- ───────────────
-- Migration 0019 added the column
--   self_declaration_no_relevant_convictions  bool not null default false
-- to provider_applications. Without this backfill, any NEW approval
-- action (e.g. re-approval after a hold, or a checklist edit that
-- triggers approveApplication() again) on legacy applications would be
-- REJECTED by the new conditional gate in
-- server/services/AdminProviderReviewService.ts.
--
-- Operationally that would mean: a provider who has been working on the
-- platform for months would suddenly be unable to be re-activated by
-- support, even though they were vetted under the previous policy.
--
-- This migration treats those rows as grandfathered.
--
-- SCOPE (deliberately narrow)
-- ───────────────────────────
--   Updates ONLY rows in provider_applications where:
--     status = 'approved'           ← already approved under old policy
--     AND self_declaration_at IS NULL  ← never signed under new policy
--
--   Rows in any other status (draft, pending, pending_review,
--   under_review, rejected, withdrawn) are NOT touched. Those providers
--   must sign the new declaration through the /apply form.
--
-- AUDIT MARKER
-- ────────────
-- self_declaration_ip is set to a sentinel string so the compliance team
-- can distinguish grandfathered rows from real user-signed rows when
-- auditing later. Real signatures store an actual IPv4/IPv6 address.
--
-- IDEMPOTENT
-- ──────────
-- The IS NULL guard means re-running this migration cannot overwrite a
-- real signature collected after the backfill ran. Safe to re-apply.
--
-- ROLLBACK
-- ────────
-- If you need to roll back the grandfather grant (e.g. policy team wants
-- everyone to actually sign), run:
--
--   UPDATE provider_applications
--      SET self_declaration_no_relevant_convictions = false,
--          self_declaration_at = NULL,
--          self_declaration_ip = NULL
--    WHERE self_declaration_ip = 'GRANDFATHERED-2026-MIGRATION-0020';
--
-- This will force every grandfathered provider to re-sign on next
-- approval action.

UPDATE provider_applications
SET
  self_declaration_no_relevant_convictions = true,
  self_declaration_at = NOW(),
  self_declaration_ip = 'GRANDFATHERED-2026-MIGRATION-0020'
WHERE status = 'approved'
  AND self_declaration_at IS NULL;

-- Note: requires_enhanced_verification is intentionally NOT set here.
-- Legacy rows keep the column default (false). If a grandfathered
-- provider is later re-evaluated and turns out to offer high-risk
-- services, an admin (or a follow-up backfill) can flip the flag and
-- the new gate will require a police check before re-approval.

-- =====================================================================
-- Migration 0136 · Phase 5 · users.last_active_role default column
-- Date: 2026-09-01
-- Owner: auth-rebuild (CEO directive 2026-09-01, D5)
--
-- Purpose: give a returning user a default `activeRole` on first session
-- of a new device — restoring which authorised hat they were last
-- wearing, without forcing them through /mode again.
--
-- Per CEO D5:
--   - Neither `sessions.active_role` nor `users.last_active_role` grants
--     authority. Authority is always the capabilities aggregator.
--   - Do NOT blindly migrate `last_active_role = users.role`. If the
--     legacy scalar is stale, invalid, or unauthorised, leave NULL and
--     let the fresh-session flow choose a safe default. This migration
--     leaves the column NULL for every existing row — the Phase 5
--     runtime code populates it lazily on first authenticated login
--     under the new flag.
--
-- ADDITIVE ONLY. Nullable. No default. No writer today.
-- =====================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_role varchar(30);

-- No index needed — read is always by users.id (already PK). This
-- column is a single scalar restored on session mint.

-- =====================================================================
-- Rollback:
--   ALTER TABLE users DROP COLUMN last_active_role;
-- Safe: no writer today.
-- =====================================================================

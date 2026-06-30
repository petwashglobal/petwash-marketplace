-- 0085_payout_double_payout_guard.sql
-- Double-payout protection for super_app_payouts.
--
-- Adds a nullable dedupe key `payout:{bookingId}:{providerId}` plus a UNIQUE index.
-- Postgres treats NULLs as distinct in a unique index, so existing rows (all NULL on
-- the new column) never collide and the migration is safe to apply on live data with
-- no backfill required. Going forward, the payout creation paths set the key only when
-- a bookingId exists; a second insert for the same booking+provider collides and is
-- skipped at the application layer (onConflictDoNothing) — no money is paid twice.
--
-- Additive + reversible. No money math changed.

ALTER TABLE super_app_payouts
  ADD COLUMN IF NOT EXISTS idempotency_key varchar;

CREATE UNIQUE INDEX IF NOT EXISTS super_app_payout_idem_unique
  ON super_app_payouts (idempotency_key);

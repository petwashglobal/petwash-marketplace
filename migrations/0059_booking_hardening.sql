-- Migration: 0059_booking_hardening
--
-- ⚠️ CEO-AUTHORIZED schema migration (booking-hardening 2026-06-20).
--
-- Three additive, fail-safe hardening changes. NO pricing or payment-amount
-- columns are touched. Every statement is idempotent (IF NOT EXISTS / guarded
-- DO block) so re-running is harmless, and a code deploy that lands BEFORE this
-- migration keeps working because every new column is NULLABLE and every new
-- write is best-effort.
--
--   1. walk_slot_holds: UNIQUE (walker_id, slot_id)
--      Makes walk slot-hold acquisition atomic. The route switches to
--      INSERT ... ON CONFLICT DO NOTHING; "no row inserted" == slot already
--      taken (409). Removes the read-check-insert race between two concurrent
--      walk bookings for the same slot.
--
--   2. booking_requests.booking_fingerprint + partial UNIQUE
--      Idempotency key for the POST /api/booking-requests create path.
--      Double-tap / network-retry returns the EXISTING booking instead of
--      creating a duplicate. Partial unique (WHERE NOT NULL) so legacy/edge
--      inserts without a key still succeed.
--
--   3. service_source legal source tag on sitter_bookings / walk_bookings /
--      trainer_bookings. Lets legal/audit prove which PetWash platform each
--      booking row came from. Nullable; populated best-effort on creation.

-- ── 1. walk_slot_holds atomic slot lock ──────────────────────────────────────
-- A partial-free plain UNIQUE is correct here: every hold row has a non-null
-- (walker_id, slot_id). Lazy-expiry purge in the route deletes stale rows
-- before each insert so an expired hold never permanently poisons a slot.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'wsh_walker_slot_uniq'
  ) THEN
    -- Defensive: drop any duplicate (walker_id, slot_id) rows that predate the
    -- constraint, keeping the most recently-created hold per slot. Without this
    -- the CREATE UNIQUE INDEX could fail on legacy data.
    DELETE FROM walk_slot_holds a
    USING walk_slot_holds b
    WHERE a.walker_id = b.walker_id
      AND a.slot_id   = b.slot_id
      AND a.id < b.id;

    CREATE UNIQUE INDEX wsh_walker_slot_uniq
      ON walk_slot_holds (walker_id, slot_id);
  END IF;
END$$;

-- ── 2. booking_requests idempotency fingerprint ──────────────────────────────
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS booking_fingerprint varchar(200);

-- Partial unique index: only enforced when a fingerprint is present, so NULL
-- (legacy / un-keyed) inserts are never blocked.
CREATE UNIQUE INDEX IF NOT EXISTS br_booking_fingerprint_uniq
  ON booking_requests (booking_fingerprint)
  WHERE booking_fingerprint IS NOT NULL;

-- ── 3. service_source legal source tags ──────────────────────────────────────
ALTER TABLE sitter_bookings
  ADD COLUMN IF NOT EXISTS service_source varchar(40);
ALTER TABLE walk_bookings
  ADD COLUMN IF NOT EXISTS service_source varchar(40);
ALTER TABLE trainer_bookings
  ADD COLUMN IF NOT EXISTS service_source varchar(40);

-- ROLLBACK (commented — for reference only)
-- DROP INDEX IF EXISTS wsh_walker_slot_uniq;
-- DROP INDEX IF EXISTS br_booking_fingerprint_uniq;
-- ALTER TABLE booking_requests DROP COLUMN IF EXISTS booking_fingerprint;
-- ALTER TABLE sitter_bookings  DROP COLUMN IF EXISTS service_source;
-- ALTER TABLE walk_bookings    DROP COLUMN IF EXISTS service_source;
-- ALTER TABLE trainer_bookings DROP COLUMN IF EXISTS service_source;

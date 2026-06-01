-- Migration: 0028_marketplace_booking_slot_locks
--
-- Closes the still-open critical from the hostile audit:
--   "No atomic slot lock for Sitter Suite / Walk My Pet bookings —
--    two customers can book the same provider at the same minute."
--
-- Implementation: a dedicated lock table with a Postgres EXCLUDE
-- constraint that makes any overlapping (provider_id, time-range) insert
-- fail at the DB level. No race condition possible. The booking-requests
-- route acquires a lock inside the same transaction as the booking insert
-- and rolls both back if the lock fails.
--
-- Fully ADDITIVE: new table only. No existing column or constraint
-- touched. Idempotent (IF NOT EXISTS).

-- The btree_gist extension is required for EXCLUDE constraints that
-- combine equality (=) on btree-indexable columns with range overlap
-- (&&). Most Postgres distributions ship with btree_gist available.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS marketplace_booking_slot_locks (
  id              serial PRIMARY KEY,
  -- Provider ID is text not integer because the marketplace booking
  -- tables already use string provider ids (Firebase uid or similar).
  provider_id     text NOT NULL,
  -- Inclusive start, EXCLUSIVE end — i.e. a booking from 10:00 to 11:00
  -- does NOT conflict with one from 11:00 to 12:00. Half-open ranges are
  -- the canonical way to represent contiguous time slots.
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  -- The booking row this lock belongs to. Stored as text to accommodate
  -- both numeric ids and string request_ids (e.g. 'br_abc123').
  booking_ref     text NOT NULL,
  -- The marketplace surface (sitter, walker, groomer, etc.) — useful
  -- for diagnostics + per-surface metrics. Not used in the exclusion
  -- check.
  service_type    varchar(40) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Sanity: end must be strictly after start.
  CONSTRAINT start_before_end CHECK (start_at < end_at)
);

-- The heart of the fix. EXCLUDE prevents any two rows where:
--   * provider_id is the same (= equality, btree-indexable via btree_gist)
--   * AND the [start_at, end_at) ranges overlap (&& on tstzrange)
-- A second concurrent INSERT that would create an overlap fails with
-- "conflicting key value violates exclusion constraint" — no race window.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_booking_slot_locks_no_overlap'
  ) THEN
    ALTER TABLE marketplace_booking_slot_locks
      ADD CONSTRAINT marketplace_booking_slot_locks_no_overlap
      EXCLUDE USING gist (
        provider_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      );
  END IF;
END$$;

-- Lookups: "show me all current locks for provider X" + "find lock by
-- booking_ref" (for unlock on cancellation).
CREATE INDEX IF NOT EXISTS idx_marketplace_slot_locks_provider
  ON marketplace_booking_slot_locks (provider_id, start_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_slot_locks_booking_ref
  ON marketplace_booking_slot_locks (booking_ref);

-- ROLLBACK (commented — for reference only)
-- DROP INDEX IF EXISTS idx_marketplace_slot_locks_booking_ref;
-- DROP INDEX IF EXISTS idx_marketplace_slot_locks_provider;
-- ALTER TABLE marketplace_booking_slot_locks DROP CONSTRAINT IF EXISTS marketplace_booking_slot_locks_no_overlap;
-- DROP TABLE IF EXISTS marketplace_booking_slot_locks;
-- The btree_gist extension is left in place — it may be used by other
-- features and dropping it would require a separate decision.

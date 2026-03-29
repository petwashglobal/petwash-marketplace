-- Migration: DB-level exclusion constraint for provider slot overlap prevention
-- Date: 2026-03-29
-- Purpose: Close the concurrency race window in provider slot creation.
--          Application-level check (SELECT COUNT + INSERT) cannot prevent two
--          simultaneous requests from both passing the check before either commits.
--          This constraint enforces uniqueness at the database level using a GIST
--          index on (provider_id, tsrange(start_time, end_time)).
--          Cancelled slots are excluded so they never block new bookings.

-- Step 1: Enable btree_gist extension
-- Required for combining integer equality (provider_id WITH =)
-- with range overlap (tsrange WITH &&) in a single GIST index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Add the exclusion constraint
-- Two rows conflict when: same provider_id AND time ranges overlap
-- '[)' = half-open interval [start, end) — end time is exclusive
-- WHERE (status != 'cancelled') = partial constraint; cancelled slots are ignored
ALTER TABLE availability_slots
ADD CONSTRAINT availability_slots_no_overlap
EXCLUDE USING GIST (
  provider_id WITH =,
  tsrange(start_time, end_time, '[)') WITH &&
) WHERE (status != 'cancelled');

-- Violation behaviour: PostgreSQL raises SQLSTATE 23P01 (exclusion_violation).
-- The route catch block handles this and returns HTTP 409 with the same
-- "Time conflict" message as the application-level check.

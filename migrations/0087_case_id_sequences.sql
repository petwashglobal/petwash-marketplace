-- 0087_case_id_sequences.sql
-- Atomic per-day, per-category counters for human-readable case IDs.
--
-- Replaces the incident engine's opaque `inc_${nanoid(16)}` IDs with
-- CATEGORY-YYYYMMDD-###### (e.g. CARE-20260701-000044), matching the
-- readable, date-visible, category-visible format the CEO's payment-
-- confirmation spec asked for (BOOK-/PAY-/CARE-), generalized across the
-- incident engine's full type taxonomy (pet/property/home/care/station/trust)
-- since that's the one real, already-wired case-generation system in the repo.
--
-- One row per (date, category); `next_seq` is incremented atomically via
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING, so concurrent case opens on
-- the same day/category never collide.
--
-- Additive + reversible. No money math changed. Does not alter incidentId's
-- column type (still varchar) so no existing incident-lookup code needs to
-- change.

CREATE TABLE IF NOT EXISTS case_id_sequences (
  case_date   varchar(8) NOT NULL,   -- YYYYMMDD
  category    varchar(16) NOT NULL,  -- e.g. PET, PROP, HOME, CARE, STATION, PAY, TRUST, CASE
  next_seq    integer NOT NULL DEFAULT 1,
  updated_at  timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (case_date, category)
);

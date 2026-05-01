-- Migration: 0021_booking_requests_address_snapshot
--
-- Phase B6 — store the customer's address on the booking row at create
-- time so the booking has a permanent, immutable record of WHERE the
-- service was requested. Decouples the booking record from the
-- customer's mutable profile address.
--
-- Why this exists
-- ───────────────
-- Today every booking matches against the customer's CURRENT lat/lng
-- (from the user profile or the search filter). If the customer moves
-- after booking, the booking row no longer knows where it was for —
-- audits, dispute resolution, tax invoices, and chargebacks lose the
-- "where" forever.
--
-- This migration adds an address SNAPSHOT to booking_requests: the
-- customer's address at the moment of booking, frozen.
--
-- Scope
-- ─────
-- All columns are NULLABLE — legacy bookings created before this
-- migration cannot be backfilled (we don't know where they were).
-- New bookings populated by the route handler (commit B6.2) will
-- always include the snapshot when the customer provides an address.
--
-- Idempotent: every column uses IF NOT EXISTS, so this migration is
-- safe to re-run.

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS customer_address          text,
  ADD COLUMN IF NOT EXISTS customer_street           varchar(200),
  ADD COLUMN IF NOT EXISTS customer_street_number    varchar(40),
  ADD COLUMN IF NOT EXISTS customer_apartment        varchar(80),
  ADD COLUMN IF NOT EXISTS customer_city             varchar(120),
  ADD COLUMN IF NOT EXISTS customer_city_key         varchar(60),
  ADD COLUMN IF NOT EXISTS customer_country          char(2),
  ADD COLUMN IF NOT EXISTS customer_postal_code      varchar(16),
  ADD COLUMN IF NOT EXISTS customer_latitude         decimal(10, 7),
  ADD COLUMN IF NOT EXISTS customer_longitude        decimal(10, 7),
  ADD COLUMN IF NOT EXISTS customer_place_id         varchar(200);

-- Indexes
--   1. customer_city_key — admin filtering "all bookings in Ramat Gan"
--      regardless of whether the customer typed Hebrew or English.
--   2. customer_latitude/longitude composite — future bbox queries.
-- Both are partial (only index rows that have the column populated)
-- to keep the index small until the column is the norm.

CREATE INDEX IF NOT EXISTS idx_booking_requests_customer_city_key
  ON booking_requests (customer_city_key)
  WHERE customer_city_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_requests_customer_latlng
  ON booking_requests (customer_latitude, customer_longitude)
  WHERE customer_latitude IS NOT NULL AND customer_longitude IS NOT NULL;

-- No backfill of historical rows. Auditors querying by city_key on
-- pre-migration bookings will get empty results — that's correct,
-- because we have no truthful answer for those bookings.

-- Migration: 0013_walk_bookings_payment_session_id
-- Adds the payment_session_id column to walk_bookings so that the Nayax webhook
-- can link a payment session back to the booking it created.
-- This unblocks GET /api/walks/by-payment/:sessionId from returning a real booking.

ALTER TABLE walk_bookings
  ADD COLUMN IF NOT EXISTS payment_session_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_walk_bookings_payment_session
  ON walk_bookings (payment_session_id)
  WHERE payment_session_id IS NOT NULL;

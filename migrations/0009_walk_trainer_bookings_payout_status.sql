-- Migration 0009: Add payout_status column to walk_bookings and trainer_bookings
-- Lifecycle: pending (pre-completion) → pending_transfer (completed, queued for release) → paid_out | failed
-- pending_transfer: walk/session has been completed; payout is queued for manual release
-- until the Nayax bank-transfer integration is live.

ALTER TABLE walk_bookings
  ADD COLUMN IF NOT EXISTS payout_status VARCHAR(32) NOT NULL DEFAULT 'pending';

ALTER TABLE trainer_bookings
  ADD COLUMN IF NOT EXISTS payout_status VARCHAR(32) NOT NULL DEFAULT 'pending';

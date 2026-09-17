-- 2026-09-18: the sitter's OWN tax invoice to the customer.
--
-- Migration 0159 gave booking_requests and walk_bookings a place to record the
-- provider's invoice number, because under the gross model (#2496) the provider
-- is the legal seller and Pet Wash approves no payout until that invoice
-- exists. sitter_bookings was missed — sitter stays live in their own table —
-- so sitters were held to a different standard from walkers and trainers.
--
-- Plain statements only: scripts/apply-pending-migrations.ts splits on ';'.

ALTER TABLE sitter_bookings ADD COLUMN IF NOT EXISTS provider_invoice_number VARCHAR(64);
ALTER TABLE sitter_bookings ADD COLUMN IF NOT EXISTS provider_invoice_submitted_at TIMESTAMPTZ;

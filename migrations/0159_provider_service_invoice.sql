-- 2026-09-14 — MARKETPLACE GROSS MODEL (docs/finance/00-platform-role-model.md §0.6.2.b).
-- The provider is the legal seller and issues their OWN tax invoice / receipt to
-- the customer for the service. Pet Wash records that document's number; a
-- provider payout is not offered for approval until it is recorded.
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS provider_invoice_number VARCHAR(64);
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS provider_invoice_submitted_at TIMESTAMP;
ALTER TABLE walk_bookings    ADD COLUMN IF NOT EXISTS provider_invoice_number VARCHAR(64);
ALTER TABLE walk_bookings    ADD COLUMN IF NOT EXISTS provider_invoice_submitted_at TIMESTAMP;

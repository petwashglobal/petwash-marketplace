-- 0108_booking_meetgreet_enum_and_address_access.sql  (2026-07-30, T4/T5)
--
-- 1. 'meet_greet_requested' was written by POST /:requestId/meet-greet and
--    known to the shared state machine, but NEVER added to the pg enum — the
--    write throws "invalid input value for enum" in prod, so every customer
--    meet-&-greet request 500s. Additive, PG12+ allows in-transaction.
ALTER TYPE booking_request_status ADD VALUE IF NOT EXISTS 'meet_greet_requested';

-- 2. Access fields for the frozen customer-address snapshot on the booking
--    row. shared/formatAddress.bookingSnapshotToAddress already reads
--    customer_floor / customer_entrance / customer_address_notes (reminders,
--    receipts, courier view) — the columns never existed, so provider
--    reminders could not show floor/entrance/gate-code even when the customer
--    saved them in user_addresses (0107).
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS customer_floor varchar(30);
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS customer_entrance varchar(30);
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS customer_address_notes text;

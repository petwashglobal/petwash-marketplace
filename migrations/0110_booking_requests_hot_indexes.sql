-- 0110: booking_requests hot-path indexes (CTO P0-5, 2026-07-31)
--
-- booking_requests is the busiest table (per-minute cron scans on status; provider
-- inbox + customer "my bookings" filter on provider_id/owner_id + status). Before this
-- only fingerprint/city/lat-lng were indexed, so status/provider/owner filters did a
-- sequential scan that degrades linearly with booking volume.
--
-- NOTE: the CTO directive's SQL used `customer_id`; the REAL column on this table is
-- `owner_id` (the pet owner's Firebase UID). Corrected here after inspecting the schema.
--
-- CONCURRENTLY = no table lock while the index builds (the self-healing migration runner
-- applies via `psql -f` in autocommit, which supports CONCURRENTLY). IF NOT EXISTS keeps
-- it idempotent/re-runnable.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_requests_status_created
  ON booking_requests (status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_requests_provider_status
  ON booking_requests (provider_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_requests_owner_status
  ON booking_requests (owner_id, status, created_at DESC);

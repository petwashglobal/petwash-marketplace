-- 0119: heal 4 SEV recurring runtime errors on the live Cloud Run revision.
--
-- Cloud Logging on revision petwash-api-04188-vil showed these errors firing
-- every 30-60 seconds through 2026-08-20:
--
--   1. [MonitoringWatchdog] Threshold check failed
--        relation "provider_workflow_events" does not exist
--      -> server/services/providerMonitoring.ts inserts + selects this table
--         every watchdog tick, but no migration ever created it (drift).
--
--   2. [BookingExpiry] Unified stuck scan
--        SELECT ... status ... FROM trainer_bookings ...
--      -> the column is trainer_bookings.booking_status (schema.ts:7287).
--         Code fix ships in server/jobs/booking-expiry.ts; nothing to do here.
--
--   3. [WalletReconciliation] Stuck-hold detection failed
--        SELECT ... stuck_hold_alert_sent_at FROM booking_requests ...
--        SELECT ... stuck_hold_alert_sent_at FROM trainer_bookings ...
--      -> the column is used as a per-booking once-only SMS-escalation flag.
--         Neither table has it — add nullable timestamp to both.
--
--   4. [KYC2026:RateLimit] Cleanup error
--        DELETE FROM kyc_rate_limits WHERE window_end < NOW() - INTERVAL '1 hour'
--      -> server/services/KYC2026/KYCRateLimiter.ts uses a Postgres-backed
--         sliding-window rate limiter, but no migration ever created the table.
--
-- Every statement below is idempotent (IF NOT EXISTS). Additive, non-destructive.
-- APPLY in prod (CEO/ops).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. provider_workflow_events — threshold-event audit trail for the provider
--    monitoring watchdog. Writes come from emitProviderEvent() and reads from
--    getRecentEvents() + the dedup EXISTS check inside runMonitoringThresholds.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS provider_workflow_events (
  id              bigserial PRIMARY KEY,
  application_id  integer,
  event_name      varchar(120) NOT NULL,
  severity        varchar(20)  NOT NULL DEFAULT 'info',
  payload         jsonb,
  created_at      timestamp    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwe_application_event_created
  ON provider_workflow_events (application_id, event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwe_severity_created
  ON provider_workflow_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwe_created_at
  ON provider_workflow_events (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Stuck-hold once-only SMS-escalation flag on both booking tables.
--    Nullable timestamp — code checks `IF (b.stuck_hold_alert_sent_at) continue`,
--    then sets NOW() after the SMS goes out. See wallet-reconciliation.ts.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS stuck_hold_alert_sent_at timestamp;

ALTER TABLE trainer_bookings
  ADD COLUMN IF NOT EXISTS stuck_hold_alert_sent_at timestamp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. kyc_rate_limits — Postgres-backed sliding-window counters for KYC 2026
--    rate limiting. Composite PK matches the ON CONFLICT clause in
--    KYCRateLimiter.checkRateLimit() so upserts are atomic and safe to retry.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_rate_limits (
  bucket_name     varchar(80)  NOT NULL,
  rate_key        varchar(255) NOT NULL,
  window_start    timestamp    NOT NULL,
  window_end      timestamp    NOT NULL,
  request_count   integer      NOT NULL DEFAULT 0,
  violations      integer      NOT NULL DEFAULT 0,
  updated_at      timestamp    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_name, rate_key, window_start)
);

-- Fast cleanup for `DELETE ... WHERE window_end < NOW() - INTERVAL '1 hour'`
CREATE INDEX IF NOT EXISTS idx_kyc_rate_limits_window_end
  ON kyc_rate_limits (window_end);

-- Fast active-window aggregation
-- (`SELECT SUM(request_count) ... WHERE bucket=$ AND rate_key=$ AND window_end > NOW()`)
CREATE INDEX IF NOT EXISTS idx_kyc_rate_limits_active_window
  ON kyc_rate_limits (bucket_name, rate_key, window_end);

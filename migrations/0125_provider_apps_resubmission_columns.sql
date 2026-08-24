-- 0125: Add missing resubmission columns to provider_applications.
--
-- Production Deploy 32776851251 (2026-08-24 20:57 UTC) failed because
-- MonitoringWatchdog.processApplicationTimeouts fired an unhandled
-- exception:
--
--   [MonitoringWatchdog] Threshold check failed
--   "column \"last_requested_resubmission_at\" does not exist"
--
-- The exception propagated to the post-deploy /health/strict gate,
-- Cloud Run rejected the candidate revision (petwash-api-04346-mov),
-- no traffic moved.
--
-- Code references at:
--   server/routes/provider-onboarding.ts:2198  UPDATE ... last_requested_resubmission_at = NOW()
--   server/routes/provider-onboarding.ts:2355  SELECT ... resubmission_count, last_requested_resubmission_at, last_resubmitted_at
--   server/services/providerMonitoring.ts:144 WHERE last_requested_resubmission_at < NOW() - INTERVAL '14 days'
--
-- Migration is ADDITIVE + IF NOT EXISTS. Safe to re-run.

ALTER TABLE provider_applications
  ADD COLUMN IF NOT EXISTS resubmission_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_requested_resubmission_at timestamp,
  ADD COLUMN IF NOT EXISTS last_resubmitted_at timestamp,
  ADD COLUMN IF NOT EXISTS sub_status text;

-- Backs the MonitoringWatchdog expire scan (WHERE status='pending_resubmission'
-- AND last_requested_resubmission_at < NOW() - INTERVAL '14 days').
CREATE INDEX IF NOT EXISTS idx_provider_apps_status_resubmission
  ON provider_applications (status, last_requested_resubmission_at)
  WHERE status = 'pending_resubmission';

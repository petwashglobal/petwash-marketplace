-- 0100: pw_async_jobs — the table AsyncJobWorker has been polling since the
-- Google Hardening Pack shipped, but NO migration ever created it (phantom
-- table). In production the worker's claim query failed EVERY 30s cycle
-- ("[AsyncJobWorker] Cycle error" storm found in Cloud Run logs 2026-07-22),
-- and every enqueueGoogleJob() call silently dropped its job (fail-open by
-- design, so payments were never blocked — but Drive archival / Sheets export /
-- Gmail-fallback / SUMIT sync jobs all evaporated).
--
-- Schema is derived 1:1 from the worker's SQL (claimJobs / markDone /
-- markForRetry / markFailed / enqueueGoogleJob in AsyncJobWorker.ts).
-- Idempotent: IF NOT EXISTS everywhere (safe if a hotfix created it manually).

CREATE TABLE IF NOT EXISTS pw_async_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type     text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSING | DONE | FAILED
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 10,
  next_run_at  timestamptz NOT NULL DEFAULT now(),
  last_error   text,
  locked_at    timestamptz,
  locked_by    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- The worker's poll: WHERE status IN ('PENDING','FAILED') AND next_run_at <= now()
CREATE INDEX IF NOT EXISTS pw_async_jobs_poll_idx
  ON pw_async_jobs (status, next_run_at);

-- Ops queries by entity ("what jobs ran for this document/booking?")
CREATE INDEX IF NOT EXISTS pw_async_jobs_entity_idx
  ON pw_async_jobs (entity_type, entity_id);

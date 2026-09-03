-- Release-blocker B1 — SystemConfig persistence
-- (CEO 2026-09-02 release freeze).
--
-- Prior state: every ff.* / captcha / sumit / etc. runtime toggle lived
-- in a single-instance in-memory Map (server/services/SystemConfig.ts).
-- In multi-instance Cloud Run each pod served a different flag view;
-- an admin flip was unobservable elsewhere and vanished on redeploy.
--
-- New: shared Postgres store. SystemConfigService reads through the
-- table on startup (hydrate) and periodically refreshes; every set()
-- write goes here first so all pods eventually see it (poll interval
-- default 30s, tunable via env).
--
-- Schema is deliberately narrow — key + value_json + updated_at +
-- updated_by. No history table; a small in-memory audit log inside the
-- service still records recent changes for the admin panel.

CREATE TABLE IF NOT EXISTS system_config (
  key         TEXT PRIMARY KEY,
  value_json  JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT NOT NULL DEFAULT 'system'
);

-- Poll index — not strictly needed on a table this small, but keeps
-- the refresh scan cheap if the fleet grows the flag set.
CREATE INDEX IF NOT EXISTS idx_system_config_updated_at
  ON system_config (updated_at DESC);

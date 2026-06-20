-- Unified Admin Alerts Center ("מרכז התראות") — Control Tower §7/§17. 2026-06-20.
--
-- ADDITIVE: a single admin triage queue. Does NOT replace the domain alert
-- tables (station_alerts, ops_incidents, bay_faults, compliance_tasks, …).
-- The AlertEngine auto-creates rows when a condition is detected and
-- auto-resolves them when it clears.
--
-- IDEMPOTENCY: at most ONE non-terminal alert per dedupe_key. The partial
-- unique index below enforces it so a recurring sweep can never insert a
-- duplicate open/acknowledged/snoozed alert for the same condition.

CREATE TABLE IF NOT EXISTS admin_alerts (
  id                  SERIAL PRIMARY KEY,
  dedupe_key          VARCHAR(200) NOT NULL,
  category            VARCHAR(32)  NOT NULL,
  severity            VARCHAR(16)  NOT NULL,
  status              VARCHAR(16)  NOT NULL DEFAULT 'open',
  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  linked_entity_type  VARCHAR(40),
  linked_entity_id    VARCHAR(120),
  assigned_to         VARCHAR(128),
  assigned_at         TIMESTAMP,
  due_at              TIMESTAMP,
  snoozed_until       TIMESTAMP,
  acknowledged_at     TIMESTAMP,
  acknowledged_by     VARCHAR(128),
  resolved_at         TIMESTAMP,
  resolved_by         VARCHAR(128),
  resolution_note     TEXT,
  source              VARCHAR(24)  NOT NULL DEFAULT 'auto_sweep',
  metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_dedupe   ON admin_alerts (dedupe_key);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status   ON admin_alerts (status, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_severity ON admin_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_category ON admin_alerts (category);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_assigned ON admin_alerts (assigned_to);

-- One live alert per condition. Terminal states (resolved/dismissed) are excluded
-- so the same condition can legitimately re-fire later.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_admin_alerts_active_dedupe
  ON admin_alerts (dedupe_key)
  WHERE status NOT IN ('resolved', 'dismissed');

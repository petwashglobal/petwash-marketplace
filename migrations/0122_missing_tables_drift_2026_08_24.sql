-- 0122: heal the remaining SEV missing-table drift found in the 2026-08-24 audit.
--
-- Migration 0121 (2026-08-20) deliberately deferred these tables because they
-- touch "protected systems." The deferred paths have been silently 500ing or
-- swallowing errors for weeks. Ship them as ADDITIVE + idempotent CREATE
-- statements so operations proceed safely.
--
-- Coverage:
--   1) accessibility_feedback + accessibility_audit_log
--      (server/routes/publicAuthRoutes.ts:1357, 1379 — Israel A11y evidence)
--   2) nayax_settlement_reports
--      (server/routes/nayax-webhooks.ts:474 — daily settlement reconciliation
--       record ON CONFLICT (settlement_id) DO UPDATE)
--   3) wallet_anomaly_alerts
--      (server/routes/prestige-pass.ts:14652 — admin anomaly dashboard tile)
--
-- All CREATE TABLE + CREATE INDEX statements are IF NOT EXISTS. Safe to re-run.
-- Safe against a hand-created prod table with matching columns.
--
-- Deliberately still deferred (money-adjacent — belong to their own PR):
--   • `refund_requests`  (see docs/finance/refund-rail-design-2026-06-23.md
--     for the debate about whether this should be renamed to
--     `refund_transactions` at the code layer OR created as a new table).

-- ═════════════════════════════════════════════════════════════════════════════
-- 1a) accessibility_feedback
--   INSERT INTO accessibility_feedback(email, message, page_url, user_agent, ip_address)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS accessibility_feedback (
  id           bigserial   PRIMARY KEY,
  email        text,
  message      text        NOT NULL,
  page_url     text,
  user_agent   text,
  ip_address   text,
  created_at   timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_feedback_created_at
  ON accessibility_feedback (created_at DESC);

-- ═════════════════════════════════════════════════════════════════════════════
-- 1b) accessibility_audit_log
--   INSERT INTO accessibility_audit_log(action, component, details, user_agent, ip_address)
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS accessibility_audit_log (
  id           bigserial   PRIMARY KEY,
  action       text        NOT NULL,
  component    text,
  details      jsonb,
  user_agent   text,
  ip_address   text,
  created_at   timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_audit_log_created_at
  ON accessibility_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accessibility_audit_log_action
  ON accessibility_audit_log (action);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2) nayax_settlement_reports
--   INSERT ... ON CONFLICT (settlement_id) DO UPDATE SET ...
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS nayax_settlement_reports (
  id                  bigserial   PRIMARY KEY,
  settlement_id       varchar(128) NOT NULL,
  date                date        NOT NULL,
  total_amount_nayax  numeric(18,2) NOT NULL DEFAULT 0,
  currency            varchar(8)  NOT NULL DEFAULT 'ILS',
  transaction_count   integer     NOT NULL DEFAULT 0,
  matched_count       integer     NOT NULL DEFAULT 0,
  discrepancy_count   integer     NOT NULL DEFAULT 0,
  discrepancies_json  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status              varchar(32) NOT NULL DEFAULT 'pending',
  created_at          timestamp   NOT NULL DEFAULT NOW(),
  updated_at          timestamp   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nayax_settlement_reports_settlement_id
  ON nayax_settlement_reports (settlement_id);
CREATE INDEX IF NOT EXISTS idx_nayax_settlement_reports_date
  ON nayax_settlement_reports (date DESC);
CREATE INDEX IF NOT EXISTS idx_nayax_settlement_reports_status
  ON nayax_settlement_reports (status);

-- ═════════════════════════════════════════════════════════════════════════════
-- 3) wallet_anomaly_alerts
--   SELECT COUNT(*) AS total, SUM(CASE WHEN severity='critical' ...)
--   FROM wallet_anomaly_alerts WHERE status='active'
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallet_anomaly_alerts (
  id             bigserial   PRIMARY KEY,
  alert_type     varchar(64) NOT NULL,
  severity       varchar(16) NOT NULL DEFAULT 'info',
  status         varchar(16) NOT NULL DEFAULT 'active',
  wallet_id      varchar(80),
  user_id        varchar(128),
  detail         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  detected_at    timestamp   NOT NULL DEFAULT NOW(),
  resolved_at    timestamp,
  resolved_by    varchar(128),
  created_at     timestamp   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_anomaly_alerts_status_severity
  ON wallet_anomaly_alerts (status, severity);
CREATE INDEX IF NOT EXISTS idx_wallet_anomaly_alerts_wallet_id
  ON wallet_anomaly_alerts (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_anomaly_alerts_detected_at
  ON wallet_anomaly_alerts (detected_at DESC);

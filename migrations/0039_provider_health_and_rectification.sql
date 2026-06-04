-- 0039 — provider_health_scorecard + data_rectification_requests (gaps 5 & 6)
--
-- Gap 5: a unified provider health composite (the repo already has
--   provider_independence_score + ratings; this is the single rolled-up view a
--   dashboard reads). Decoupled provider_id (no FK), additive.
-- Gap 6: GDPR Art.16 rectification audit log. DATA-MINIMIZED BY DESIGN: it
--   records WHICH field was corrected + who/when/status, and deliberately does
--   NOT store the old/new VALUES — storing those would create a new PII store.
--
-- Both PURELY ADDITIVE. No existing row touched. No job runs from this migration.
-- ROLLBACK:
--   DROP TABLE IF EXISTS provider_health_scorecard;
--   DROP TABLE IF EXISTS data_rectification_requests;

CREATE TABLE IF NOT EXISTS provider_health_scorecard (
  id                   BIGSERIAL   PRIMARY KEY,
  provider_id          TEXT        NOT NULL,         -- provider handle; decoupled, no FK
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall_score        INTEGER     NOT NULL,         -- 0..100 composite
  availability_pct     INTEGER,
  reliability          NUMERIC(4,3),
  rating_norm          NUMERIC(4,3),
  responsiveness       NUMERIC(4,3),
  compliance_incidents INTEGER     NOT NULL DEFAULT 0,
  health_state         TEXT        NOT NULL CHECK (health_state IN ('good','watch','at_risk')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_health_score_range CHECK (overall_score >= 0 AND overall_score <= 100)
);
CREATE INDEX IF NOT EXISTS idx_provider_health_provider
  ON provider_health_scorecard (provider_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS data_rectification_requests (
  id           BIGSERIAL   PRIMARY KEY,
  subject_ref  TEXT        NOT NULL,                 -- pseudonymous user ref; NEVER a name
  field_name   TEXT        NOT NULL,                 -- WHICH field changed (not the values)
  status       TEXT        NOT NULL DEFAULT 'received'
                 CHECK (status IN ('received','in_progress','completed','rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by  TEXT,                                 -- actor handle
  applied_at   TIMESTAMPTZ,
  note         TEXT,                                 -- non-PII note only
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_data_rectification_subject
  ON data_rectification_requests (subject_ref, requested_at DESC);

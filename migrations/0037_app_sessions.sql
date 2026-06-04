-- 0037 — App sessions (pseudonymous session tracking)
--
-- BACKGROUND
-- Data & Intelligence gap #2 (docs/data-architecture). Captures one row per
-- app/web/kiosk session for funnel + engagement analytics. Keyed by a
-- PSEUDONYMOUS subject_id (a token, never a name) and an optional device hash —
-- NO PII. The bridge from subject_id → person lives only in the identity vault,
-- never here, so this table is anonymous on its own.
--
-- PURELY ADDITIVE. New table; no existing row touched. No analytics run from
-- defining it — this is the storage only.
--
-- ROLLBACK
--   DROP TABLE IF EXISTS app_sessions;

CREATE TABLE IF NOT EXISTS app_sessions (
  id              BIGSERIAL PRIMARY KEY,
  subject_id      TEXT,                       -- pseudonymous token; NULL pre-auth. NEVER PII.
  surface         TEXT        NOT NULL CHECK (surface IN ('app','web','station_kiosk')),
  device_id       TEXT,                       -- hashed device id; NEVER a raw identifier
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  duration_s      INTEGER,
  screens_viewed  INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_subject
  ON app_sessions (subject_id, started_at DESC);

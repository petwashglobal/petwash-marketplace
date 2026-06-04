-- 0038 — Analytics aggregates: screen_dwell_summary + station_hourly_load (gaps 3 & 4)
--
-- Data & Intelligence gaps 3 & 4 (docs/data-architecture). Both are AGGREGATE
-- tables: no PII, no money, no per-person rows — just rolled-up counts a
-- dashboard reads. A separate (reviewed) job populates them from events; nothing
-- runs from this migration. PURELY ADDITIVE; no existing row touched.
--
-- ROLLBACK
--   DROP TABLE IF EXISTS screen_dwell_summary;
--   DROP TABLE IF EXISTS station_hourly_load;

CREATE TABLE IF NOT EXISTS screen_dwell_summary (
  id            BIGSERIAL   PRIMARY KEY,
  day           DATE        NOT NULL,
  screen        TEXT        NOT NULL,
  views         INTEGER     NOT NULL DEFAULT 0,
  reach         INTEGER     NOT NULL DEFAULT 0,   -- distinct subjects (aggregate count)
  avg_dwell_ms  INTEGER,
  tap_count     INTEGER     NOT NULL DEFAULT 0,
  error_count   INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT screen_dwell_summary_unique UNIQUE (day, screen)
);
CREATE INDEX IF NOT EXISTS idx_screen_dwell_day ON screen_dwell_summary (day DESC, screen);

CREATE TABLE IF NOT EXISTS station_hourly_load (
  id                   BIGSERIAL   PRIMARY KEY,
  station_id           TEXT        NOT NULL,      -- decoupled analytics key (no FK)
  hour_bucket          TIMESTAMPTZ NOT NULL,
  active_session_count INTEGER     NOT NULL DEFAULT 0,
  utilization_pct      NUMERIC(5,2),
  avg_queue_length     NUMERIC(6,2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT station_hourly_load_unique UNIQUE (station_id, hour_bucket)
);
CREATE INDEX IF NOT EXISTS idx_station_hourly_station ON station_hourly_load (station_id, hour_bucket DESC);

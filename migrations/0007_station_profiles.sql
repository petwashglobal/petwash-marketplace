-- Phase 10 Task #23 — Station Performance Layer
-- Creates the station_profiles table for per-station trust + ranking scores.
-- Scores are independent of the franchise owner score.
-- Populated by POST /api/admin/stations/:stationId/recompute

CREATE TABLE IF NOT EXISTS station_profiles (
  station_id       integer PRIMARY KEY REFERENCES stations(id),
  trust_score      integer NOT NULL DEFAULT 50,
  ranking_score    integer NOT NULL DEFAULT 50,
  rating_avg       numeric(3,2) NOT NULL DEFAULT 0,
  rating_count     integer NOT NULL DEFAULT 0,
  dispute_count    integer NOT NULL DEFAULT 0,
  completion_rate  numeric(5,4) NOT NULL DEFAULT 1,
  last_computed_at timestamptz NOT NULL DEFAULT now()
);

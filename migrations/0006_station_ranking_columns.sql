-- Phase 10 Task #22
-- 1. Add station_id FK to bookings (nullable — Phase 10 station assignment)
-- 2. Add performance/ranking columns to stations table (T23 stub)
--    ranking_score drives the 25% quality weight in GET /api/stations/recommend
--    and booking auto-assignment; COALESCE 50 = neutral default until T23 populates it.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS station_id integer REFERENCES stations(id);

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS trust_score          integer,
  ADD COLUMN IF NOT EXISTS ranking_score        integer,
  ADD COLUMN IF NOT EXISTS ranking_updated_at   timestamptz;

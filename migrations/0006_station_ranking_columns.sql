-- Phase 10 Task #22 / Task #23 stub
-- Add performance/ranking columns to stations table.
-- trust_score and ranking_score will be populated by the T23 Station Performance Layer job.
-- ranking_score is used by the station recommendation API (GET /api/stations/recommend)
-- and the booking auto-assignment logic as the 25%/40% quality weight (COALESCE 50 = neutral default).

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS trust_score          integer,
  ADD COLUMN IF NOT EXISTS ranking_score        integer,
  ADD COLUMN IF NOT EXISTS ranking_updated_at   timestamptz;

-- 0091 — social growth metrics (in-house social dashboard, 2026-07-11)
-- Time-series snapshots of PetWash's OWN social accounts (Instagram/TikTok/
-- Facebook @petwashltd), captured by SocialInsightsService (dark until platform
-- API tokens are set, mirroring the SUMIT/Nayax dark-flag pattern). Read-only
-- analytics — no PII, no consumer data. Powers the admin Social Growth panel.
-- Additive + idempotent: nullable metrics, IF NOT EXISTS, safe to re-run.
CREATE TABLE IF NOT EXISTS social_metric_snapshots (
  id             serial PRIMARY KEY,
  platform       varchar(20) NOT NULL,          -- 'instagram' | 'tiktok' | 'facebook'
  handle         varchar(80),                   -- e.g. 'petwashltd'
  followers      integer,
  following      integer,
  posts          integer,
  reach          integer,                        -- period reach when the API exposes it
  impressions    integer,
  engagement     integer,                        -- likes+comments+shares+saves aggregate
  profile_views  integer,
  link_clicks    integer,
  captured_at    timestamptz NOT NULL DEFAULT now(),
  source         varchar(20) NOT NULL DEFAULT 'api'  -- 'api' | 'manual'
);

CREATE INDEX IF NOT EXISTS idx_social_snapshots_platform_time
  ON social_metric_snapshots (platform, captured_at DESC);

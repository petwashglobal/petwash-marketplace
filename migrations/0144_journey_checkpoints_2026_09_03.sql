-- Lane C · Journey Brain Phase 2 (post-release 2026-09-03).
--
-- JourneyCheckpoint durable-state table. An opaque per-(user, domain)
-- JSON blob that lets a wizard resume where the user left off. Never
-- authority — every payment / state / permission gate re-runs from
-- canonical truth on resume; the checkpoint is a UX hint only.
--
-- UNIQUE (user_uid, domain) — one active checkpoint per flow per user.
-- expires_at — automatic staleness so a months-old draft can never
-- magically reappear and re-charge / re-notify. Default TTL is set by
-- the service layer (72h); the DB simply refuses expired reads.
--
-- Renumbered from the closed #2168 slot (was 0134); the 0134 slot is
-- now user_passkeys_lossless_columns_2026_09_01. Additive schema —
-- CREATE ... IF NOT EXISTS is safe to re-run.

CREATE TABLE IF NOT EXISTS journey_checkpoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid      TEXT NOT NULL,
  domain        TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journey_checkpoints_domain_check
    CHECK (domain IN (
      'walk_book',
      'sitter_book',
      'marketplace_book',
      'shop_checkout',
      'egift',
      'provider_apply'
    ))
);

-- One active checkpoint per (user, domain). Repeat saves UPSERT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_journey_checkpoints_user_domain
  ON journey_checkpoints (user_uid, domain);

-- Attention-feed lookup + expiry sweep both walk by user then by
-- expiry. Partial index on active-only rows keeps the scan small.
CREATE INDEX IF NOT EXISTS idx_journey_checkpoints_active
  ON journey_checkpoints (user_uid, updated_at DESC)
  WHERE expires_at > now();

-- Sweep index for the periodic prune.
CREATE INDEX IF NOT EXISTS idx_journey_checkpoints_expiry
  ON journey_checkpoints (expires_at);

-- ============================================================
-- PawFinder™ — Lost & Found Pet Platform
-- All tables required by paw-finder routes + services
-- ============================================================

-- Core posts table
CREATE TABLE IF NOT EXISTS paw_finder_posts (
  id                        SERIAL PRIMARY KEY,
  post_key                  TEXT NOT NULL UNIQUE,
  user_id                   TEXT NOT NULL,
  post_type                 TEXT NOT NULL CHECK (post_type IN ('lost', 'found')),
  pet_type                  TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat', 'bird', 'other')),
  pet_name                  TEXT,
  breed                     TEXT,
  color_primary             TEXT,
  color_secondary           TEXT,
  size_category             TEXT NOT NULL DEFAULT 'unknown',
  sex                       TEXT NOT NULL DEFAULT 'unknown',
  description               TEXT NOT NULL,
  reward_amount             NUMERIC(10, 2),
  contact_preference        TEXT DEFAULT 'inbox_first',
  contact_phone             TEXT,
  city                      TEXT NOT NULL,
  area                      TEXT,
  address_text              TEXT,
  latitude                  NUMERIC(10, 6),
  longitude                 NUMERIC(10, 6),
  event_date                DATE NOT NULL,
  -- Lifecycle status: draft | pending_review | published | matched | resolved | rejected | archived
  status                    TEXT NOT NULL DEFAULT 'draft',
  -- Moderation verdict: pending | approved | flagged | blocked
  moderation_status         TEXT NOT NULL DEFAULT 'pending',
  moderation_reason         TEXT,
  moderation_confidence     INTEGER,
  image_hash                TEXT,
  matched_post_count        INTEGER NOT NULL DEFAULT 0,
  final_publish_checked_at  TIMESTAMPTZ,
  published_at              TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,
  archived_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_posts_user_id   ON paw_finder_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_posts_status    ON paw_finder_posts (status);
CREATE INDEX IF NOT EXISTS idx_paw_finder_posts_city      ON paw_finder_posts (city);
CREATE INDEX IF NOT EXISTS idx_paw_finder_posts_post_type ON paw_finder_posts (post_type);
CREATE INDEX IF NOT EXISTS idx_paw_finder_posts_created   ON paw_finder_posts (created_at DESC);

-- Media files attached to a post (primary + extra photos)
CREATE TABLE IF NOT EXISTS paw_finder_media (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  media_role TEXT NOT NULL DEFAULT 'primary',
  file_path  TEXT NOT NULL,
  mime_type  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_media_post_id ON paw_finder_media (post_id);

-- Computed matches between lost and found posts (Haversine + attribute similarity)
CREATE TABLE IF NOT EXISTS paw_finder_matches (
  id                 SERIAL PRIMARY KEY,
  lost_post_id       INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  found_post_id      INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  similarity_score   INTEGER NOT NULL DEFAULT 0,
  similarity_reasons JSONB,
  distance_km        NUMERIC(10, 2),
  date_gap_days      INTEGER,
  -- suggested | confirmed | resolved | dismissed
  status             TEXT NOT NULL DEFAULT 'suggested',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lost_post_id, found_post_id)
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_matches_lost_post_id  ON paw_finder_matches (lost_post_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_matches_found_post_id ON paw_finder_matches (found_post_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_matches_status        ON paw_finder_matches (status);

-- Contact requests sent by members to post owners
CREATE TABLE IF NOT EXISTS paw_finder_contact_requests (
  id                 SERIAL PRIMARY KEY,
  post_id            INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  requester_user_id  TEXT NOT NULL,
  owner_user_id      TEXT NOT NULL,
  message_text       TEXT NOT NULL,
  -- pending | accepted | declined
  status             TEXT NOT NULL DEFAULT 'pending',
  reveal_phone       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_contacts_post_id       ON paw_finder_contact_requests (post_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_contacts_requester_uid ON paw_finder_contact_requests (requester_user_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_contacts_owner_uid     ON paw_finder_contact_requests (owner_user_id);

-- Immutable audit event log for every state change
CREATE TABLE IF NOT EXISTS paw_finder_events (
  id             SERIAL PRIMARY KEY,
  post_id        INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  event_name     TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info',
  actor_user_id  TEXT,
  payload        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_events_post_id   ON paw_finder_events (post_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_events_created   ON paw_finder_events (created_at DESC);

-- Moderation decision log (auto + manual rounds)
CREATE TABLE IF NOT EXISTS paw_finder_moderation_events (
  id             SERIAL PRIMARY KEY,
  post_id        INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  -- auto_publish | auto_block | auto_flag | manual_review | re_review
  stage          TEXT NOT NULL,
  -- approved | flagged | blocked
  verdict        TEXT NOT NULL,
  confidence     INTEGER,
  flags          JSONB,
  raw_summary    JSONB,
  actor_user_id  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_mod_events_post_id ON paw_finder_moderation_events (post_id);

-- In-app notifications delivered to post owners/requesters
CREATE TABLE IF NOT EXISTS paw_finder_notifications (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  post_id     INTEGER REFERENCES paw_finder_posts (id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  payload     JSONB,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_notif_user_id  ON paw_finder_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_notif_post_id  ON paw_finder_notifications (post_id);
CREATE INDEX IF NOT EXISTS idx_paw_finder_notif_unread   ON paw_finder_notifications (user_id, read) WHERE read = FALSE;

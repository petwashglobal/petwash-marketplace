-- 2026-09-13: Adopt a Pet is its own service, not a PawFinder post type.
--
-- PR #920 (2026-06-20) stored adoption listings as paw_finder_posts rows with
-- post_type='adoption' to reuse the lost & found engine. The two products have
-- different intents (LOST <-> FOUND reunion vs. a permanent new family),
-- different statuses and different contact flows, and sharing the table made
-- adoption listings show on the PawFinder board and PawFinder logic run on them.
--
-- This migration:
--   1. creates the adoption domain (listings, media, enquiries, notifications, events)
--   2. copies any legacy adoption rows out of paw_finder_posts (nothing deleted —
--      the legacy rows are archived and keep a back-reference)
--   3. pins paw_finder_posts.post_type to lost | found for every new row
--
-- Plain statements only: scripts/apply-pending-migrations.ts splits on ';'.

CREATE TABLE IF NOT EXISTS adoption_listings (
  id                         SERIAL PRIMARY KEY,
  listing_key                VARCHAR(48) NOT NULL UNIQUE,
  user_id                    VARCHAR(128) NOT NULL,
  lister_type                VARCHAR(16) NOT NULL DEFAULT 'private',
  pet_type                   VARCHAR(16) NOT NULL,
  pet_name                   VARCHAR(100),
  breed                      VARCHAR(100),
  sex                        VARCHAR(16) NOT NULL DEFAULT 'unknown',
  age_group                  VARCHAR(16) NOT NULL DEFAULT 'unknown',
  size_category              VARCHAR(16) NOT NULL DEFAULT 'unknown',
  color                      VARCHAR(60),
  description                TEXT NOT NULL,
  temperament                TEXT,
  health_notes               TEXT,
  special_needs              TEXT,
  vaccinated                 VARCHAR(8) NOT NULL DEFAULT 'unknown',
  neutered                   VARCHAR(8) NOT NULL DEFAULT 'unknown',
  microchipped               VARCHAR(8) NOT NULL DEFAULT 'unknown',
  good_with_children         VARCHAR(8) NOT NULL DEFAULT 'unknown',
  good_with_dogs             VARCHAR(8) NOT NULL DEFAULT 'unknown',
  good_with_cats             VARCHAR(8) NOT NULL DEFAULT 'unknown',
  city                       VARCHAR(100) NOT NULL,
  area                       VARCHAR(100),
  contact_phone              VARCHAR(32),
  status                     VARCHAR(20) NOT NULL DEFAULT 'pending_review'
                             CHECK (status IN ('pending_review','available','pending','adopted','rejected','archived')),
  moderation_status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  moderation_reason          TEXT,
  moderation_confidence      INTEGER,
  image_hash                 VARCHAR(64),
  legacy_paw_finder_post_id  INTEGER UNIQUE,
  published_at               TIMESTAMPTZ,
  adopted_at                 TIMESTAMPTZ,
  archived_at                TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_listings_status  ON adoption_listings (status);
CREATE INDEX IF NOT EXISTS idx_adoption_listings_user_id ON adoption_listings (user_id);
CREATE INDEX IF NOT EXISTS idx_adoption_listings_city    ON adoption_listings (city);

CREATE TABLE IF NOT EXISTS adoption_listing_media (
  id          SERIAL PRIMARY KEY,
  listing_id  INTEGER NOT NULL REFERENCES adoption_listings (id) ON DELETE CASCADE,
  media_role  VARCHAR(16) NOT NULL DEFAULT 'primary',
  file_path   TEXT NOT NULL,
  mime_type   VARCHAR(64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_listing_media_listing ON adoption_listing_media (listing_id);

CREATE TABLE IF NOT EXISTS adoption_enquiries (
  id                 SERIAL PRIMARY KEY,
  listing_id         INTEGER NOT NULL REFERENCES adoption_listings (id) ON DELETE CASCADE,
  applicant_user_id  VARCHAR(128) NOT NULL,
  owner_user_id      VARCHAR(128) NOT NULL,
  message_text       TEXT NOT NULL,
  applicant_phone    VARCHAR(32),
  home_type          VARCHAR(24) NOT NULL DEFAULT 'unspecified',
  has_children       VARCHAR(8) NOT NULL DEFAULT 'unknown',
  has_other_pets     VARCHAR(8) NOT NULL DEFAULT 'unknown',
  status             VARCHAR(16) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_enquiries_listing   ON adoption_enquiries (listing_id);
CREATE INDEX IF NOT EXISTS idx_adoption_enquiries_owner     ON adoption_enquiries (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_adoption_enquiries_applicant ON adoption_enquiries (applicant_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_adoption_enquiries_one_pending
  ON adoption_enquiries (listing_id, applicant_user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS adoption_notifications (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(128) NOT NULL,
  listing_id  INTEGER REFERENCES adoption_listings (id) ON DELETE CASCADE,
  event_type  VARCHAR(40) NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_notifications_user ON adoption_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS adoption_events (
  id             SERIAL PRIMARY KEY,
  listing_id     INTEGER NOT NULL REFERENCES adoption_listings (id) ON DELETE CASCADE,
  event_name     VARCHAR(64) NOT NULL,
  actor_user_id  VARCHAR(128),
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adoption_events_listing ON adoption_events (listing_id);

-- Legacy adoption rows → adoption_listings. Only columns present in the
-- production paw_finder_posts / paw_finder_media shapes are read.
INSERT INTO adoption_listings
  (listing_key, user_id, pet_type, pet_name, breed, sex, size_category, color,
   description, city, area, contact_phone, status, moderation_status,
   moderation_reason, moderation_confidence, legacy_paw_finder_post_id,
   published_at, archived_at, created_at, updated_at)
SELECT
  'AD-LEGACY-' || p.id, p.user_id, p.pet_type, p.pet_name, p.breed,
  COALESCE(p.sex, 'unknown'), COALESCE(p.size_category, 'unknown'), p.color_primary,
  p.description, p.city, p.area, p.contact_phone,
  CASE
    WHEN p.status IN ('published', 'matched') THEN 'available'
    WHEN p.status = 'resolved' THEN 'adopted'
    WHEN p.status = 'rejected' THEN 'rejected'
    WHEN p.status = 'archived' THEN 'archived'
    ELSE 'pending_review'
  END,
  COALESCE(p.moderation_status, 'pending'), p.moderation_reason, p.moderation_confidence, p.id,
  p.published_at, p.archived_at, p.created_at, NOW()
FROM paw_finder_posts p
WHERE p.post_type = 'adoption'
ON CONFLICT (legacy_paw_finder_post_id) DO NOTHING;

INSERT INTO adoption_listing_media (listing_id, media_role, file_path, mime_type, created_at)
SELECT a.id, COALESCE(m.media_role, 'primary'), m.file_path, m.mime_type, m.created_at
FROM paw_finder_media m
JOIN adoption_listings a ON a.legacy_paw_finder_post_id = m.post_id
WHERE NOT EXISTS (
  SELECT 1 FROM adoption_listing_media x WHERE x.listing_id = a.id AND x.file_path = m.file_path
);

UPDATE paw_finder_posts
SET status = 'archived', archived_at = COALESCE(archived_at, NOW()), updated_at = NOW()
WHERE post_type = 'adoption'
  AND id IN (SELECT legacy_paw_finder_post_id FROM adoption_listings WHERE legacy_paw_finder_post_id IS NOT NULL);

-- PawFinder = LOST <-> FOUND. NOT VALID: enforced for every new or updated row;
-- the archived legacy rows above stay as the audit trail of the move.
ALTER TABLE paw_finder_posts DROP CONSTRAINT IF EXISTS paw_finder_posts_lost_or_found_only;
ALTER TABLE paw_finder_posts ADD CONSTRAINT paw_finder_posts_lost_or_found_only
  CHECK (post_type IN ('lost', 'found')) NOT VALID;

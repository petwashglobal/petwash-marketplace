-- 2026-09-17: a member could not edit or add anything after posting.
--
-- CEO: "cannot edit or add details". Verified: Adopt a Pet allowed only a status
-- change, PawFinder only "resolved". A wrong street, a wrong phone or a new
-- sighting forced the member to delete and repost — losing the notice's age, its
-- matches and every share. A lost-pet notice is a living document.
--
-- This adds: an edit trail on both products, extra photos on a PawFinder notice,
-- and sightings ("seen this morning near the park") that anyone signed in can add.
-- Plain statements only: scripts/apply-pending-migrations.ts splits on ';'.

ALTER TABLE adoption_listings ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;
ALTER TABLE adoption_listings ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE paw_finder_posts ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;
ALTER TABLE paw_finder_posts ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0;

-- Every edit, field by field, before → after. Never deleted.
CREATE TABLE IF NOT EXISTS community_edit_events (
  id            SERIAL PRIMARY KEY,
  surface       VARCHAR(16) NOT NULL,          -- 'adoption' | 'paw_finder'
  item_id       INTEGER NOT NULL,
  actor_user_id VARCHAR(128) NOT NULL,
  field         VARCHAR(48) NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  re_review     BOOLEAN NOT NULL DEFAULT FALSE, -- did this edit send the item back to review?
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_edit_events_item ON community_edit_events (surface, item_id, created_at DESC);

-- A lost/found notice grows: more photos, and sightings from the community.
CREATE TABLE IF NOT EXISTS paw_finder_sightings (
  id             SERIAL PRIMARY KEY,
  post_id        INTEGER NOT NULL REFERENCES paw_finder_posts (id) ON DELETE CASCADE,
  reporter_user_id VARCHAR(128) NOT NULL,
  seen_at        VARCHAR(16) NOT NULL,          -- YYYY-MM-DD, same shape as event_date
  seen_time      VARCHAR(5),                    -- HH:MM, optional
  city           VARCHAR(100) NOT NULL,
  area           VARCHAR(100),
  latitude       NUMERIC(10, 7),
  longitude      NUMERIC(10, 7),
  note           TEXT NOT NULL,
  status         VARCHAR(16) NOT NULL DEFAULT 'reported'
                 CHECK (status IN ('reported', 'confirmed', 'dismissed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paw_finder_sightings_post ON paw_finder_sightings (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paw_finder_sightings_reporter ON paw_finder_sightings (reporter_user_id);

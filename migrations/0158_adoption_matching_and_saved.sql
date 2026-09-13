-- 2026-09-13: Adopt a Pet — the fields and tables the CEO-approved board needs.
--
-- The canonical Adopt a Pet mockup filters by "Apartment Friendly" and
-- "Low Shedding", shows an age ("2 years"), lets a member heart a pet (Saved)
-- and shows "My Matches" from a reusable adopter profile. None of that existed.
-- Plain statements only: scripts/apply-pending-migrations.ts splits on ';'.

ALTER TABLE adoption_listings ADD COLUMN IF NOT EXISTS apartment_friendly VARCHAR(8) NOT NULL DEFAULT 'unknown';
ALTER TABLE adoption_listings ADD COLUMN IF NOT EXISTS low_shedding VARCHAR(8) NOT NULL DEFAULT 'unknown';
ALTER TABLE adoption_listings ADD COLUMN IF NOT EXISTS age_months INTEGER;

CREATE TABLE IF NOT EXISTS adoption_favorites (
  user_id     VARCHAR(128) NOT NULL,
  listing_id  INTEGER NOT NULL REFERENCES adoption_listings (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_adoption_favorites_listing ON adoption_favorites (listing_id);

-- One reusable adopter profile per member (answers the enquiry questions once).
CREATE TABLE IF NOT EXISTS adoption_adopter_profiles (
  user_id            VARCHAR(128) PRIMARY KEY,
  home_type          VARCHAR(24) NOT NULL DEFAULT 'unspecified',
  has_children       VARCHAR(8) NOT NULL DEFAULT 'unknown',
  has_dogs           VARCHAR(8) NOT NULL DEFAULT 'unknown',
  has_cats           VARCHAR(8) NOT NULL DEFAULT 'unknown',
  wants_low_shedding VARCHAR(8) NOT NULL DEFAULT 'unknown',
  preferred_species  VARCHAR(16) NOT NULL DEFAULT 'any',
  city               VARCHAR(100),
  about              TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

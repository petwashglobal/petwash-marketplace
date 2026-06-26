-- 0080_waitlist_entries.sql
-- Universal WAITLIST / demand-capture engine (CEO "no dead pages" spec, 2026-06-26).
--
-- Every not-yet-live surface (PetTrek waitlist, shop product wishlist, a service
-- not live in a city, K9000 station requests, provider/partner interest, early
-- access) must still create a DB record instead of showing a dead "coming soon".
-- ONE table backs them all, keyed by platform_key + interest_type.
--
-- Additive only — no existing table is altered. Works for both logged-in users
-- (user_id) and anonymous visitors (guest_id). 2026-06-26.

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id                  SERIAL PRIMARY KEY,
  -- Firebase UID when logged in; else NULL (anonymous capture uses guest_id).
  user_id             VARCHAR(255),
  guest_id            VARCHAR(255),

  full_name           VARCHAR(255),
  mobile              VARCHAR(40),
  email               VARCHAR(320),
  city                VARCHAR(120),
  country             VARCHAR(80),
  postcode            VARCHAR(40),
  language            VARCHAR(8),

  pet_type            VARCHAR(40),
  pet_name            VARCHAR(120),

  -- Which platform/surface this interest is for: PETTREK | PAW_FINDER |
  -- SITTER_SUITE | WALK_MY_PET | ACADEMY | SHOP | K9000_STATION | PROVIDER |
  -- PARTNER | CITY | PRODUCT | OTHER.
  platform_key        VARCHAR(40)  NOT NULL,
  -- Free-form sub-intent (e.g. 'vet_transport', 'notify_when_available').
  interest_type       VARCHAR(60),
  message             TEXT,

  source_page         VARCHAR(255),
  campaign_source     VARCHAR(120),

  consent_to_contact  BOOLEAN      NOT NULL DEFAULT FALSE,
  marketing_consent   BOOLEAN      NOT NULL DEFAULT FALSE,

  -- NEW | CONTACTED | QUALIFIED | WAITING_FOR_LAUNCH | INVITED | CONVERTED |
  -- CLOSED | DUPLICATE | SPAM
  status              VARCHAR(24)  NOT NULL DEFAULT 'NEW',
  priority_score      INTEGER      NOT NULL DEFAULT 0,
  ai_tags             JSONB        NOT NULL DEFAULT '[]'::jsonb,

  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_platform   ON waitlist_entries (platform_key);
CREATE INDEX IF NOT EXISTS idx_waitlist_status     ON waitlist_entries (status);
CREATE INDEX IF NOT EXISTS idx_waitlist_user       ON waitlist_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_email      ON waitlist_entries (email);
CREATE INDEX IF NOT EXISTS idx_waitlist_city       ON waitlist_entries (city);
CREATE INDEX IF NOT EXISTS idx_waitlist_created    ON waitlist_entries (created_at DESC);

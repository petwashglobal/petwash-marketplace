-- 0050 — Trust, instant-book, meet & greet, AI trust score, live session safety
--
-- BACKGROUND
-- Closes the trust/booking gaps found benchmarking Rover (background-checks every
-- sitter + RoverProtect) and Mad Paws (ID + police check + per-booking insurance),
-- and adds 2026 "trust-first" innovations: a computed AI trust score that gates
-- instant-book + ranks search, and a live service-safety session (check-in/out,
-- GPS proof, photo proof, SOS) for the worst-case scenarios owners fear.
--
-- PURELY ADDITIVE / SAFE EXPAND. New tables + NULLABLE columns only — no existing
-- row is touched, no column is dropped. Instant in PostgreSQL.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS service_safety_sessions;
--   DROP TABLE IF EXISTS provider_trust_scores;
--   DROP TABLE IF EXISTS meet_greets;
--   DROP TABLE IF EXISTS provider_background_checks;
--   ALTER TABLE sitter_profiles DROP COLUMN IF EXISTS instant_book_enabled;
--   ALTER TABLE sitter_profiles DROP COLUMN IF EXISTS instant_book_min_trust;
--   ALTER TABLE walker_profiles DROP COLUMN IF EXISTS instant_book_enabled;
--   ALTER TABLE walker_profiles DROP COLUMN IF EXISTS instant_book_min_trust;

-- 1) Provider background / police / enhanced checks (Rover + Mad Paws parity).
CREATE TABLE IF NOT EXISTS provider_background_checks (
  id            BIGSERIAL   PRIMARY KEY,
  provider_id   TEXT        NOT NULL,                 -- provider uid; decoupled, no FK
  check_type    TEXT        NOT NULL DEFAULT 'identity'
                  CHECK (check_type IN ('identity','police','enhanced','reference','right_to_work')),
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','clear','flagged','expired','rejected')),
  vendor        TEXT,                                 -- e.g. fit2work, checkr (no PII payload stored here)
  vendor_ref    TEXT,                                 -- external check id for reconciliation
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,                          -- checks lapse; re-verify on expiry
  notes         TEXT,                                 -- non-PII operational note only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bgcheck_provider ON provider_background_checks (provider_id, status);

-- 2) Meet & greet — a real scheduled object (was only a status string).
CREATE TABLE IF NOT EXISTS meet_greets (
  id                  BIGSERIAL   PRIMARY KEY,
  booking_request_id  TEXT,                           -- ties to the request that prompted it
  owner_id            TEXT        NOT NULL,
  provider_id         TEXT        NOT NULL,
  mode                TEXT        NOT NULL DEFAULT 'in_person'
                        CHECK (mode IN ('in_person','video')),
  scheduled_at        TIMESTAMPTZ,
  status              TEXT        NOT NULL DEFAULT 'proposed'
                        CHECK (status IN ('proposed','confirmed','completed','declined','no_show')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meetgreet_provider ON meet_greets (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_meetgreet_owner ON meet_greets (owner_id, scheduled_at DESC);

-- 3) AI trust score — single composite (0..100) that gates instant-book + ranks
--    search. Recomputed by a job from background-check status, verified-review avg,
--    completion rate, response time, cancellation rate, ID/KYC. The factors are
--    stored so a provider can see exactly why their score is what it is.
CREATE TABLE IF NOT EXISTS provider_trust_scores (
  provider_id        TEXT        PRIMARY KEY,
  score              INTEGER     NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  tier               TEXT        NOT NULL DEFAULT 'new'
                       CHECK (tier IN ('new','bronze','silver','gold','platinum')),
  id_verified        BOOLEAN     NOT NULL DEFAULT false,
  background_clear   BOOLEAN     NOT NULL DEFAULT false,
  review_avg         NUMERIC(3,2),                     -- 0.00..5.00
  review_count       INTEGER     NOT NULL DEFAULT 0,
  completion_rate    NUMERIC(4,3),                     -- 0..1
  response_minutes   INTEGER,
  cancellation_rate  NUMERIC(4,3),                     -- 0..1
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trust_score ON provider_trust_scores (score DESC);

-- 4) Live service-safety session — the worst-case-safety layer owners fear losing.
--    One row per active service (walk/sit/visit): check-in/out with GPS proof,
--    periodic photo updates, and an SOS/panic flag for incident escalation.
CREATE TABLE IF NOT EXISTS service_safety_sessions (
  id              BIGSERIAL   PRIMARY KEY,
  booking_id      TEXT        NOT NULL,
  provider_id     TEXT        NOT NULL,
  owner_id        TEXT,
  platform        TEXT,                                -- walk_my_pet | sitter_suite | ...
  status          TEXT        NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','checked_in','in_progress','checked_out','completed','incident')),
  checked_in_at   TIMESTAMPTZ,
  check_in_lat    NUMERIC(10,7),
  check_in_lng    NUMERIC(10,7),
  checked_out_at  TIMESTAMPTZ,
  check_out_lat   NUMERIC(10,7),
  check_out_lng   NUMERIC(10,7),
  photo_urls      JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- proof-of-care photos
  sos_triggered   BOOLEAN     NOT NULL DEFAULT false,
  sos_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_booking ON service_safety_sessions (booking_id);
CREATE INDEX IF NOT EXISTS idx_safety_provider ON service_safety_sessions (provider_id, status);

-- 5) Instant-book flags on provider profiles (Rover/Airbnb instant-book). Default
--    OFF; a provider only becomes instant-bookable once trust-cleared + opted in.
ALTER TABLE sitter_profiles ADD COLUMN IF NOT EXISTS instant_book_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sitter_profiles ADD COLUMN IF NOT EXISTS instant_book_min_trust INTEGER;
ALTER TABLE walker_profiles ADD COLUMN IF NOT EXISTS instant_book_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE walker_profiles ADD COLUMN IF NOT EXISTS instant_book_min_trust INTEGER;

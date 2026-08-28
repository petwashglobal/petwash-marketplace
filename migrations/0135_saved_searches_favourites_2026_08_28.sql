-- CEO MASTER DIRECTIVE 2026-08-28 §7 §9 §10 (Journey Brain Phase 3)
--
-- SAVED SEARCHES + FAVOURITE PROVIDERS. Rover-quality journey continuity.
--
-- CEO §7:
--   Customer searches Walker for Bruno / 60m / Tue 18:00 / Kfar Saba /
--   ₪70–110, then leaves. Next visit: "Still looking for a walk for
--   Bruno on Tuesday?" [Continue search]. Don't force them to rebuild
--   seven filters.
--
-- CEO §9 / §10:
--   Save favourite providers. Repeat customer + past provider =
--   surface "Book Maya again" above random providers on matching
--   dates. Rebook prefill (pet / service / duration / location).
--
-- Both stores are OWNER-scoped by Firebase UID. The AI concierge may
-- READ them to render prompts; the wizard is the resume authority.
-- Neither table is a source of truth for money, pricing, or
-- eligibility — those stay on the canonical marketplace tables.

CREATE TABLE IF NOT EXISTS saved_searches (
  id             SERIAL PRIMARY KEY,
  search_id      VARCHAR(64) UNIQUE NOT NULL,
  user_uid       VARCHAR(200)       NOT NULL,
  domain         VARCHAR(64)        NOT NULL,     -- walk / sitter / academy / marketplace / shop
  filters        JSONB              NOT NULL DEFAULT '{}'::jsonb,
  label          VARCHAR(200),
  last_used_at   TIMESTAMPTZ        NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ        NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ
);

-- One recent saved search per (user, domain) — a new query overwrites
-- the previous. The wizard route does an UPSERT on this key so the
-- table doesn't accumulate stale searches. A "history" model can layer
-- on top later without another migration (add a saved_search_history
-- audit table).
CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_user_domain_uniq
  ON saved_searches (user_uid, domain);

CREATE INDEX IF NOT EXISTS saved_searches_user_idx
  ON saved_searches (user_uid, last_used_at DESC);

-- ── FAVOURITE PROVIDERS ──────────────────────────────────────────────
--
-- Rover: save a walker / sitter / trainer. Next Tuesday, if Maya is
-- free for the same slot, PetWash ranks her above random providers.
--
-- provider_id is a wide varchar so both walker uids and sitter uids
-- fit. domain names the service (walk / sitter / academy). A single
-- physical human providing walk + sitter gets two favourite rows if
-- the customer added both — they are distinct product surfaces.
CREATE TABLE IF NOT EXISTS favourite_providers (
  id             SERIAL PRIMARY KEY,
  user_uid       VARCHAR(200) NOT NULL,
  provider_id    VARCHAR(200) NOT NULL,
  domain         VARCHAR(64)  NOT NULL,
  added_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- UNIQUE (user, provider, domain) — starring a provider twice is a
-- no-op, not a stack of rows.
CREATE UNIQUE INDEX IF NOT EXISTS favourite_providers_user_provider_domain_uniq
  ON favourite_providers (user_uid, provider_id, domain);

CREATE INDEX IF NOT EXISTS favourite_providers_user_idx
  ON favourite_providers (user_uid, added_at DESC);

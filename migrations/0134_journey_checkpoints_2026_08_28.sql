-- CEO MASTER DIRECTIVE 2026-08-28 §11 §12 §13 §28 §34 (Journey Brain Phase 2)
--
-- "We saved your booking with Maya." The customer opened the booking
-- wizard, picked a walker, picked a slot, then their battery died at
-- the payment preview screen. Today the wizard has no server-side
-- memory of that state — on next login, they start over. CEO §12
-- specifically forbids "just show Pay again" after a phone crash; the
-- server must resolve the actual transaction state and resume from
-- the safe step.
--
-- This migration introduces the JOURNEY CHECKPOINT store. One row per
-- in-flight customer journey, keyed on a stable journeyId (server-
-- assigned uuid). The wizard writes a checkpoint at each safe step;
-- next login the resume endpoint reads the newest non-expired
-- checkpoint per domain and re-hydrates the wizard state.
--
-- Design invariants:
--   * user_uid is the OWNER — Firebase UID, never trusted from the body
--   * domain names the flow (walk_booking / sitter_booking / academy /
--     shop_checkout / provider_apply / egift_purchase / …).
--   * state is a STAGE label, not a payload dump (e.g.
--     PROVIDER_SELECTED, DETAILS_ENTERED, PAYMENT_PREVIEW). The
--     payload lives in the JSONB `snapshot` — deliberately tokenised
--     so a schema shift doesn't require a migration.
--   * last_safe_step is the STAGE we can resume from without side
--     effects. A CEO §12-safe stage — never PAYMENT_STARTED with an
--     external side effect that might have completed.
--   * expires_at is enforced by the reader (checkpoints beyond expiry
--     do not resume). A nightly job may clean them up.
--   * entity_ref is an OPTIONAL business-entity hint (walkerId,
--     bookingRequestId) so a resume lookup can also find a checkpoint
--     when the customer was mid-flow on a specific provider.
--
-- The AI concierge NEVER writes this table. The wizard's server route
-- writes and reads it as canonical truth. AI (CEO §36) may READ the
-- newest checkpoint and render "still looking at Maya?" copy, but the
-- ACTION link resolves through the wizard route.

CREATE TABLE IF NOT EXISTS journey_checkpoints (
  id              SERIAL PRIMARY KEY,
  journey_id      VARCHAR(64) UNIQUE NOT NULL,
  user_uid        VARCHAR(200)      NOT NULL,
  domain          VARCHAR(64)       NOT NULL,
  entity_ref      VARCHAR(200),
  state           VARCHAR(64)       NOT NULL,
  last_safe_step  VARCHAR(64)       NOT NULL,
  snapshot        JSONB             NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ       NOT NULL
);

-- One active checkpoint per (user, domain) — a fresh flow supersedes
-- the older one. The wizard route does an UPSERT on this key.
CREATE UNIQUE INDEX IF NOT EXISTS journey_checkpoints_user_domain_uniq
  ON journey_checkpoints (user_uid, domain);

-- The attention-feed reader hits (user_uid) + expires_at > now(), so
-- an index accelerates the resume probe.
CREATE INDEX IF NOT EXISTS journey_checkpoints_user_idx
  ON journey_checkpoints (user_uid, expires_at);

-- Domain-wide cleanup + analytics.
CREATE INDEX IF NOT EXISTS journey_checkpoints_domain_idx
  ON journey_checkpoints (domain, updated_at);

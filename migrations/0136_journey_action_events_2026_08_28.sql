-- CEO MASTER DIRECTIVE 2026-08-28 §24 §25 §66 §67 §68 (Journey Brain Phase 6)
--
-- Personalization feedback / adaptive-timing telemetry.
--
-- For every proactive NextBestAction card, retain:
--   * reasonCode         (WHY the server picked it)
--   * event_type         (shown / clicked / dismissed / not_interested /
--                         forget_reason / completed)
--   * source signal      (short label — e.g. "attention:egift")
--   * recommended action (actionType label — pay / rebook / review …)
--   * entityRef?         (booking id / voucher id / provider id)
--
-- Explicitly NOT stored:
--   * raw LLM chain-of-thought
--   * arbitrary free-text
--   * cross-user references
--
-- The composer eventually reads aggregates ("this user consistently
-- dismisses PRESTIGE_BENEFIT_AVAILABLE — down-rank it") and the
-- proactive-timing engine uses shown/click ratios to pick QUIET hours.
--
-- Retention: 365 days for aggregates. A per-user forget path deletes
-- individual rows on demand (§55 "Forget this preference").

CREATE TABLE IF NOT EXISTS journey_action_events (
  id                 SERIAL PRIMARY KEY,
  event_id           VARCHAR(64) UNIQUE NOT NULL,
  user_uid           VARCHAR(200) NOT NULL,
  actor              VARCHAR(20)  NOT NULL,        -- 'pet_parent' | 'provider'
  reason_code        VARCHAR(64)  NOT NULL,
  event_type         VARCHAR(32)  NOT NULL,        -- shown | clicked | dismissed | not_interested | forget_reason | completed
  action_type        VARCHAR(32),
  source             VARCHAR(64),
  entity_ref         VARCHAR(200),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rank-and-dismiss lookups by (user, reason_code, event_type).
CREATE INDEX IF NOT EXISTS journey_action_events_user_reason_idx
  ON journey_action_events (user_uid, reason_code, event_type);

-- Composer's "recently dismissed" probe — read last 90 days per user.
CREATE INDEX IF NOT EXISTS journey_action_events_user_created_idx
  ON journey_action_events (user_uid, created_at DESC);

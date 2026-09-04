-- Journey Brain Phase 6 · post-release 2026-09-04
--
-- next_best_action_feedback — durable telemetry for user reactions
-- to the NextBestActionCard: acted, dismissed, "not interested",
-- "fewer offers like this". The composer (nextBestAction.ts) can
-- read recent negative feedback and suppress the same actionKey
-- for a cooldown window so we never nag.
--
-- Design notes:
--   * `user_uid` = server-verified Firebase uid (never body-supplied).
--   * `action_key` = a stable identity per action the composer emits:
--       - AttentionItem  → `attn:<id>`
--       - ResumeAction   → `resume:<domain>`
--     Never the raw payload; never a payment-truth reference.
--   * `verdict` = the closed enum (act, dismiss, not_interested,
--     fewer_like_this). App code owns the enum; SQL stores it as
--     text to keep the migration boring.
--   * TTL: retained 90 days for personalization signals. A cron
--     prunes older rows.
--
-- This migration is IDEMPOTENT — safe to replay on the self-healing
-- migration gate. Composite index avoids the volatile `now()` in
-- partial-index predicate that migration 0144 hit.

CREATE TABLE IF NOT EXISTS next_best_action_feedback (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_uid       text        NOT NULL,
  action_key     text        NOT NULL,
  verdict        text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Query pattern: WHERE user_uid = $1 AND created_at > now() - interval '<X>'
-- The composite index avoids the volatile-predicate pitfall (0144 lesson).
CREATE INDEX IF NOT EXISTS idx_nba_feedback_uid_created
  ON next_best_action_feedback (user_uid, created_at DESC);

-- Pruner index — used by the retention job.
CREATE INDEX IF NOT EXISTS idx_nba_feedback_created
  ON next_best_action_feedback (created_at);

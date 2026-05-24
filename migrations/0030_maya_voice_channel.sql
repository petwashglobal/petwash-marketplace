-- Migration: 0030_maya_voice_channel
--
-- PR: Maya Voice Stage 3A — add 'phone' channel + voice columns
-- Branch: claude/maya-stage-3a-voice
--
-- Adds voice support to maya_conversations:
--   - extends the channel CHECK to include 'phone'
--   - adds 6 nullable voice columns (default NULL — Stage 1b/2 reads/writes
--     don't notice)
--
-- Fully ADDITIVE — no existing column changes meaning, no row migration
-- needed. Stage 1b/2 code continues to work because:
--   - the new CHECK is a superset of the old: ('web','admin','test','phone')
--   - every new column is nullable
--
-- Maya cannot do anything voice-related at runtime until
-- ff.maya.voice.enabled = true (default OFF).
--
-- Rollback (commented at bottom): drops the new columns and restores the
-- original CHECK constraint.

BEGIN;

-- 1. Extend channel CHECK to include 'phone'.
ALTER TABLE maya_conversations
  DROP CONSTRAINT IF EXISTS maya_conversations_channel_check;
ALTER TABLE maya_conversations
  ADD CONSTRAINT maya_conversations_channel_check
  CHECK (channel IN ('web','admin','test','phone'));

-- 2. Add voice columns (all nullable, all default NULL).
ALTER TABLE maya_conversations
  ADD COLUMN IF NOT EXISTS voice_provider      varchar(20),
  ADD COLUMN IF NOT EXISTS external_call_sid   varchar(128),
  ADD COLUMN IF NOT EXISTS call_started_at     timestamptz,
  ADD COLUMN IF NOT EXISTS call_ended_at       timestamptz,
  ADD COLUMN IF NOT EXISTS recording_consent   boolean,
  ADD COLUMN IF NOT EXISTS recording_url       text;

CREATE INDEX IF NOT EXISTS idx_maya_conversations_call_sid
  ON maya_conversations (external_call_sid)
  WHERE external_call_sid IS NOT NULL;

COMMIT;

-- ============================================================================
-- ROLLBACK (uncomment to revert)
-- ============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_maya_conversations_call_sid;
-- ALTER TABLE maya_conversations
--   DROP COLUMN IF EXISTS recording_url,
--   DROP COLUMN IF EXISTS recording_consent,
--   DROP COLUMN IF EXISTS call_ended_at,
--   DROP COLUMN IF EXISTS call_started_at,
--   DROP COLUMN IF EXISTS external_call_sid,
--   DROP COLUMN IF EXISTS voice_provider;
-- ALTER TABLE maya_conversations
--   DROP CONSTRAINT IF EXISTS maya_conversations_channel_check;
-- ALTER TABLE maya_conversations
--   ADD CONSTRAINT maya_conversations_channel_check
--   CHECK (channel IN ('web','admin','test'));
-- COMMIT;

-- 0035 — Maya WhatsApp channel
--
-- BACKGROUND
-- Maya now has an inbound WhatsApp lead-bot (server/routes/maya-whatsapp.ts).
-- maya_conversations.channel is constrained to ('web','admin','test','phone')
-- (the 'phone' value was added in 0030 for voice). This migration widens the
-- CHECK to also allow 'whatsapp' so WhatsApp conversations can be stored.
--
-- Purely additive (constraint widening). No data is changed. Idempotent: the
-- constraint is dropped IF EXISTS and re-added.
--
-- ROLLBACK
--   ALTER TABLE maya_conversations DROP CONSTRAINT IF EXISTS maya_conversations_channel_chk;
--   ALTER TABLE maya_conversations ADD CONSTRAINT maya_conversations_channel_chk
--     CHECK (channel IN ('web','admin','test','phone'));

ALTER TABLE maya_conversations
  DROP CONSTRAINT IF EXISTS maya_conversations_channel_chk;

ALTER TABLE maya_conversations
  ADD CONSTRAINT maya_conversations_channel_chk
  CHECK (channel IN ('web','admin','test','phone','whatsapp'));

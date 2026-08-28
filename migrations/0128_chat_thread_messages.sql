-- 0128_chat_thread_messages.sql
--
-- Completes the CEO Communication Hub spine (migration 0084 introduced
-- chat_threads; this adds the missing per-thread message table).
--
-- The chat_threads table already reserves the PAW_FINDER thread type
-- (shared/schema-chat.ts:394 CHAT_THREAD_TYPES, server/services/
-- chatThreadService.ts:23 REQUIRED_ANCHOR = caseId) — but a thread
-- without messages is a shell. This table is the missing half.
--
-- Reused for every non-booking thread the platform surfaces need
-- (support, incidents, K9000, PAW_FINDER, shop, gifts, provider
-- applications, franchise, admin). Booking chats keep using the older,
-- booking-scoped booking_conversations / booking_messages tables (their
-- unique(booking_id) FK + booking-status gating do not port over).

CREATE TABLE IF NOT EXISTS chat_thread_messages (
  id                BIGSERIAL PRIMARY KEY,
  thread_id         VARCHAR   NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
  sender_uid        VARCHAR   NOT NULL,          -- Firebase UID of the sender
  sender_role       VARCHAR   NOT NULL DEFAULT 'user', -- 'user' | 'system' | 'admin'
  body              TEXT      NOT NULL,          -- sanitized message body
  attachments       JSONB     NOT NULL DEFAULT '[]'::jsonb, -- [{url,mime,sizeBytes,name}]
  read_at           TIMESTAMPTZ,                 -- earliest time ANY other participant read
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The hot path is "give me the last N messages for this thread, newest first"
-- (chat renders bottom-up, paginates upward). Composite index avoids two
-- separate lookups on load.
CREATE INDEX IF NOT EXISTS idx_chat_thread_messages_thread_created
  ON chat_thread_messages (thread_id, created_at DESC);

-- Per-sender activity read for admin audits / rate-limit checks.
CREATE INDEX IF NOT EXISTS idx_chat_thread_messages_sender_created
  ON chat_thread_messages (sender_uid, created_at DESC);

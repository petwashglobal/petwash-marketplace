-- 0104_chat_threads_ensure.sql
-- Guarantee the Communication Hub spine (chat_threads) is live in production.
--
-- WHY: chat_threads was introduced in 0084, which sits BELOW the deploy
-- migration baseline (88). The self-healing gate only auto-applies migrations
-- numbered ABOVE the baseline, so 0084 is soft-skipped as assumed-applied. If it
-- was never actually applied in prod, the smart inbox (GET /api/inbox/v2/threads,
-- inbox-v2.ts) throws → returns an empty thread list, and PetWashInbox silently
-- falls back to basic booking chats instead of the entity-linked "smart" feed.
--
-- This re-issues the 0084 DDL above the baseline so the gate applies it. It is
-- 100% idempotent (every statement is IF NOT EXISTS) — a pure no-op when the
-- table already exists, and the missing spine when it doesn't. No data change.

CREATE TABLE IF NOT EXISTS chat_threads (
  id                     SERIAL PRIMARY KEY,
  thread_id              VARCHAR NOT NULL UNIQUE,
  thread_type            VARCHAR NOT NULL,

  booking_id             VARCHAR,
  case_id                VARCHAR,
  order_id               VARCHAR,
  gift_id                VARCHAR,
  station_id             VARCHAR,
  application_id         VARCHAR,
  pet_id                 VARCHAR,

  customer_user_id       VARCHAR,
  provider_user_id       VARCHAR,
  support_owner_id       VARCHAR,

  status                 VARCHAR NOT NULL DEFAULT 'active',
  unread_customer_count  INTEGER NOT NULL DEFAULT 0,
  unread_provider_count  INTEGER NOT NULL DEFAULT 0,
  unread_admin_count     INTEGER NOT NULL DEFAULT 0,

  last_message_at        TIMESTAMP,
  archived_at            TIMESTAMP,
  created_at             TIMESTAMP DEFAULT NOW(),
  updated_at             TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads (thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_type      ON chat_threads (thread_type);
CREATE INDEX IF NOT EXISTS idx_chat_threads_booking   ON chat_threads (booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_case      ON chat_threads (case_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_order     ON chat_threads (order_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_customer  ON chat_threads (customer_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_provider  ON chat_threads (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status    ON chat_threads (status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last_msg  ON chat_threads (last_message_at);

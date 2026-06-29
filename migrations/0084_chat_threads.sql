-- 0084_chat_threads.sql
-- Communication Hub spine: ONE entity-linked thread model. Every conversation
-- links to a real entity (thread_type picks the anchor). Additive; no data change.
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

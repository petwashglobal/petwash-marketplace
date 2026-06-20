-- Notification audit: notification_events + push_devices. ADDITIVE. 2026-06-21.
--
-- notification_events: one row per attempted send, recording whether consent was
-- checked and the outcome (§30א audit: "sent only after consent verified", or
-- blocked_no_consent). push_devices: canonical FCM token store (hashed + encrypted).

CREATE TABLE IF NOT EXISTS notification_events (
  id                  SERIAL PRIMARY KEY,
  user_id             VARCHAR(128),
  pet_id              VARCHAR(128),
  channel             VARCHAR(16)  NOT NULL,
  category            VARCHAR(16)  NOT NULL,
  template_key        VARCHAR(80),
  consent_checked     BOOLEAN      NOT NULL DEFAULT FALSE,
  consent_result      VARCHAR(24),
  consent_record_id   VARCHAR(128),
  destination_masked  VARCHAR(64),
  status              VARCHAR(24)  NOT NULL,
  provider_message_id VARCHAR(128),
  failure_reason      TEXT,
  metadata            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_events_user     ON notification_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_events_status   ON notification_events (status);
CREATE INDEX IF NOT EXISTS idx_notif_events_category ON notification_events (category);

CREATE TABLE IF NOT EXISTS push_devices (
  id               SERIAL PRIMARY KEY,
  user_id          VARCHAR(128) NOT NULL,
  device_type      VARCHAR(16),
  push_token_hash  VARCHAR(128) NOT NULL,
  token_encrypted  TEXT,
  device_name      VARCHAR(120),
  app_version      VARCHAR(40),
  locale           VARCHAR(16),
  timezone         VARCHAR(48),
  status           VARCHAR(16)  NOT NULL DEFAULT 'active',
  last_seen_at     TIMESTAMP,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_hash ON push_devices (push_token_hash);

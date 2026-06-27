-- 0082_conversion_rescue.sql — Booking Rescue / AI Conversion Monitoring foundation
-- (CEO master spec 2026-06-27). "No dead clicks, no lost leads."
--
-- ADDITIVE ONLY. Captures every started-but-stopped user intent → a lead the rescue
-- engine can remind/recover. This is the FOUNDATION (3 core tables); per-vertical
-- recovery tables (carts/gifts/paw-finder/k9000) and the reminder cron land in later
-- layers and reuse waitlist_entries + Deal Gate booking_status_events where possible.
-- No money columns move money — value_estimate is an analytics estimate only.
-- Apply via: gh workflow run petwash-ci.yml -f run_migrations=true.

-- ── §3. user_intent_events — every meaningful action (logged-in OR guest) ──────
CREATE TABLE IF NOT EXISTS user_intent_events (
  id                  SERIAL PRIMARY KEY,
  event_key           VARCHAR NOT NULL,        -- UIE-{ts}-{rand}
  user_id             VARCHAR,                 -- Firebase UID (null if guest)
  guest_id            VARCHAR,                 -- anonymous id
  session_id          VARCHAR,
  platform_key        VARCHAR,                 -- SITTER_SUITE|WALK_MY_PET|ACADEMY|SHOP|GIFT|PAW_FINDER|PETTREK|K9000
  event_type          VARCHAR NOT NULL,        -- SERVICE_VIEWED … K9000_PAYMENT_FAILED (≈26 types)
  related_provider_id VARCHAR,
  related_booking_id  VARCHAR,
  related_pet_id      VARCHAR,
  related_product_id  VARCHAR,
  related_station_id  VARCHAR,
  city                VARCHAR,
  country             VARCHAR,
  device              VARCHAR,
  source_page         VARCHAR,
  metadata_json       JSONB,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intent_user ON user_intent_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_intent_guest ON user_intent_events (guest_id, created_at);
CREATE INDEX IF NOT EXISTS idx_intent_type ON user_intent_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_intent_booking ON user_intent_events (related_booking_id);

-- ── §8. conversion_leads — one lead per (user/guest, journey) ──────────────────
CREATE TABLE IF NOT EXISTS conversion_leads (
  id                  SERIAL PRIMARY KEY,
  lead_key            VARCHAR NOT NULL,        -- LEAD-{ts}-{rand}
  user_id             VARCHAR,
  guest_id            VARCHAR,
  platform_key        VARCHAR,
  lead_type           VARCHAR NOT NULL,        -- PET_SITTER_BOOKING … K9000_PAYMENT
  related_booking_id  VARCHAR,
  related_provider_id VARCHAR,
  score               INTEGER NOT NULL DEFAULT 0,
  status              VARCHAR NOT NULL DEFAULT 'NEW', -- NEW|ACTIVE|REMINDER_SENT|WAITING_PROVIDER|WAITING_CUSTOMER|PAYMENT_PENDING|RESCUED|CONVERTED|LOST|CLOSED
  value_estimate_cents INTEGER NOT NULL DEFAULT 0,    -- analytics estimate only (moves no money)
  city                VARCHAR,
  last_event_type     VARCHAR,
  last_action_at      TIMESTAMP,
  next_action_due_at  TIMESTAMP,
  reminders_sent      INTEGER NOT NULL DEFAULT 0,
  assigned_admin      VARCHAR,
  ai_summary          TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
-- One open lead per user/guest per booking/lead-type (dedup key).
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversion_lead_open
  ON conversion_leads (COALESCE(user_id, guest_id), lead_type, COALESCE(related_booking_id, ''));
CREATE INDEX IF NOT EXISTS idx_lead_status ON conversion_leads (status, next_action_due_at);
CREATE INDEX IF NOT EXISTS idx_lead_platform ON conversion_leads (platform_key, status);

-- ── conversion_recovery_events — every reminder/rescue send + delivery log ─────
-- Generic across booking/cart/gift/paw-finder/waitlist/K9000 (anti-spam §18 reads
-- this to cap sends). shadow_only while CONVERSION_RESCUE_ENABLED=false.
CREATE TABLE IF NOT EXISTS conversion_recovery_events (
  id              SERIAL PRIMARY KEY,
  lead_id         INTEGER,
  user_id         VARCHAR,
  guest_id        VARCHAR,
  platform_key    VARCHAR,
  stage           VARCHAR NOT NULL,    -- e.g. provider_no_reply_2h | accepted_no_pay_30m | cart_2h
  channel         VARCHAR NOT NULL,    -- push | sms | email | in_app
  template_key    VARCHAR,
  shadow_only     BOOLEAN NOT NULL DEFAULT TRUE,
  delivery_status VARCHAR NOT NULL DEFAULT 'queued', -- queued|sent|delivered|failed|suppressed
  failure_reason  VARCHAR,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recovery_lead ON conversion_recovery_events (lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_recovery_dedup ON conversion_recovery_events (lead_id, stage, channel);

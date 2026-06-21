-- 0068_membership_cards.sql
-- Membership credential system: one card per user (physical + wallet + QR), plus
-- an append-only scan log. Additive; safe to apply anytime.

CREATE TABLE IF NOT EXISTS membership_cards (
  id                       serial PRIMARY KEY,
  user_id                  varchar(128) NOT NULL UNIQUE,
  member_id                varchar(32)  NOT NULL UNIQUE,
  card_number_display      varchar(32)  NOT NULL,
  qr_token                 varchar(64)  NOT NULL UNIQUE,
  barcode_value            varchar(40)  NOT NULL UNIQUE,
  card_status              varchar(16)  NOT NULL DEFAULT 'active',
  tier                     varchar(16)  NOT NULL DEFAULT 'standard',
  valid_from               timestamp    NOT NULL DEFAULT now(),
  valid_until              timestamp,
  wash_credit_balance      integer      NOT NULL DEFAULT 0,
  loyalty_points           integer      NOT NULL DEFAULT 0,
  linked_nayax_customer_id varchar(128),
  linked_nayax_card_id     varchar(128),
  last_scan_at             timestamp,
  last_used_station_id     varchar(64),
  frozen_reason            text,
  created_at               timestamp    NOT NULL DEFAULT now(),
  updated_at               timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_cards_user   ON membership_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_membership_cards_member ON membership_cards (member_id);
CREATE INDEX IF NOT EXISTS idx_membership_cards_status ON membership_cards (card_status);

CREATE TABLE IF NOT EXISTS card_scan_events (
  id          serial PRIMARY KEY,
  scan_id     varchar(40)  NOT NULL UNIQUE,
  user_id     varchar(128),
  member_id   varchar(32),
  station_id  varchar(64),
  provider_id varchar(128),
  scan_type   varchar(12)  NOT NULL,
  result      varchar(16)  NOT NULL,
  detail      text,
  created_at  timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_scan_member  ON card_scan_events (member_id);
CREATE INDEX IF NOT EXISTS idx_card_scan_created ON card_scan_events (created_at);

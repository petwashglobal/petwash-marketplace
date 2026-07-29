-- 0107_user_addresses_access_fields.sql
-- The saved-address book (user_addresses) was created by drizzle-push only (no
-- migration file). Ensure it exists AND add the structured access fields
-- (floor, entrance, notes) + updated_at so an address is complete enough to
-- actually dispatch a sitter/walker/courier — free-text apartment alone was not.
-- All statements idempotent (safe no-op where push already provisioned). (2026-07-29)

CREATE TABLE IF NOT EXISTS user_addresses (
  id            serial PRIMARY KEY,
  user_id       varchar(128) NOT NULL,
  label         varchar(64) DEFAULT 'other',
  custom_label  varchar(80),
  address       text NOT NULL,
  street        varchar(200),
  street_number varchar(30),
  apartment     varchar(50),
  floor         varchar(30),
  entrance      varchar(30),
  notes         text,
  city          varchar(100),
  postal_code   varchar(20),
  lat           numeric(10,7),
  lng           numeric(10,7),
  is_default    boolean DEFAULT false,
  usage_count   integer NOT NULL DEFAULT 1,
  last_used_at  timestamp DEFAULT now(),
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);

-- For environments where the table already exists via drizzle-push without the
-- new columns.
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS floor varchar(30);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS entrance varchar(30);
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses (user_id);

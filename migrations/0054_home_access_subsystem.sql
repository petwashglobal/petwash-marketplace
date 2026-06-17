-- Home-access / property-authority subsystem (additive, safe). Backs the legal
-- requirement that a provider may not enter a customer's home without signed
-- authority, and that access details are encrypted + every view is logged.

-- 1) Customer property + (encrypted) access details.
CREATE TABLE IF NOT EXISTS customer_properties (
  id                              SERIAL PRIMARY KEY,
  property_id                     VARCHAR NOT NULL UNIQUE,     -- app-generated id
  customer_id                     VARCHAR NOT NULL,
  city                            VARCHAR,
  apartment_unit                  VARCHAR,
  property_type                   VARCHAR,
  address_encrypted               TEXT,                        -- AES-256-GCM
  access_method                   VARCHAR,                     -- meet/key/lockbox/code/doorman/other
  access_instructions_encrypted   TEXT,                        -- AES-256-GCM (codes/keys)
  alarm_disclosed                 BOOLEAN NOT NULL DEFAULT FALSE,
  cameras_disclosed               BOOLEAN NOT NULL DEFAULT FALSE,
  restricted_areas                TEXT,
  pets_allowed_confirmed          BOOLEAN NOT NULL DEFAULT FALSE,
  lease_building_rules_confirmed  BOOLEAN NOT NULL DEFAULT FALSE,
  other_occupants_informed_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  authority_declaration_signed    BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_contact_id            VARCHAR,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_properties_customer ON customer_properties(customer_id);

-- 2) Signed property-authority declarations (court-grade evidence per booking).
CREATE TABLE IF NOT EXISTS property_authority_declarations (
  id                 SERIAL PRIMARY KEY,
  declaration_id     VARCHAR NOT NULL UNIQUE,
  customer_id        VARCHAR NOT NULL,
  property_id        VARCHAR NOT NULL,
  booking_id         VARCHAR,
  consent_record_id  VARCHAR,
  typed_full_name    VARCHAR NOT NULL,
  document_version   VARCHAR NOT NULL,
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address         VARCHAR,
  user_agent         VARCHAR,
  status             VARCHAR NOT NULL DEFAULT 'signed'
);
CREATE INDEX IF NOT EXISTS idx_property_authority_customer ON property_authority_declarations(customer_id);
CREATE INDEX IF NOT EXISTS idx_property_authority_booking ON property_authority_declarations(booking_id);

-- 3) Every view of access details is logged (who/when/why).
CREATE TABLE IF NOT EXISTS home_access_logs (
  id               SERIAL PRIMARY KEY,
  access_log_id    VARCHAR NOT NULL UNIQUE,
  booking_id       VARCHAR NOT NULL,
  property_id      VARCHAR NOT NULL,
  provider_id      VARCHAR,
  viewed_by_user_id VARCHAR NOT NULL,
  reason           VARCHAR,
  ip_address       VARCHAR,
  user_agent       VARCHAR,
  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_home_access_logs_booking ON home_access_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_home_access_logs_provider ON home_access_logs(provider_id);

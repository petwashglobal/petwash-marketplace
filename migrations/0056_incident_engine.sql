-- Marketplace incident engine + emergency-vet authorization (additive).
-- Critical incidents auto-escalate and FREEZE the related payout until resolved.

CREATE TABLE IF NOT EXISTS incident_reports (
  id                    SERIAL PRIMARY KEY,
  incident_id           VARCHAR NOT NULL UNIQUE,
  incident_type         VARCHAR NOT NULL,
  severity              VARCHAR NOT NULL DEFAULT 'medium',  -- low|medium|high|critical (post-escalation)
  status                VARCHAR NOT NULL DEFAULT 'open',    -- open|investigating|resolved|closed
  description           TEXT,
  -- links
  member_id             VARCHAR,
  pet_id                VARCHAR,
  provider_id           VARCHAR,
  booking_id            VARCHAR,
  station_id            VARCHAR,
  wash_session_id       VARCHAR,
  payment_id            VARCHAR,
  -- evidence + handling
  photo_urls            TEXT,                               -- JSON array
  notes                 TEXT,
  emergency_contact_called BOOLEAN NOT NULL DEFAULT FALSE,
  vet_contacted         BOOLEAN NOT NULL DEFAULT FALSE,
  authority_contacted   BOOLEAN NOT NULL DEFAULT FALSE,
  payout_hold           BOOLEAN NOT NULL DEFAULT FALSE,
  reported_by           VARCHAR,
  admin_owner           VARCHAR,
  resolution            TEXT,
  reported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incident_booking ON incident_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_incident_provider ON incident_reports(provider_id);
CREATE INDEX IF NOT EXISTS idx_incident_status ON incident_reports(status);

-- Emergency-vet authorization (customer pre-authorises urgent vet contact;
-- customer remains responsible for costs unless a written program applies).
CREATE TABLE IF NOT EXISTS emergency_vet_authorizations (
  id                 SERIAL PRIMARY KEY,
  authorization_id   VARCHAR NOT NULL UNIQUE,
  booking_id         VARCHAR,
  customer_id        VARCHAR NOT NULL,
  pet_id             VARCHAR,
  authorized         BOOLEAN NOT NULL DEFAULT FALSE,
  vet_contact        VARCHAR,
  cost_responsibility_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  consent_record_id  VARCHAR,
  document_version   VARCHAR,
  signed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address         VARCHAR,
  user_agent         VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_emergency_vet_booking ON emergency_vet_authorizations(booking_id);

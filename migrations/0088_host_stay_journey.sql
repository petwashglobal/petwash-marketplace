-- 0088_host_stay_journey.sql
-- Host Stay Booking Journey (CEO 2026-07-02/03) — completes the Pet Sitter Suite
-- lifecycle beyond "paid": care details, handover confirmation, readiness.
-- Reference case: the founder's real host-stay booking for Kenzo.
--
-- ADDITIVE ONLY — two new tables, no ALTER on existing tables. The checklist is
-- COMPUTED from these rows at read time (single source of truth, no drift), so
-- there is deliberately no separate checklist table.

-- ── 1. host_stay_details — one row per booking (the care/handover data pack) ──
CREATE TABLE IF NOT EXISTS host_stay_details (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id       INTEGER NOT NULL UNIQUE
                             REFERENCES booking_requests(id) ON DELETE CASCADE,
  request_id               VARCHAR(24) NOT NULL,           -- public ref (denormalized)
  owner_id                 VARCHAR(128) NOT NULL,
  -- HOST_HOME (pet → provider home) | CUSTOMER_HOME (provider → customer home)
  -- | WALK | ACADEMY
  flow_type                VARCHAR(20) NOT NULL DEFAULT 'HOST_HOME',

  -- Logistics
  pickup_at                TIMESTAMP,
  dropoff_at               TIMESTAMP,
  meeting_location         TEXT,

  -- Safety contacts
  emergency_contact_name   VARCHAR(160),
  emergency_contact_phone  VARCHAR(40),
  vet_name                 VARCHAR(160),
  vet_phone                VARCHAR(40),

  -- Care
  food_instructions        TEXT,
  medication               TEXT,
  medication_dosage        TEXT,
  allergies                TEXT,
  behaviour_notes          TEXT,          -- anxiety / escape / other pets / children
  special_instructions     TEXT,

  -- Provider-side readiness (HOST_HOME): safe sleeping area, other animals
  -- separated, food/med reviewed, emergency saved, pickup/dropoff agreed,
  -- incident protocol accepted — stored as a keyed object for flexibility.
  provider_home_ready      BOOLEAN NOT NULL DEFAULT FALSE,
  provider_readiness       JSONB,

  extra                    JSONB,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hsd_booking_request_id ON host_stay_details(booking_request_id);
CREATE INDEX IF NOT EXISTS idx_hsd_owner_id           ON host_stay_details(owner_id);

-- ── 2. booking_handover_events — dropoff at start, pickup at end ───────────────
CREATE TABLE IF NOT EXISTS booking_handover_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id       INTEGER NOT NULL
                             REFERENCES booking_requests(id) ON DELETE CASCADE,
  request_id               VARCHAR(24) NOT NULL,
  direction                VARCHAR(10) NOT NULL,            -- DROPOFF | PICKUP
  confirmed_by_role        VARCHAR(16) NOT NULL,            -- owner | provider
  confirmed_by_uid         VARCHAR(128) NOT NULL,
  notes                    TEXT,
  photo_url                TEXT,
  occurred_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bhe_booking_request_id ON booking_handover_events(booking_request_id);
CREATE INDEX IF NOT EXISTS idx_bhe_direction          ON booking_handover_events(booking_request_id, direction);

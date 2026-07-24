-- 0102: staff — the HR/staff roster (CEO 2026-07-24 "hr staff"). No staff table
-- existed anywhere in prod; this is the greenfield foundation for the admin HR
-- module. Real employee records; PII (phone/email) lives here plainly for now
-- (internal admin-only surface) — encrypt in a follow-up if the roster grows.
CREATE TABLE IF NOT EXISTS staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     text NOT NULL,
  role          text NOT NULL DEFAULT 'attendant',   -- attendant | technician | manager | support | ops | other
  station_code  text,                                 -- links to the station registry (PWS-IL-KFS-###); null = HQ/roaming
  phone         text,
  email         text,
  employment    text NOT NULL DEFAULT 'part_time',    -- full_time | part_time | contractor
  pay_type      text NOT NULL DEFAULT 'hourly',       -- hourly | monthly
  pay_rate_ils  integer NOT NULL DEFAULT 0,           -- agorot: ₪/hour (hourly) or ₪/month (monthly)
  status        text NOT NULL DEFAULT 'active',       -- active | on_leave | inactive
  hired_at      date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_status_idx  ON staff (status);
CREATE INDEX IF NOT EXISTS staff_station_idx ON staff (station_code);

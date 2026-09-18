-- Stations live in the DATABASE, not in a code array (2026-09-18).
--
-- server/lib/stationRegistry.ts was a literal two-row array, so opening a
-- station anywhere else in Israel needed a code change and a deploy. The
-- enterprise pet_wash_stations table could not be used: NOT NULL FKs to
-- countries + franchise_territories, both empty. station_registry (drizzle,
-- shared/schema-corporate.ts) has no such FKs — but it was only ever created by
-- drizzle push, so this migration creates it if it is missing and seeds the two
-- real Kfar Saba stations with the CEO-confirmed text the code array carried.
CREATE TABLE IF NOT EXISTS station_registry (
  id                    serial PRIMARY KEY,
  station_id            varchar NOT NULL UNIQUE,
  station_name          varchar NOT NULL,
  station_name_he       varchar,
  address               text NOT NULL,
  city                  varchar NOT NULL,
  region                varchar,
  country               varchar NOT NULL DEFAULT 'IL',
  postal_code           varchar,
  coordinates           jsonb,
  station_type          varchar DEFAULT 'k9000',
  ownership_type        varchar NOT NULL,
  franchisee_id         integer,
  operating_status      varchar DEFAULT 'active',
  install_date          date,
  last_maintenance_date date,
  next_maintenance_date date,
  qr_code               text,
  nayax_terminal_id     varchar,
  equipment_serial      varchar,
  monthly_revenue       numeric(10,2) DEFAULT '0',
  total_washes          integer DEFAULT 0,
  average_rating        numeric(3,2) DEFAULT '0',
  photo_urls            jsonb,
  operating_hours       jsonb,
  is_active             boolean DEFAULT true,
  created_at            timestamp DEFAULT now(),
  updated_at            timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_station_registry_city    ON station_registry (city);
CREATE INDEX IF NOT EXISTS idx_station_registry_country ON station_registry (country);
CREATE INDEX IF NOT EXISTS idx_station_registry_status  ON station_registry (operating_status);

-- Fields the customer-facing registry needs that the drizzle table lacks.
ALTER TABLE station_registry ADD COLUMN IF NOT EXISTS bays        jsonb;   -- [{machineId, terminalId, label}]
ALTER TABLE station_registry ADD COLUMN IF NOT EXISTS hours_he    varchar; -- printed opening hours
ALTER TABLE station_registry ADD COLUMN IF NOT EXISTS access_he   text;    -- on-site directions (CEO-confirmed)
ALTER TABLE station_registry ADD COLUMN IF NOT EXISTS access_en   text;

INSERT INTO station_registry (
  station_id, station_name, station_name_he, address, city, country, postal_code,
  coordinates, ownership_type, operating_status, is_active, bays, hours_he, access_he, access_en
) VALUES
  ('PWS-IL-KFS-001', 'Isaac Wald Park, Kfar Saba', 'פארק יצחק ולד, כפר סבא',
   'רחוב ויצמן 185, כפר סבא (מיקוד 4439654)', 'כפר סבא', 'IL', '4439654',
   '{"lat":32.179964,"lng":34.925016}'::jsonb, 'corporate', 'active', true,
   '[{"machineId":"182443","terminalId":"369617593","label":"תא ימין"},{"machineId":"182462","terminalId":"188843334","label":"תא שמאל"}]'::jsonb,
   'כל יום 05:30–23:00',
   'בתוך הפארק, ליד החניון הראשי; חניה במקום בתשלום (כחול-לבן), ומשם הליכה קצרה אל העמדה.',
   'Inside the park, next to the main parking lot; paid on-site parking (blue-and-white), then a short walk to the bay.'),
  ('PWS-IL-KFS-002', 'Green Kfar Saba', 'כפר סבא הירוקה',
   'כפר סבא הירוקה, פארק 80, כפר סבא', 'כפר סבא', 'IL', NULL,
   '{"lat":32.1982242,"lng":34.892436}'::jsonb, 'corporate', 'active', true,
   '[]'::jsonb,
   'פתוחה 24/7',
   'ממש בכניסה לפארק, ליד קיוסק הקפה; העמדה נראית מהכניסה.',
   'Right at the park entrance, beside the coffee kiosk; the bay is visible from the entrance.')
ON CONFLICT (station_id) DO NOTHING;

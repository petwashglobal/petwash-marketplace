-- 0105_octopus_tables_ensure.sql
-- The five octopus_* tables (providers, wallets, bookings, ledger, invoices) were
-- only ever created by `drizzle-push`, never by a migration file. The production
-- deploy gate applies MIGRATION FILES, so it could not guarantee these tables
-- exist — yet octopus_ledger is written on every sitter/walk/academy/booking
-- creation and read by the /admin/octopus tower ("sales today"). A missing table =
-- 500s on writes + a silently wrong tower. This migration makes their existence
-- guaranteed. Every statement is IF NOT EXISTS, so it is a safe no-op on any
-- environment drizzle-push already provisioned. (2026-07-27, audit finding #6)

CREATE TABLE IF NOT EXISTS octopus_providers (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          varchar UNIQUE NOT NULL,
  city             varchar NOT NULL,
  city_normalized  varchar NOT NULL,
  services         jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating           real DEFAULT 5,
  approved         boolean NOT NULL DEFAULT false,
  visible          boolean NOT NULL DEFAULT false,
  created_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_octopus_provider_city ON octopus_providers (city_normalized);
CREATE INDEX IF NOT EXISTS idx_octopus_provider_approved ON octopus_providers (approved);
CREATE INDEX IF NOT EXISTS idx_octopus_provider_user ON octopus_providers (user_id);

CREATE TABLE IF NOT EXISTS octopus_wallets (
  id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           varchar UNIQUE NOT NULL,
  balance           integer NOT NULL DEFAULT 0,
  petwash_credits   integer NOT NULL DEFAULT 0,
  petsitter_credits integer NOT NULL DEFAULT 0,
  pettrek_credits   integer NOT NULL DEFAULT 0,
  academy_credits   integer NOT NULL DEFAULT 0,
  created_at        timestamp DEFAULT now(),
  updated_at        timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS octopus_bookings (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  platform         varchar NOT NULL,
  status           varchar NOT NULL DEFAULT 'DRAFT',
  user_id          varchar NOT NULL,
  provider_id      varchar,
  price            integer NOT NULL,
  platform_fee     integer NOT NULL,
  provider_share   integer NOT NULL,
  idempotency_key  varchar UNIQUE,
  created_at       timestamp DEFAULT now(),
  updated_at       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_octopus_booking_user ON octopus_bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_octopus_booking_provider ON octopus_bookings (provider_id);
CREATE INDEX IF NOT EXISTS idx_octopus_booking_platform ON octopus_bookings (platform);
CREATE INDEX IF NOT EXISTS idx_octopus_booking_status ON octopus_bookings (status);

CREATE TABLE IF NOT EXISTS octopus_ledger (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  type        varchar NOT NULL,
  booking_id  varchar,
  wallet_id   varchar,
  amount      integer NOT NULL,
  platform    varchar,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_octopus_ledger_booking ON octopus_ledger (booking_id);
CREATE INDEX IF NOT EXISTS idx_octopus_ledger_wallet ON octopus_ledger (wallet_id);
CREATE INDEX IF NOT EXISTS idx_octopus_ledger_type ON octopus_ledger (type);
CREATE INDEX IF NOT EXISTS idx_octopus_ledger_platform ON octopus_ledger (platform);

CREATE TABLE IF NOT EXISTS octopus_invoices (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id         varchar UNIQUE NOT NULL,
  doc_number         varchar,
  allocation_number  varchar,
  created_at         timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_octopus_invoice_booking ON octopus_invoices (booking_id);

-- 0112: privilege_members — declare the former PHANTOM table (CTO P1-8, 2026-08-01)
--
-- This table was created at REQUEST time inside server/routes/privilege-loyalty.ts, so it
-- was invisible to migrations, schema-based backups, types, and CI. Move it here so it is
-- a first-class, tracked table. Mirrors shared/schema.ts `privilegeMembers` and the exact
-- DDL the route used. Idempotent — the table already exists in prod, so this is a no-op
-- there and only creates it on a fresh DB. Prefix >88 → auto-applies on push.

-- Backward-compat: rename the legacy table if it still exists under the old name.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vito_loyalty_members')
     AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'privilege_members') THEN
    ALTER TABLE vito_loyalty_members RENAME TO privilege_members;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS privilege_members (
  id SERIAL PRIMARY KEY,
  member_id VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  dob DATE,
  gender VARCHAR(30),
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  pets JSONB DEFAULT '[]',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  id_document_url TEXT,
  id_verified BOOLEAN DEFAULT FALSE,
  referral_source VARCHAR(100),
  referral_code VARCHAR(100),
  marketing_consent BOOLEAN DEFAULT TRUE,
  sms_consent BOOLEAN DEFAULT TRUE,
  terms_consent BOOLEAN DEFAULT TRUE,
  terms_consent_at TIMESTAMPTZ DEFAULT NOW(),
  language VARCHAR(10) DEFAULT 'en',
  tier VARCHAR(20) DEFAULT 'bronze',
  points INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  firebase_uid VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

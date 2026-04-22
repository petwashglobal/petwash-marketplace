-- Migration: add extended profile fields to the users table
-- These columns were referenced in the write path (user-profile.ts PATCH /api/user/profile)
-- but were missing from the schema, causing silent data loss for these fields.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "id_number"             varchar,
  ADD COLUMN IF NOT EXISTS "car_plate"             varchar,
  ADD COLUMN IF NOT EXISTS "car_plate_2"           varchar,
  ADD COLUMN IF NOT EXISTS "emergency_contact_name"  varchar,
  ADD COLUMN IF NOT EXISTS "emergency_contact_phone" varchar,
  ADD COLUMN IF NOT EXISTS "two_factor_enabled"    boolean NOT NULL DEFAULT false;

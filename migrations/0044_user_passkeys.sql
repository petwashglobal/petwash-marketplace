-- User Passkeys canonical store (SDD: docs/design/2026-05-25-smart-identity-routing.md)
-- ADDITIVE ONLY. One new table; no ALTER/DROP on existing tables; no data migration.
-- Replaces the split passkey storage (Firestore authenticators vs JSONB) with one
-- canonical table. Nothing reads it yet (gated behind ff.identity.unified.enabled, OFF).

CREATE TABLE IF NOT EXISTS "user_passkeys" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL,
  "credential_id" varchar(400) NOT NULL,
  "public_key" text NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "device_type" varchar(20),
  "backed_up" boolean NOT NULL DEFAULT false,
  "transports" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "aaguid" varchar(64),
  "label" varchar(120),
  "last_used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- One credential id is globally unique (a passkey belongs to exactly one record).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_passkeys_credential"
  ON "user_passkeys" ("credential_id");

CREATE INDEX IF NOT EXISTS "idx_user_passkeys_user"
  ON "user_passkeys" ("user_id");

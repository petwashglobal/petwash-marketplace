-- Identity Accounts foundation (SDD: docs/design/2026-05-25-smart-identity-routing.md)
-- ADDITIVE ONLY. Creates one new table; no ALTER/DROP on existing tables; no data migration.
-- Nothing reads this table yet (gated behind ff.identity.unified.enabled, default OFF).
-- Links external auth identities to one canonical PetWash user so the same human is a
-- single user_id across providers (Google + Apple stop becoming two accounts).

CREATE TABLE IF NOT EXISTS "identity_accounts" (
  "id" serial PRIMARY KEY,
  "user_id" varchar NOT NULL,
  "provider" varchar(30) NOT NULL,
  "provider_account_id" varchar(255) NOT NULL,
  "email" varchar(320),
  "email_verified" boolean NOT NULL DEFAULT false,
  "display_name" varchar(255),
  "is_primary" boolean NOT NULL DEFAULT false,
  "linked_at" timestamp NOT NULL DEFAULT now(),
  "last_used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- One external provider account maps to exactly one PetWash user (the linking guarantee).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_identity_accounts_provider_account"
  ON "identity_accounts" ("provider", "provider_account_id");

CREATE INDEX IF NOT EXISTS "idx_identity_accounts_user"
  ON "identity_accounts" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_identity_accounts_email"
  ON "identity_accounts" ("email");

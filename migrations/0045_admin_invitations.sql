-- Admin Invitations — invite-only admin/staff (SDD: docs/design/2026-05-25-smart-identity-routing.md §5.5)
-- ADDITIVE ONLY. One new table; no ALTER/DROP on existing tables; no data migration.
-- No public path can create an admin. Nothing reads it yet (ff.identity.unified.enabled, OFF).

CREATE TABLE IF NOT EXISTS "admin_invitations" (
  "id" serial PRIMARY KEY,
  "email_norm" varchar(320) NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "role" varchar(30) NOT NULL,
  "invited_by" varchar NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "accepted_by_user_id" varchar,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Invite token hash is unique (one token = one invitation).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_admin_invitations_token"
  ON "admin_invitations" ("token_hash");

CREATE INDEX IF NOT EXISTS "idx_admin_invitations_email"
  ON "admin_invitations" ("email_norm");

CREATE INDEX IF NOT EXISTS "idx_admin_invitations_status"
  ON "admin_invitations" ("status");

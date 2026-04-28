-- Migration: 0018_privacy_first_account_schema
-- Privacy-first account schema upgrade for PetWash™
--
-- Changes in this migration:
--   1. pets table — add privacy/consent fields, skin_sensitivity, and replace
--      unconstrained temperament varchar with a safe enum.
--   2. business_legal_id_documents — National ID / Passport collection is
--      restricted to verified business accounts and high-risk compliance cases.
--   3. user_notification_consents — granular per-channel, per-purpose consent
--      rows (authoritative; replaces jsonb cache in users table).
--   4. user_wash_preferences — decoupled wash preference module.
--   5. account_deletion_requests — right-to-erasure lifecycle table.
--   6. data_export_requests — right-of-access / data portability table.
--   7. user_platform_access — multi-platform access control per user.

-- ── 1. Pet temperament safe enum ────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE pet_temperament AS ENUM (
    'calm',
    'nervous',
    'high_energy',
    'needs_careful_handling',
    'staff_assistance_recommended'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Alter pets table ──────────────────────────────────────────────────────
-- Add privacy fields (medical data private by default)
ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "skin_sensitivity"          text,
  ADD COLUMN IF NOT EXISTS "medical_data_private"      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "medical_share_consent"     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "medical_consent_updated_at" timestamp;

-- Migrate existing temperament varchar to the new enum safely:
--   Step 1: archive the original free-text value before any conversion
ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "temperament_archived" text;

UPDATE "pets"
  SET "temperament_archived" = "temperament"
  WHERE "temperament" IS NOT NULL AND "temperament_archived" IS NULL;

--   Step 2: add a new typed column
ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "temperament_new" pet_temperament;

-- Step 3: map any existing values to the closest safe label.
-- Original values are preserved in temperament_archived for audit purposes.
UPDATE "pets" SET "temperament_new" = CASE
  WHEN lower("temperament") IN ('calm', 'gentle', 'friendly', 'relaxed', 'docile') THEN 'calm'::pet_temperament
  WHEN lower("temperament") IN ('nervous', 'anxious', 'shy', 'fearful', 'timid') THEN 'nervous'::pet_temperament
  WHEN lower("temperament") IN ('high energy', 'high_energy', 'energetic', 'active', 'excitable') THEN 'high_energy'::pet_temperament
  WHEN lower("temperament") IN ('aggressive', 'reactive', 'unpredictable', 'dominant',
                                  'needs careful handling', 'needs_careful_handling') THEN 'needs_careful_handling'::pet_temperament
  -- Values that suggest a higher risk level map to staff_assistance_recommended
  WHEN lower("temperament") IN ('dangerous', 'staff assistance', 'staff_assistance_recommended',
                                  'staff assistance recommended') THEN 'staff_assistance_recommended'::pet_temperament
  ELSE NULL  -- unmapped values become NULL (safe default); original is kept in temperament_archived
END
WHERE "temperament" IS NOT NULL;

-- Step 4: drop the old untyped column and rename the new one
ALTER TABLE "pets" DROP COLUMN IF EXISTS "temperament";
ALTER TABLE "pets" RENAME COLUMN "temperament_new" TO "temperament";

-- ── 3. business_legal_id_documents ──────────────────────────────────────────
-- National ID / Passport ONLY for verified business accounts or high-risk cases.
CREATE TABLE IF NOT EXISTS "business_legal_id_documents" (
  "id"                     serial PRIMARY KEY,
  "user_id"                varchar(128)    NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- "business_verified" | "high_risk_payment" | "compliance_hold"
  "collection_reason"      varchar(60)     NOT NULL,
  -- Plain-text justification written by the compliance officer
  "legal_reason"           text            NOT NULL,
  -- "national_id" | "passport" | "drivers_license" | "company_registration"
  "document_type"          varchar(40)     NOT NULL,
  "document_country"       varchar(10)     NOT NULL,
  -- Secure (non-public) GCS / S3 signed object URL
  "document_storage_url"   varchar(512)    NOT NULL,
  -- SHA-256 hash of the raw document file
  "document_file_hash"     varchar(64)     NOT NULL,
  "document_expires_at"    date,
  -- "pending" | "approved" | "rejected" | "superseded"
  "verification_status"    varchar(20)     NOT NULL DEFAULT 'pending',
  "verified_at"            timestamp,
  "reviewed_by_user_id"    varchar(128),
  "review_notes"           text,
  -- Append-only: corrections point to the superseding row
  "superseded_by_id"       integer,
  -- Uploader IP with last octet masked (privacy-safe)
  "uploader_masked_ip"     varchar(64),
  "created_at"             timestamp       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_biz_legal_id_user"
  ON "business_legal_id_documents" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_biz_legal_id_status"
  ON "business_legal_id_documents" ("verification_status");

-- ── 4. user_notification_consents ───────────────────────────────────────────
-- Authoritative per-channel, per-purpose consent table.
-- channel: whatsapp | sms | email | push
-- purpose: service_alerts | receipts | marketing | reminders
CREATE TABLE IF NOT EXISTS "user_notification_consents" (
  "id"                serial PRIMARY KEY,
  "user_id"           varchar(128)  NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "channel"           varchar(20)   NOT NULL,
  "purpose"           varchar(30)   NOT NULL,
  -- Explicit opt-in required; defaults to false (no consent)
  "consented"         boolean       NOT NULL DEFAULT false,
  "consented_at"      timestamp,
  -- IP at consent change time (last octet masked)
  "consent_ip_masked" varchar(64),
  "policy_version"    varchar(20),
  "created_at"        timestamp     NOT NULL DEFAULT now(),
  "updated_at"        timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_notif_consent_user"
  ON "user_notification_consents" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_notif_consent_unique"
  ON "user_notification_consents" ("user_id", "channel", "purpose");

-- ── 5. user_wash_preferences ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_wash_preferences" (
  "id"                      serial PRIMARY KEY,
  "user_id"                 varchar(128)  NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  -- "economy" | "standard" | "premium" | "luxury"
  "preferred_wash_package"  varchar(30),
  -- "morning" | "afternoon" | "evening" | "any"
  "preferred_time_slot"     varchar(20),
  "preferred_station_id"    varchar(80),
  "use_eco_water"           boolean       DEFAULT false,
  "add_fragrance_service"   boolean       DEFAULT false,
  "add_drying_service"      boolean       DEFAULT false,
  "wash_notes"              text,
  "created_at"              timestamp     NOT NULL DEFAULT now(),
  "updated_at"              timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_wash_prefs_user"
  ON "user_wash_preferences" ("user_id");

-- ── 6. account_deletion_requests ────────────────────────────────────────────
-- Right to Erasure — GDPR Art. 17 / Israel Privacy Law
CREATE TABLE IF NOT EXISTS "account_deletion_requests" (
  "id"                   serial PRIMARY KEY,
  "user_id"              varchar(128)  NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  -- "user_requested" | "admin_initiated" | "legal_hold_expired"
  "request_reason"       varchar(60)   NOT NULL DEFAULT 'user_requested',
  "user_notes"           text,
  -- "pending" | "processing" | "completed" | "rejected" | "cancelled"
  "status"               varchar(20)   NOT NULL DEFAULT 'pending',
  "scheduled_erasure_at" timestamp,
  "erased_at"            timestamp,
  "reviewed_by_user_id"  varchar(128),
  "review_notes"         text,
  "request_ip_masked"    varchar(64),
  "requested_at"         timestamp     NOT NULL DEFAULT now(),
  "updated_at"           timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_acct_del_user"
  ON "account_deletion_requests" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_acct_del_status"
  ON "account_deletion_requests" ("status");

CREATE INDEX IF NOT EXISTS "idx_acct_del_scheduled"
  ON "account_deletion_requests" ("scheduled_erasure_at");

-- ── 7. data_export_requests ─────────────────────────────────────────────────
-- Right of Access / Data Portability — GDPR Art. 15 & 20
CREATE TABLE IF NOT EXISTS "data_export_requests" (
  "id"                      serial PRIMARY KEY,
  "user_id"                 varchar(128)  NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  -- "pending" | "processing" | "ready" | "downloaded" | "expired" | "failed"
  "status"                  varchar(20)   NOT NULL DEFAULT 'pending',
  -- Signed, time-limited download URL generated after processing
  "download_url"            varchar(512),
  "download_url_expires_at" timestamp,
  "downloaded_at"           timestamp,
  "request_ip_masked"       varchar(64),
  "requested_at"            timestamp     NOT NULL DEFAULT now(),
  "completed_at"            timestamp,
  "failure_reason"          text
);

CREATE INDEX IF NOT EXISTS "idx_data_export_user"
  ON "data_export_requests" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_data_export_status"
  ON "data_export_requests" ("status");

-- ── 8. user_platform_access ─────────────────────────────────────────────────
-- Multi-platform access control — one row per user + platform module.
-- platformCode: wash_station | pet_sitting | dog_walking | academy
--             | lost_and_found | pettrek | mobile_vet (future)
CREATE TABLE IF NOT EXISTS "user_platform_access" (
  "id"                  serial PRIMARY KEY,
  "user_id"             varchar(128)  NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform_code"       varchar(40)   NOT NULL,
  -- "active" | "suspended" | "pending_verification" | "revoked"
  "access_status"       varchar(30)   NOT NULL DEFAULT 'active',
  -- "customer" | "provider" | "staff" | "admin"
  "access_role"         varchar(20)   NOT NULL DEFAULT 'customer',
  "granted_at"          timestamp     NOT NULL DEFAULT now(),
  "revoked_at"          timestamp,
  "granted_by_user_id"  varchar(128),
  "created_at"          timestamp     NOT NULL DEFAULT now(),
  "updated_at"          timestamp     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_platform_access_user"
  ON "user_platform_access" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_platform_access_platform"
  ON "user_platform_access" ("platform_code");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_platform_access_unique"
  ON "user_platform_access" ("user_id", "platform_code");

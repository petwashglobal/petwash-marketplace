-- 0073_notification_preferences_drift_fix.sql
--
-- FIX: customer-facing 500 on the Consent / Notification-Preferences center.
--
-- The `notification_preferences` table (shared/schema-unified-platform.ts:61) was
-- bootstrapped via drizzle-kit push and was NEVER captured in a numbered migration.
-- Newer consent columns (the 3 marketing-consent timestamps, the 3 transactional
-- channel flags, and the device push-permission status) were later added to the
-- schema in code only. Because CI applies numbered migrations (--lenient) and does
-- NOT run drizzle-kit push, production is missing those columns — so every read in
-- consent-center.ts (getOrCreatePrefs → SELECT *) hits 42703 undefined_column and
-- returns HTTP 500. This also blocks Israeli Privacy/§30א marketing-consent recording.
--
-- This migration is fully idempotent and converges ANY prod state to match the
-- code: CREATE TABLE IF NOT EXISTS for a fresh DB, then ADD COLUMN IF NOT EXISTS
-- for every column so an older push-bootstrapped table gains exactly what it lacks.
-- Safe to run repeatedly; cannot break the deploy.

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                    text NOT NULL UNIQUE,
  "whatsapp"                   boolean NOT NULL DEFAULT true,
  "email"                      boolean NOT NULL DEFAULT true,
  "sms"                        boolean NOT NULL DEFAULT true,
  "push"                       boolean NOT NULL DEFAULT true,
  "in_app"                     boolean NOT NULL DEFAULT true,
  "platform_preferences"       jsonb   NOT NULL DEFAULT '{"walk-my-pet":true,"sitter-suite":true,"pettrek":true,"academy":true,"wash-hub":true,"plush-lab":true}'::jsonb,
  "marketing"                  boolean NOT NULL DEFAULT true,
  "transactional"              boolean NOT NULL DEFAULT true,
  "alerts"                     boolean NOT NULL DEFAULT true,
  "marketing_sms_consent_at"   timestamp,
  "marketing_email_consent_at" timestamp,
  "marketing_push_consent_at"  timestamp,
  "transactional_sms_enabled"  boolean NOT NULL DEFAULT true,
  "transactional_email_enabled" boolean NOT NULL DEFAULT true,
  "transactional_push_enabled" boolean NOT NULL DEFAULT true,
  "push_device_permission_status" text DEFAULT 'not_determined',
  "updated_at"                 timestamp NOT NULL DEFAULT now()
);

-- Converge an older push-bootstrapped table (each is a no-op if already present).
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "whatsapp"                      boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "email"                         boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "sms"                           boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "push"                          boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "in_app"                        boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "platform_preferences"          jsonb   NOT NULL DEFAULT '{"walk-my-pet":true,"sitter-suite":true,"pettrek":true,"academy":true,"wash-hub":true,"plush-lab":true}'::jsonb;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "marketing"                     boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "transactional"                 boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "alerts"                        boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "marketing_sms_consent_at"      timestamp;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "marketing_email_consent_at"    timestamp;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "marketing_push_consent_at"     timestamp;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "transactional_sms_enabled"     boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "transactional_email_enabled"   boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "transactional_push_enabled"    boolean NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "push_device_permission_status" text DEFAULT 'not_determined';
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "updated_at"                    timestamp NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS "notification_pref_user_id_idx" ON "notification_preferences" ("user_id");

-- ── providers.kyc_deletion_completed_at (schema.ts:8114) ────────────────────
-- Also code-only drift. The KYC-retention deletion job (server/jobs/kycDeletionJob.ts:68)
-- writes this timestamp; without the column the UPDATE silently fails and the
-- retention audit trail (Israeli Privacy / GDPR erasure proof) is never recorded.
-- Not a 500 (the job swallows it) but a compliance-evidence gap. Additive, safe.
ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "kyc_deletion_completed_at" timestamp;

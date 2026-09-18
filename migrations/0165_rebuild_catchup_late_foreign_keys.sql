-- 0165_rebuild_catchup_late_foreign_keys.sql  (2026-09-18, schema-rebuild catch-up 4 of 5)
--
-- The 22 foreign keys that replaying migrations/ does not produce and that
-- 0002_b could not carry inline.
--
-- 0002_b writes each new table's foreign keys INSIDE its CREATE TABLE IF NOT
-- EXISTS, which is the only way a foreign key can be made idempotent at all —
-- Postgres has no ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS, and this
-- migration series may not use DO $$ guards. That trick needs the referenced
-- table to exist already at slot 0002, so two groups land here instead:
--
--   * foreign keys on new tables that point at a table a LATER migration
--     creates (hr_employees, station_registry, staff_applications,
--     provider_invite_codes, provider_applications);
--   * foreign keys on tables migrations/ ALREADY creates (the paw_finder_*
--     post_id keys, hr_employees.franchise_id, provider_intake_queue) — their
--     CREATE TABLE is in an old migration that simply never declared them.
--
-- All 22 already exist in production (verified by name against the committed
-- prod schema dump, 2026-07-03), so this file is a no-op there.
--
-- Postgres has no ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS, so idempotency
-- needs the DO/EXCEPTION guard -- required, not stylistic: the prod-baseline PR
-- gate (.github/workflows/migration-test.yml) replays new migrations through
-- psql with ON_ERROR_STOP=1, where re-adding an existing constraint is fatal.
-- The alternative that avoids DO blocks -- DROP CONSTRAINT IF EXISTS followed
-- by ADD CONSTRAINT -- would make every deploy re-validate all 22 foreign keys
-- against live rows, which is a real cost for a file whose whole job is to do
-- nothing on production. scripts/apply-pending-migrations.ts sends this file on
-- its TRANSACTIONAL path (no CONCURRENTLY / VACUUM / REINDEX / ALTER SYSTEM /
-- CREATE|DROP DATABASE|TABLESPACE anywhere in it), so the whole file goes as a
-- single query and the runner's non-dollar-quote-aware splitter never sees it.
-- On a fresh rebuild all 22 are created.

DO $$ BEGIN
  ALTER TABLE "chat_conversations" ADD CONSTRAINT "fk_chat_conv_station" FOREIGN KEY ("station_id") REFERENCES "public"."station_registry"("station_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hr_employees" ADD CONSTRAINT "fk_hr_employees_franchise" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_incidents" ADD CONSTRAINT "fk_incidents_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_incidents" ADD CONSTRAINT "fk_incidents_escalated_to" FOREIGN KEY ("escalated_to") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_incidents" ADD CONSTRAINT "fk_incidents_modified_by" FOREIGN KEY ("modified_by") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_incidents" ADD CONSTRAINT "fk_incidents_reported_by" FOREIGN KEY ("reported_by") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_incidents" ADD CONSTRAINT "fk_incidents_station" FOREIGN KEY ("station_id") REFERENCES "public"."station_registry"("station_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_tasks" ADD CONSTRAINT "fk_ops_tasks_assigned_to" FOREIGN KEY ("assigned_to") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_tasks" ADD CONSTRAINT "fk_ops_tasks_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_tasks" ADD CONSTRAINT "fk_ops_tasks_escalated_to" FOREIGN KEY ("escalated_to") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_tasks" ADD CONSTRAINT "fk_ops_tasks_modified_by" FOREIGN KEY ("modified_by") REFERENCES "public"."hr_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ops_tasks" ADD CONSTRAINT "fk_ops_tasks_station" FOREIGN KEY ("station_id") REFERENCES "public"."station_registry"("station_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "paw_finder_contact_requests" ADD CONSTRAINT "paw_finder_contact_requests_post_id_paw_finder_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."paw_finder_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "paw_finder_events" ADD CONSTRAINT "paw_finder_events_post_id_paw_finder_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."paw_finder_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "paw_finder_matches" ADD CONSTRAINT "paw_finder_matches_found_post_id_paw_finder_posts_id_fk" FOREIGN KEY ("found_post_id") REFERENCES "public"."paw_finder_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "paw_finder_matches" ADD CONSTRAINT "paw_finder_matches_lost_post_id_paw_finder_posts_id_fk" FOREIGN KEY ("lost_post_id") REFERENCES "public"."paw_finder_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "paw_finder_media" ADD CONSTRAINT "paw_finder_media_post_id_paw_finder_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."paw_finder_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "paw_finder_moderation_events" ADD CONSTRAINT "paw_finder_moderation_events_post_id_paw_finder_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."paw_finder_posts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "provider_intake_queue" ADD CONSTRAINT "provider_intake_queue_converted_to_application_id_provider_applications_application_id_fk" FOREIGN KEY ("converted_to_application_id") REFERENCES "public"."provider_applications"("application_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "provider_intake_queue" ADD CONSTRAINT "provider_intake_queue_generated_invite_code_provider_invite_codes_invite_code_fk" FOREIGN KEY ("generated_invite_code") REFERENCES "public"."provider_invite_codes"("invite_code") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_background_checks" ADD CONSTRAINT "staff_background_checks_application_id_staff_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."staff_applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "staff_esignatures" ADD CONSTRAINT "staff_esignatures_application_id_staff_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."staff_applications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

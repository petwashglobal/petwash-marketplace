-- 0162 — the provider-review tables that only ever existed in code.
--
-- 2026-09-17: /api/provider-onboarding/admin/applications/pending-review and
-- .../queue both answered 500 in production. They join provider_review_queue,
-- which has NO migration — it was only ever created by `drizzle push` on a dev
-- database. Same for the review audit trail and the applicant message thread:
-- every provider application submitted in production wrote its queue row, audit
-- events and system messages into tables that do not exist (those writes are
-- wrapped in try/catch, so the failures were silent), and both admin review
-- screens were dead.
--
-- Columns below are exactly what the code reads and writes today:
--   server/services/providerQueue.ts        (queue upsert / list / assign / badge)
--   server/services/providerAudit.ts        (review audit trail)
--   server/services/providerMessageLog.ts   (thread + messages)
--   server/routes/provider-onboarding.ts    (pending-review + queue endpoints)
--
-- Idempotent (IF NOT EXISTS), no DO blocks — the runner splits on ';'.

CREATE TABLE IF NOT EXISTS "provider_review_queue" (
  "id"              serial PRIMARY KEY,
  "application_id"  integer NOT NULL UNIQUE REFERENCES "provider_applications"("id") ON DELETE CASCADE,
  "status"          varchar(24) NOT NULL DEFAULT 'open',      -- open | assigned | completed
  "priority"        varchar(16) NOT NULL DEFAULT 'normal',    -- urgent | high | normal | low
  "review_reasons"  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "due_at"          timestamp,
  "assigned_to"     varchar(128),
  "assigned_at"     timestamp,
  "completed_at"    timestamp,
  "unread_count"    integer NOT NULL DEFAULT 0,
  "created_at"      timestamp NOT NULL DEFAULT now(),
  "updated_at"      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_provider_review_queue_status"   ON "provider_review_queue" ("status");
CREATE INDEX IF NOT EXISTS "idx_provider_review_queue_priority" ON "provider_review_queue" ("priority", "due_at");
CREATE INDEX IF NOT EXISTS "idx_provider_review_queue_assigned" ON "provider_review_queue" ("assigned_to");

CREATE TABLE IF NOT EXISTS "provider_review_audit" (
  "id"             serial PRIMARY KEY,
  "application_id" integer NOT NULL,
  "event_type"     varchar(64) NOT NULL,
  "actor_user_id"  varchar(128),
  "actor_role"     varchar(32),
  "payload"        jsonb,
  "created_at"     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_provider_review_audit_app" ON "provider_review_audit" ("application_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "provider_application_threads" (
  "id"             serial PRIMARY KEY,
  "application_id" integer NOT NULL UNIQUE REFERENCES "provider_applications"("id") ON DELETE CASCADE,
  "created_at"     timestamp NOT NULL DEFAULT now(),
  "updated_at"     timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_application_messages" (
  "id"               serial PRIMARY KEY,
  "thread_id"        integer NOT NULL REFERENCES "provider_application_threads"("id") ON DELETE CASCADE,
  "application_id"   integer NOT NULL,
  "direction"        varchar(16) NOT NULL,                    -- inbound | outbound | system
  "channel"          varchar(16) NOT NULL,                    -- email | sms | system | note
  "subject"          text,
  "body"             text NOT NULL,
  "from_address"     varchar(320),
  "to_address"       varchar(320),
  "sent_by"          varchar(128),
  "delivery_status"  varchar(24),
  "provider_visible" boolean NOT NULL DEFAULT true,
  "created_at"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_provider_app_messages_app" ON "provider_application_messages" ("application_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_provider_app_messages_thread" ON "provider_application_messages" ("thread_id", "created_at" DESC);

-- The thread pointer the message log back-fills on the application row.
ALTER TABLE "provider_applications"
  ADD COLUMN IF NOT EXISTS "communication_thread_id" integer;

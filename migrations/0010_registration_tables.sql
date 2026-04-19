-- ============================================================================
-- Migration 0010: Registration Tables
-- Creates all tables that were defined in schema files but never migrated.
-- These missing tables caused silent 500 errors on every registration attempt.
--
-- Tables created (in FK-dependency order):
--   provider_applicants, provider_documents, provider_background_checks,
--   provider_onboarding_tasks, provider_stage_transitions,
--   trainers, trainer_bookings,
--   onboarding_cases, onboarding_milestones, provider_approval_queue,
--   provider_profiles, services_catalog, dispatch_jobs, session_care_logs,
--   saved_providers, provider_assets, payments, ledger_entries,
--   security_events, otp_events, sms_evidence, email_audit
-- ============================================================================

-- ── 1. provider_applicants ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_applicants" (
  "id"                           serial PRIMARY KEY,
  "user_id"                      varchar NOT NULL,
  "email"                        varchar NOT NULL,
  "first_name"                   varchar NOT NULL,
  "last_name"                    varchar NOT NULL,
  "phone_number"                 varchar NOT NULL,
  "date_of_birth"                date NOT NULL,
  "national_id"                  varchar,
  "gender"                       varchar(20),
  "membership_number"            varchar(20) UNIQUE,
  "street_address"               text NOT NULL,
  "city"                         varchar NOT NULL,
  "postal_code"                  varchar,
  "country_code"                 varchar(2) DEFAULT 'IL',
  "service_types"                text[] NOT NULL,
  "years_experience"             integer DEFAULT 0,
  "certifications"               text[],
  "biography"                    text,
  "languages"                    text[] DEFAULT ARRAY['he']::text[],
  "service_radius"               integer DEFAULT 10,
  "max_pets_at_once"             integer DEFAULT 3,
  "pet_types_accepted"           text[] DEFAULT ARRAY['dog', 'cat']::text[],
  "has_own_vehicle"              boolean DEFAULT false,
  "has_home_space"               boolean DEFAULT false,
  "emergency_contact_name"       varchar,
  "emergency_contact_phone"      varchar,
  "emergency_contact_relation"   varchar,
  "stage"                        varchar NOT NULL DEFAULT 'application_submitted',
  "status"                       varchar NOT NULL DEFAULT 'pending',
  "rejection_reason"             text,
  "interview_scheduled_at"       timestamp,
  "interview_completed_at"       timestamp,
  "interview_notes"              text,
  "interview_score"              integer,
  "assigned_reviewer_id"         varchar,
  "reviewer_notes"               text,
  "privacy_consent_at"           timestamp,
  "privacy_consent_ip"           varchar,
  "marketing_consent_at"         timestamp,
  "data_retention_acknowledged_at" timestamp,
  "invitation_token"             varchar UNIQUE,
  "invitation_sent_at"           timestamp,
  "invitation_expires_at"        timestamp,
  "onboarding_completed_at"      timestamp,
  "submitted_at"                 timestamp DEFAULT now(),
  "last_updated_at"              timestamp DEFAULT now(),
  "stage_changed_at"             timestamp DEFAULT now(),
  "approved_at"                  timestamp,
  "rejected_at"                  timestamp,
  "content_hash"                 varchar,
  "audit_trail_hash"             varchar
);
CREATE INDEX IF NOT EXISTS "idx_provider_applicants_user"     ON "provider_applicants" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_provider_applicants_email"    ON "provider_applicants" ("email");
CREATE INDEX IF NOT EXISTS "idx_provider_applicants_stage"    ON "provider_applicants" ("stage");
CREATE INDEX IF NOT EXISTS "idx_provider_applicants_status"   ON "provider_applicants" ("status");
CREATE INDEX IF NOT EXISTS "idx_provider_applicants_reviewer" ON "provider_applicants" ("assigned_reviewer_id");

-- ── 2. provider_documents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_documents" (
  "id"               serial PRIMARY KEY,
  "applicant_id"     integer REFERENCES "provider_applicants" ("id"),
  "document_type"    varchar NOT NULL,
  "file_name"        varchar,
  "file_url"         text,
  "file_size"        integer,
  "mime_type"        varchar,
  "status"           varchar DEFAULT 'pending',
  "verified_by"      varchar,
  "verified_at"      timestamp,
  "rejection_reason" text,
  "uploaded_at"      timestamp DEFAULT now(),
  "metadata"         jsonb,
  "uploaded_by"      varchar
);
CREATE INDEX IF NOT EXISTS "idx_provider_docs_applicant" ON "provider_documents" ("applicant_id");
CREATE INDEX IF NOT EXISTS "idx_provider_docs_type"      ON "provider_documents" ("document_type");

-- ── 3. provider_background_checks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_background_checks" (
  "id"                 serial PRIMARY KEY,
  "applicant_id"       integer NOT NULL REFERENCES "provider_applicants" ("id"),
  "check_type"         varchar NOT NULL,
  "check_provider"     varchar NOT NULL,
  "status"             varchar NOT NULL DEFAULT 'pending',
  "initiated_at"       timestamp DEFAULT now(),
  "completed_at"       timestamp,
  "expires_at"         timestamp,
  "result_status"      varchar,
  "result_summary"     text,
  "flagged_issues"     jsonb,
  "risk_score"         integer,
  "vendor_reference"   varchar,
  "vendor_response"    jsonb,
  "reviewed_at"        timestamp,
  "reviewed_by_uid"    varchar,
  "reviewer_decision"  varchar,
  "reviewer_notes"     text,
  "response_hash"      varchar,
  "created_at"         timestamp DEFAULT now(),
  "updated_at"         timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_bg_checks_applicant" ON "provider_background_checks" ("applicant_id");
CREATE INDEX IF NOT EXISTS "idx_bg_checks_status"    ON "provider_background_checks" ("status");
CREATE INDEX IF NOT EXISTS "idx_bg_checks_result"    ON "provider_background_checks" ("result_status");

-- ── 4. provider_onboarding_tasks ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_onboarding_tasks" (
  "id"             serial PRIMARY KEY,
  "applicant_id"   integer REFERENCES "provider_applicants" ("id"),
  "task_key"       varchar NOT NULL,
  "task_name"      varchar NOT NULL,
  "task_name_he"   varchar,
  "description"    text,
  "description_he" text,
  "stage"          varchar NOT NULL,
  "sort_order"     integer DEFAULT 0,
  "is_required"    boolean DEFAULT true,
  "status"         varchar DEFAULT 'pending',
  "completed_at"   timestamp,
  "verified_by"    varchar,
  "notes"          text,
  "created_at"     timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_onboard_tasks_applicant" ON "provider_onboarding_tasks" ("applicant_id");
CREATE INDEX IF NOT EXISTS "idx_onboard_tasks_stage"     ON "provider_onboarding_tasks" ("stage");
CREATE INDEX IF NOT EXISTS "idx_onboard_tasks_status"    ON "provider_onboarding_tasks" ("status");

-- ── 5. provider_stage_transitions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_stage_transitions" (
  "id"                   serial PRIMARY KEY,
  "applicant_id"         integer REFERENCES "provider_applicants" ("id"),
  "from_stage"           varchar,
  "to_stage"             varchar NOT NULL,
  "transition_reason"    text,
  "triggered_by_uid"     varchar,
  "triggered_by_system"  boolean DEFAULT false,
  "metadata"             jsonb,
  "ip_address"           varchar,
  "user_agent"           text,
  "previous_hash"        varchar,
  "transition_hash"      varchar,
  "created_at"           timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_stage_trans_applicant" ON "provider_stage_transitions" ("applicant_id");
CREATE INDEX IF NOT EXISTS "idx_stage_trans_time"      ON "provider_stage_transitions" ("created_at");

-- ── 6. trainers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "trainers" (
  "id"                      serial PRIMARY KEY,
  "trainer_id"              varchar UNIQUE NOT NULL,
  "user_id"                 varchar UNIQUE NOT NULL,
  "first_name"              varchar NOT NULL,
  "last_name"               varchar NOT NULL,
  "email"                   varchar UNIQUE NOT NULL,
  "phone"                   varchar NOT NULL,
  "profile_photo_url"       varchar,
  "bio"                     text,
  "bio_he"                  text,
  "specialties"             text[],
  "certifications"          text[],
  "years_of_experience"     integer DEFAULT 0,
  "hourly_rate"             numeric(10, 2) NOT NULL,
  "currency"                varchar DEFAULT 'ILS',
  "service_types"           text[],
  "service_area"            text,
  "languages"               text[] DEFAULT ARRAY['he', 'en'],
  "availability_schedule"   jsonb,
  "is_accepting_bookings"   boolean DEFAULT true,
  "verification_status"     varchar DEFAULT 'pending',
  "verified_at"             timestamp,
  "verified_by"             varchar,
  "id_document_url"         varchar,
  "certification_doc_urls"  text[],
  "insurance_cert_url"      varchar,
  "average_rating"          numeric(3, 2) DEFAULT 4.50,
  "total_reviews"           integer DEFAULT 0,
  "total_sessions"          integer DEFAULT 0,
  "trust_score_id"          varchar,
  "is_certified"            boolean DEFAULT false,
  "commission_rate"         numeric(5, 2) DEFAULT 15.00,
  "total_earnings"          numeric(10, 2) DEFAULT 0.00,
  "is_active"               boolean DEFAULT true,
  "is_suspended"            boolean DEFAULT false,
  "suspension_reason"       text,
  "created_at"              timestamp DEFAULT now(),
  "updated_at"              timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_trainers_user"         ON "trainers" ("user_id");
CREATE INDEX        IF NOT EXISTS "idx_trainers_email"        ON "trainers" ("email");
CREATE INDEX        IF NOT EXISTS "idx_trainers_verification" ON "trainers" ("verification_status");
CREATE INDEX        IF NOT EXISTS "idx_trainers_certified"    ON "trainers" ("is_certified");
CREATE INDEX        IF NOT EXISTS "idx_trainers_active"       ON "trainers" ("is_active");

-- ── 7. trainer_bookings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "trainer_bookings" (
  "id"                    serial PRIMARY KEY,
  "booking_id"            varchar UNIQUE NOT NULL,
  "user_id"               varchar NOT NULL,
  "trainer_id"            integer NOT NULL REFERENCES "trainers" ("id"),
  "trainer_user_id"       varchar NOT NULL,
  "pet_name"              varchar NOT NULL,
  "pet_breed"             varchar,
  "pet_age"               integer,
  "special_requirements"  text,
  "session_date"          timestamp NOT NULL,
  "session_duration"      integer NOT NULL,
  "session_type"          varchar NOT NULL,
  "session_location"      text,
  "location_coordinates"  jsonb,
  "training_goals"        text[],
  "customer_notes"        text,
  "trainer_notes"         text,
  "hourly_rate"           numeric(10, 2) NOT NULL,
  "total_amount"          numeric(10, 2) NOT NULL,
  "platform_fee"          numeric(10, 2) NOT NULL,
  "trainer_payout"        numeric(10, 2) NOT NULL,
  "currency"              varchar DEFAULT 'ILS',
  "payment_method"        varchar,
  "payment_status"        varchar DEFAULT 'pending',
  "payment_intent_id"     varchar,
  "paid_at"               timestamp,
  "escrow_status"         varchar DEFAULT 'pending',
  "escrow_held_at"        timestamp,
  "escrow_released_at"    timestamp,
  "auto_release_at"       timestamp,
  "booking_status"        varchar DEFAULT 'pending',
  "confirmed_at"          timestamp,
  "completed_at"          timestamp,
  "cancelled_at"          timestamp,
  "cancellation_reason"   text,
  "cancelled_by"          varchar,
  "notifications_sent"    boolean DEFAULT false,
  "reminder_sent_at"      timestamp,
  "customer_review_id"    varchar,
  "trainer_review_id"     varchar,
  "is_reviewed"           boolean DEFAULT false,
  "wallet_hold_cents"     integer NOT NULL DEFAULT 0,
  "wallet_debited_cents"  integer NOT NULL DEFAULT 0,
  "wallet_refunded_cents" integer NOT NULL DEFAULT 0,
  "wallet_hold_key"       varchar(200),
  "wallet_debit_key"      varchar(200),
  "wallet_release_key"    varchar(200),
  "wallet_refund_key"     varchar(200),
  "finance_state"         varchar(30) NOT NULL DEFAULT 'none',
  "ip_address"            varchar,
  "user_agent"            varchar,
  "created_at"            timestamp DEFAULT now(),
  "updated_at"            timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_trainer_bookings_user"    ON "trainer_bookings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_trainer_bookings_trainer" ON "trainer_bookings" ("trainer_id");
CREATE INDEX IF NOT EXISTS "idx_trainer_bookings_status"  ON "trainer_bookings" ("booking_status");
CREATE INDEX IF NOT EXISTS "idx_trainer_bookings_payment" ON "trainer_bookings" ("payment_status");
CREATE INDEX IF NOT EXISTS "idx_trainer_bookings_date"    ON "trainer_bookings" ("session_date");

-- ── 8. onboarding_cases ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "onboarding_cases" (
  "id"              serial PRIMARY KEY,
  "user_id"         varchar NOT NULL,
  "context"         varchar(30) NOT NULL,
  "status"          varchar NOT NULL DEFAULT 'started',
  "current_step"    varchar,
  "created_at"      timestamp NOT NULL DEFAULT now(),
  "updated_at"      timestamp DEFAULT now(),
  "decided_by"      varchar,
  "decided_at"      timestamp,
  "decision_reason" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_onboarding_user_unique" ON "onboarding_cases" ("user_id");
CREATE INDEX        IF NOT EXISTS "idx_onboarding_context"     ON "onboarding_cases" ("context");
CREATE INDEX        IF NOT EXISTS "idx_onboarding_status"      ON "onboarding_cases" ("status");

-- ── 9. onboarding_milestones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "onboarding_milestones" (
  "id"           serial PRIMARY KEY,
  "user_id"      varchar NOT NULL,
  "role"         varchar NOT NULL,
  "milestone"    varchar NOT NULL,
  "completed_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "om_user_milestone_unique" ON "onboarding_milestones" ("user_id", "milestone");
CREATE INDEX        IF NOT EXISTS "om_user_idx"              ON "onboarding_milestones" ("user_id");

-- ── 10. provider_approval_queue ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_approval_queue" (
  "id"                    serial PRIMARY KEY,
  "provider_id"           varchar(255) NOT NULL,
  "platform"              varchar(50) NOT NULL,
  "status"                varchar(20) DEFAULT 'pending',
  "priority"              varchar(20) DEFAULT 'normal',
  "photo_approved"        boolean DEFAULT false,
  "certificate_approved"  boolean DEFAULT false,
  "id_verified"           boolean DEFAULT false,
  "address_verified"      boolean DEFAULT false,
  "police_check_approved" boolean DEFAULT false,
  "insurance_verified"    boolean DEFAULT false,
  "pricing_approved"      boolean DEFAULT false,
  "assigned_to"           varchar(255),
  "assigned_at"           timestamp,
  "reviewed_by"           varchar(255),
  "reviewed_at"           timestamp,
  "review_notes"          text,
  "rejection_reason"      text,
  "approved_at"           timestamp,
  "rejected_at"           timestamp,
  "created_at"            timestamp DEFAULT now(),
  "updated_at"            timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_approval_queue_provider" ON "provider_approval_queue" ("provider_id");
CREATE INDEX IF NOT EXISTS "idx_approval_queue_status"   ON "provider_approval_queue" ("status");
CREATE INDEX IF NOT EXISTS "idx_approval_queue_priority" ON "provider_approval_queue" ("priority");
CREATE INDEX IF NOT EXISTS "idx_approval_queue_platform" ON "provider_approval_queue" ("platform");

-- ── 11. provider_profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_profiles" (
  "user_id"                  varchar PRIMARY KEY NOT NULL,
  "bio"                      text,
  "languages"                jsonb DEFAULT '[]'::jsonb,
  "service_coverage"         jsonb DEFAULT '{}'::jsonb,
  "rating_avg"               numeric(3, 2) DEFAULT 0,
  "rating_count"             integer DEFAULT 0,
  "badges"                   jsonb DEFAULT '[]'::jsonb,
  "availability_state"       varchar DEFAULT 'offline',
  "last_presence_at"         timestamp,
  "background_check_status"  varchar,
  "payout_account_status"    varchar,
  "completed_bookings_count" integer,
  "repeat_client_count"      integer,
  "response_rate_pct"        integer,
  "avg_response_time_minutes" integer,
  "acceptance_rate_pct"      integer,
  "completion_rate_pct"      integer,
  "cancellation_rate_pct"    integer,
  "trust_score"              integer,
  "trust_metrics_updated_at" timestamp,
  "ranking_score"            integer,
  "ranking_override"         integer,
  "ranking_boosted_until"    timestamp,
  "ranking_updated_at"       timestamp,
  "ranking_flagged_at"       timestamp,
  "has_fenced_yard"          boolean,
  "has_no_pets_at_home"      boolean,
  "price_from_cents"         integer,
  "accepted_pets"            text[],
  "blocked_dates"            text[],
  "working_hours"            jsonb,
  "is_winback_suppressed"    boolean NOT NULL DEFAULT false,
  "created_at"               timestamp NOT NULL DEFAULT now(),
  "updated_at"               timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_provider_avail" ON "provider_profiles" ("availability_state");

-- ── 12. services_catalog ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "services_catalog" (
  "id"           serial PRIMARY KEY,
  "service_code" varchar(10) NOT NULL UNIQUE,
  "name_public"  varchar NOT NULL,
  "enabled"      boolean NOT NULL DEFAULT true,
  "created_at"   timestamp NOT NULL DEFAULT now()
);

-- ── 13. dispatch_jobs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "dispatch_jobs" (
  "id"           serial PRIMARY KEY,
  "booking_id"   integer NOT NULL,
  "status"       varchar NOT NULL DEFAULT 'created',
  "wave"         integer NOT NULL DEFAULT 1,
  "next_wave_at" timestamp,
  "leased_until" timestamp,
  "created_at"   timestamp NOT NULL DEFAULT now(),
  "updated_at"   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_dispatch_booking" ON "dispatch_jobs" ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_dispatch_status"  ON "dispatch_jobs" ("status");

-- ── 14. session_care_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "session_care_logs" (
  "id"              serial PRIMARY KEY,
  "booking_id"      integer NOT NULL,
  "pet_id"          integer,
  "provider_uid"    varchar NOT NULL,
  "mood"            varchar NOT NULL,
  "energy_level"    integer NOT NULL,
  "ate_well"        boolean NOT NULL DEFAULT false,
  "drank_water"     boolean NOT NULL DEFAULT false,
  "used_toilet"     boolean NOT NULL DEFAULT false,
  "played"          boolean NOT NULL DEFAULT false,
  "notes"           varchar(500),
  "gemini_summary"  text,
  "created_at"      timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "scl_booking_idx" ON "session_care_logs" ("booking_id");
CREATE INDEX IF NOT EXISTS "scl_pet_idx"     ON "session_care_logs" ("pet_id");

-- ── 15. saved_providers ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "saved_providers" (
  "id"          serial PRIMARY KEY,
  "user_id"     varchar(128) NOT NULL,
  "provider_id" varchar(128) NOT NULL,
  "platform"    varchar(32),
  "created_at"  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_saved_providers_user" ON "saved_providers" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_saved_providers_pair" ON "saved_providers" ("user_id", "provider_id");

-- ── 16. provider_assets ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "provider_assets" (
  "id"                   serial PRIMARY KEY,
  "provider_id"          varchar NOT NULL,
  "asset_type"           varchar NOT NULL,
  "storage_ref"          varchar,
  "zero_storage_marker"  boolean DEFAULT false,
  "status"               varchar NOT NULL DEFAULT 'pending',
  "created_at"           timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_provider_assets_pid" ON "provider_assets" ("provider_id");

-- ── 17. payments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payments" (
  "id"           serial PRIMARY KEY,
  "booking_id"   integer,
  "status"       varchar NOT NULL DEFAULT 'authorized',
  "method"       varchar,
  "amount"       numeric(12, 2) NOT NULL,
  "currency"     varchar(5) NOT NULL DEFAULT 'ILS',
  "provider_fee" numeric(12, 2),
  "platform_fee" numeric(12, 2),
  "tax"          numeric(12, 2),
  "created_at"   timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_payments_booking" ON "payments" ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_payments_status"  ON "payments" ("status");

-- ── 18. ledger_entries ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id"              serial PRIMARY KEY,
  "entity_type"     varchar NOT NULL,
  "entity_id"       varchar NOT NULL,
  "entry_type"      varchar NOT NULL,
  "reason_code"     varchar NOT NULL,
  "amount"          numeric(12, 2) NOT NULL,
  "currency"        varchar(5) NOT NULL DEFAULT 'ILS',
  "related_id"      varchar,
  "immutable_hash"  varchar(128),
  "created_at"      timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_ledger_entity"  ON "ledger_entries" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_ledger_reason"  ON "ledger_entries" ("reason_code");
CREATE INDEX IF NOT EXISTS "idx_ledger_related" ON "ledger_entries" ("related_id");
CREATE INDEX IF NOT EXISTS "idx_ledger_created" ON "ledger_entries" ("created_at");

-- ── 19. security_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "security_events" (
  "id"         serial PRIMARY KEY,
  "user_id"    varchar,
  "event_type" varchar NOT NULL,
  "ip"         varchar,
  "user_agent" text,
  "risk_score" integer,
  "metadata"   jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_sec_events_user"    ON "security_events" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_sec_events_type"    ON "security_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_sec_events_created" ON "security_events" ("created_at");

-- ── 20. otp_events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "otp_events" (
  "id"                  serial PRIMARY KEY,
  "otp_id"              varchar(100) NOT NULL,
  "event_type"          varchar(30) NOT NULL,
  "phone_e164"          varchar(20) NOT NULL,
  "user_id"             varchar,
  "user_type_intent"    varchar(20) NOT NULL,
  "otp_hash"            varchar(128),
  "expires_at"          timestamp,
  "attempts_count"      integer DEFAULT 0,
  "result"              varchar(30),
  "provider"            varchar(30) DEFAULT 'twilio',
  "provider_message_id" varchar(100),
  "ip"                  varchar(45),
  "user_agent"          text,
  "device_id"           varchar(100),
  "country_code"        varchar(5),
  "trace_id"            varchar(50),
  "created_at"          timestamp NOT NULL DEFAULT now(),
  "verified_at"         timestamp
);
CREATE INDEX IF NOT EXISTS "idx_otp_events_phone"   ON "otp_events" ("phone_e164");
CREATE INDEX IF NOT EXISTS "idx_otp_events_user"    ON "otp_events" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_otp_events_type"    ON "otp_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_otp_events_otp_id"  ON "otp_events" ("otp_id");
CREATE INDEX IF NOT EXISTS "idx_otp_events_created" ON "otp_events" ("created_at");

-- ── 21. sms_evidence ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sms_evidence" (
  "id"                  serial PRIMARY KEY,
  "user_id"             varchar,
  "membership_id"       varchar(20),
  "message_type"        varchar(30) NOT NULL,
  "template_id"         varchar(50),
  "template_version"    varchar(10) DEFAULT '1.0',
  "to_phone"            varchar(20) NOT NULL,
  "rendered_text"       text NOT NULL,
  "content_hash"        varchar(128),
  "provider"            varchar(30) DEFAULT 'twilio',
  "provider_message_id" varchar(100),
  "status"              varchar(30) DEFAULT 'sent',
  "sent_at"             timestamp NOT NULL DEFAULT now(),
  "delivered_at"        timestamp,
  "failure_reason"      text,
  "ip"                  varchar(45),
  "user_agent"          text,
  "trace_id"            varchar(50),
  "created_at"          timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_sms_evidence_user"  ON "sms_evidence" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_sms_evidence_phone" ON "sms_evidence" ("to_phone");
CREATE INDEX IF NOT EXISTS "idx_sms_evidence_type"  ON "sms_evidence" ("message_type");
CREATE INDEX IF NOT EXISTS "idx_sms_evidence_sent"  ON "sms_evidence" ("sent_at");
CREATE INDEX IF NOT EXISTS "idx_sms_evidence_trace" ON "sms_evidence" ("trace_id");

-- ── 22. email_audit ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "email_audit" (
  "id"                serial PRIMARY KEY,
  "email_type"        varchar(50) NOT NULL,
  "user_id"           varchar,
  "to_email"          varchar(255) NOT NULL,
  "membership_number" varchar(20),
  "provider"          varchar(30) DEFAULT 'sendgrid',
  "message_id"        varchar(200),
  "status"            varchar(30) DEFAULT 'sent',
  "failure_reason"    text,
  "sent_at"           timestamp NOT NULL DEFAULT now(),
  "trace_id"          varchar(50),
  "created_at"        timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_email_audit_user"  ON "email_audit" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_email_audit_type"  ON "email_audit" ("email_type");
CREATE INDEX IF NOT EXISTS "idx_email_audit_email" ON "email_audit" ("to_email");
CREATE INDEX IF NOT EXISTS "idx_email_audit_sent"  ON "email_audit" ("sent_at");
CREATE INDEX IF NOT EXISTS "idx_email_audit_trace" ON "email_audit" ("trace_id");

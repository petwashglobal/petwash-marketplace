-- 0002_b_rebuild_catchup_tables.sql  (2026-09-18, schema-rebuild catch-up 2 of 5)
--
-- The 437 tables that shared/schema*.ts declares but that migrations/ never
-- creates. Production was largely built by out-of-band `drizzle-kit push`, so
-- the migration history alone could not rebuild the database: replaying every
-- file produced 318 of the 712 tables and 148 failing statements, most of them
-- ALTER/CREATE INDEX statements whose target table simply never existed.
--
-- Every statement is CREATE TABLE IF NOT EXISTS, so this file is a no-op on any
-- database that already has the table. Verified against the committed prod
-- schema dump (2026-07-03): 436 of these 437 tables already exist in
-- production. The one exception is "referral_credits", which migration 0099
-- tried and failed to create (its own dependency "referrals" was missing too);
-- creating it is the intended fix, not a behaviour change.
--
-- Placed at slot 0002 — BEFORE the historical migrations that ALTER these
-- tables — because a table that is created last cannot un-fail the statements
-- that referenced it 150 files earlier. Ordering inside the file is a
-- topological sort over the foreign keys, so the 437 CREATE TABLEs carry their
-- foreign keys inline; a FK that is inline in CREATE TABLE IF NOT EXISTS needs
-- no separate guard (Postgres has no ADD CONSTRAINT ... IF NOT EXISTS).
-- Foreign keys whose target table is created by a LATER migration cannot be
-- inlined here and are added in 0164_rebuild_catchup_finish.sql.
--
-- Nothing here needs a DO/EXCEPTION guard: CREATE TABLE IF NOT EXISTS is
-- idempotent on its own, and a foreign key written inside it is skipped with
-- the table. (0002_a and 0165 do need guards, because Postgres offers no
-- IF NOT EXISTS for CREATE TYPE or for ADD CONSTRAINT.) No CONCURRENTLY
-- either, so the file stays on the runner's transactional path and is sent as
-- a single query.

CREATE TABLE IF NOT EXISTS "billing_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_id" varchar NOT NULL,
	"record_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"from_status" varchar,
	"to_status" varchar NOT NULL,
	"actor_type" varchar NOT NULL,
	"actor_id" varchar,
	"delta_agorot" integer,
	"entry_hash" varchar NOT NULL,
	"prev_hash" varchar,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_audit_log_audit_id_unique" UNIQUE("audit_id")
);

CREATE TABLE IF NOT EXISTS "billing_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_id" varchar NOT NULL,
	"idempotency_key" varchar,
	"booking_id" varchar,
	"customer_id" varchar,
	"provider_id" varchar,
	"machine_id" varchar,
	"document_purpose" varchar NOT NULL,
	"issuing_entity" varchar NOT NULL,
	"payment_flow_status" varchar NOT NULL,
	"currency" varchar DEFAULT 'ILS' NOT NULL,
	"subtotal_agorot" integer NOT NULL,
	"vat_agorot" integer NOT NULL,
	"total_agorot" integer NOT NULL,
	"discount_agorot" integer DEFAULT 0 NOT NULL,
	"platform_fee_agorot" integer,
	"platform_fee_vat_agorot" integer,
	"provider_payout_agorot" integer,
	"payment_method" varchar,
	"processor_name" varchar,
	"processor_reference" varchar,
	"captured_at" timestamp,
	"escrow_held_until" timestamp,
	"released_at" timestamp,
	"refunded_at" timestamp,
	"receipt_number" varchar,
	"invoice_number" varchar,
	"allocation_number" varchar,
	"credit_note_number" varchar,
	"is_b2b" boolean DEFAULT false NOT NULL,
	"customer_tax_id" varchar,
	"requires_allocation" boolean DEFAULT false NOT NULL,
	"allocation_requested" boolean DEFAULT false NOT NULL,
	"allocation_confirmed" boolean DEFAULT false NOT NULL,
	"archive_status" varchar DEFAULT 'PENDING' NOT NULL,
	"drive_file_id" text,
	"pdf_sha256" text,
	"archived_at" timestamp,
	"retention_until" timestamp,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_records_record_id_unique" UNIQUE("record_id"),
	CONSTRAINT "billing_records_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "chat_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" varchar,
	"station_id" varchar,
	"franchise_id" integer,
	"external_user_id" varchar,
	"external_system_id" varchar,
	"session_id" varchar NOT NULL,
	"language" varchar DEFAULT 'en',
	"status" varchar DEFAULT 'active',
	"source" varchar DEFAULT 'web',
	"metadata" jsonb,
	"retention_policy_id" integer,
	"data_subject_id" varchar,
	"is_anonymized" boolean DEFAULT false,
	"anonymized_at" timestamp,
	"consent_given" boolean DEFAULT false,
	"consent_given_at" timestamp,
	"deleted_at" timestamp,
	"deleted_by" varchar,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"archived_at" timestamp,
	CONSTRAINT "chat_conversations_conversation_id_unique" UNIQUE("conversation_id"),
	CONSTRAINT "fk_chat_conv_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "fk_chat_conv_franchise" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"source" varchar DEFAULT 'gemini',
	"confidence" integer,
	"model_version" varchar,
	"language" varchar DEFAULT 'en',
	"is_anonymized" boolean DEFAULT false,
	"anonymized_at" timestamp,
	"original_content" text,
	"attachments" jsonb,
	"metadata" jsonb,
	"read_at" timestamp,
	"deleted_at" timestamp,
	"event_published" boolean DEFAULT false,
	"event_published_at" timestamp,
	"event_retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_messages_message_id_unique" UNIQUE("message_id"),
	CONSTRAINT "fk_chat_msg_conversation" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("conversation_id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "chat_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"message_id" varchar,
	"event_type" varchar NOT NULL,
	"event_data" jsonb,
	"user_id" varchar,
	"language" varchar,
	"source" varchar,
	"correlation_id" varchar,
	"parent_event_id" varchar,
	"timestamp" timestamp DEFAULT now(),
	CONSTRAINT "fk_chat_analytics_conversation" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("conversation_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "fk_chat_analytics_message" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("message_id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "chat_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"attachment_type" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" integer,
	"mime_type" varchar,
	"url" text NOT NULL,
	"storage_provider" varchar DEFAULT 'firebase',
	"bucket_name" varchar,
	"storage_path" text,
	"thumbnail" text,
	"metadata" jsonb,
	"encryption_key" varchar,
	"is_redacted" boolean DEFAULT false,
	"redacted_at" timestamp,
	"retention_policy_id" integer,
	"uploaded_by" varchar,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "fk_chat_attach_message" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("message_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "fk_chat_attach_conversation" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("conversation_id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "chat_event_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"aggregate_type" varchar NOT NULL,
	"aggregate_id" varchar NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb,
	"published" boolean DEFAULT false,
	"published_at" timestamp,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 5,
	"next_retry_at" timestamp,
	"last_error" text,
	"last_error_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "chat_event_outbox_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE IF NOT EXISTS "authority_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" varchar NOT NULL,
	"authority_name" varchar NOT NULL,
	"authority_name_he" varchar,
	"authority_type" varchar NOT NULL,
	"country" varchar DEFAULT 'Israel',
	"document_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"description" text,
	"description_he" text,
	"issued_date" date NOT NULL,
	"expiry_date" date,
	"status" varchar DEFAULT 'active' NOT NULL,
	"document_url" text NOT NULL,
	"verification_url" text,
	"qr_code" text,
	"coverage_amount" numeric(15, 2),
	"coverage_currency" varchar DEFAULT 'ILS',
	"applicable_services" jsonb,
	"applicable_locations" jsonb,
	"compliance_level" varchar DEFAULT 'mandatory' NOT NULL,
	"risk_category" varchar DEFAULT 'medium',
	"auto_renewal_enabled" boolean DEFAULT false,
	"display_publicly" boolean DEFAULT true,
	"display_badge" boolean DEFAULT true,
	"display_priority" integer DEFAULT 1,
	"reminder_days_before" integer DEFAULT 30,
	"last_reminder_sent" timestamp,
	"uploaded_by" integer,
	"verified_by" integer,
	"verified_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "authority_documents_document_number_unique" UNIQUE("document_number")
);

CREATE TABLE IF NOT EXISTS "board_resolutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resolution_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"resolution_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"description_he" text,
	"legal_basis" text,
	"decision" text NOT NULL,
	"decision_he" text,
	"voting_results" jsonb,
	"approval_status" varchar DEFAULT 'draft' NOT NULL,
	"approved_by" jsonb,
	"approved_at" timestamp,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"document_url" text,
	"digital_signatures" jsonb,
	"is_public" boolean DEFAULT false,
	"display_on_website" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "board_resolutions_resolution_id_unique" UNIQUE("resolution_id")
);

CREATE TABLE IF NOT EXISTS "booking_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" varchar NOT NULL,
	"policy_name" varchar NOT NULL,
	"policy_name_he" varchar,
	"service_type" varchar NOT NULL,
	"policy_tier" varchar DEFAULT 'standard' NOT NULL,
	"cancellation_rules" jsonb NOT NULL,
	"auto_refund_enabled" boolean DEFAULT true,
	"refund_processing_days" integer DEFAULT 5,
	"refund_method" varchar DEFAULT 'original_payment',
	"dispute_escalation_hours" integer DEFAULT 48,
	"requires_manual_review" boolean DEFAULT false,
	"escalation_email" varchar,
	"terms_url" text,
	"display_in_booking_flow" boolean DEFAULT true,
	"requires_acknowledgment" boolean DEFAULT true,
	"applicable_countries" jsonb,
	"is_active" boolean DEFAULT true,
	"effective_date" date NOT NULL,
	"version" varchar DEFAULT '1.0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_policies_policy_id_unique" UNIQUE("policy_id")
);

CREATE TABLE IF NOT EXISTS "compliance_audit_trail" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" integer NOT NULL,
	"action" varchar NOT NULL,
	"action_by" integer,
	"action_by_name" varchar,
	"action_by_role" varchar,
	"previous_state" jsonb,
	"new_state" jsonb,
	"changes_summary" text,
	"ip_address" varchar,
	"user_agent" varchar,
	"device_fingerprint" varchar,
	"cryptographic_hash" varchar NOT NULL,
	"previous_hash" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"system_notes" text,
	CONSTRAINT "compliance_audit_trail_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE IF NOT EXISTS "compliance_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"task_type" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"description_he" text,
	"action_required" text NOT NULL,
	"action_required_he" text,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"urgency" varchar DEFAULT 'normal',
	"risk_level" varchar DEFAULT 'medium',
	"assigned_to" integer,
	"assigned_role" varchar,
	"assigned_at" timestamp,
	"due_date" timestamp NOT NULL,
	"reminder_date" timestamp,
	"escalation_date" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"completed_by" integer,
	"ai_generated" boolean DEFAULT false,
	"ai_detected_issue" text,
	"ai_recommended_action" text,
	"auto_close_on_completion" boolean DEFAULT true,
	"related_entity_type" varchar,
	"related_entity_id" integer,
	"notifications_sent" integer DEFAULT 0,
	"last_notification_at" timestamp,
	"notes" text,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "compliance_tasks_task_id_unique" UNIQUE("task_id")
);

CREATE TABLE IF NOT EXISTS "corporate_seals" (
	"id" serial PRIMARY KEY NOT NULL,
	"seal_id" varchar NOT NULL,
	"seal_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"description" text,
	"description_he" text,
	"badge_image_url" text NOT NULL,
	"badge_color" varchar DEFAULT '#10B981',
	"icon_name" varchar,
	"is_verified" boolean DEFAULT true,
	"verification_url" text,
	"qr_code_url" text,
	"issuing_authority" varchar,
	"authority_document_id" integer,
	"display_locations" jsonb,
	"display_priority" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"expiry_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "corporate_seals_seal_id_unique" UNIQUE("seal_id")
);

CREATE TABLE IF NOT EXISTS "dispute_resolutions" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispute_id" varchar NOT NULL,
	"booking_id" integer NOT NULL,
	"service_type" varchar NOT NULL,
	"customer_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"provider_type" varchar NOT NULL,
	"dispute_type" varchar NOT NULL,
	"dispute_reason" text NOT NULL,
	"dispute_reason_he" text,
	"customer_evidence" jsonb,
	"provider_evidence" jsonb,
	"original_amount" numeric(10, 2) NOT NULL,
	"disputed_amount" numeric(10, 2) NOT NULL,
	"refund_amount" numeric(10, 2),
	"status" varchar DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolution_he" text,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"is_escalated" boolean DEFAULT false,
	"escalated_at" timestamp,
	"escalation_reason" text,
	"legal_review_required" boolean DEFAULT false,
	"target_resolution_date" timestamp NOT NULL,
	"actual_resolution_date" timestamp,
	"sla_breached" boolean DEFAULT false,
	"ai_recommendation" text,
	"internal_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dispute_resolutions_dispute_id_unique" UNIQUE("dispute_id")
);

CREATE TABLE IF NOT EXISTS "provider_licenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"provider_type" varchar NOT NULL,
	"provider_name" varchar NOT NULL,
	"provider_email" varchar NOT NULL,
	"license_type" varchar NOT NULL,
	"license_number" varchar NOT NULL,
	"issuing_body" varchar NOT NULL,
	"issuing_body_he" varchar,
	"issued_date" date NOT NULL,
	"expiry_date" date,
	"status" varchar DEFAULT 'active' NOT NULL,
	"certificate_url" text NOT NULL,
	"verification_url" text,
	"is_mandatory" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"verified_by" integer,
	"verified_at" timestamp,
	"auto_suspend_on_expiry" boolean DEFAULT true,
	"reminder_days_before" integer DEFAULT 30,
	"last_reminder_sent" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "review_moderation" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"service_type" varchar NOT NULL,
	"original_review_text" text NOT NULL,
	"moderated_review_text" text,
	"rating" integer,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"flagged_reason" varchar,
	"flagged_by_rule" varchar,
	"ai_confidence_score" numeric(5, 2),
	"ai_detected_issues" jsonb,
	"ai_recommendation" varchar,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"moderator_notes" text,
	"legal_review_required" boolean DEFAULT false,
	"legal_reviewed_by" integer,
	"legal_reviewed_at" timestamp,
	"legal_notes" text,
	"provider_notified" boolean DEFAULT false,
	"provider_notified_at" timestamp,
	"provider_response_text" text,
	"provider_response_at" timestamp,
	"audit_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "review_moderation_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" varchar NOT NULL,
	"rule_name" varchar NOT NULL,
	"rule_name_he" varchar,
	"rule_type" varchar NOT NULL,
	"detection_method" varchar NOT NULL,
	"keywords" jsonb,
	"keywords_he" jsonb,
	"patterns" jsonb,
	"moderation_action" varchar DEFAULT 'flag_for_review' NOT NULL,
	"requires_legal_review" boolean DEFAULT false,
	"severity_level" varchar DEFAULT 'medium',
	"auto_escalate" boolean DEFAULT false,
	"legal_basis" text,
	"safe_harbor_applies" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "review_moderation_rules_rule_id_unique" UNIQUE("rule_id")
);

CREATE TABLE IF NOT EXISTS "authority_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_title" varchar NOT NULL,
	"department" varchar,
	"authority_type" varchar NOT NULL,
	"min_amount" numeric(15, 2),
	"max_amount" numeric(15, 2),
	"currency" varchar DEFAULT 'ILS',
	"requires_approval" boolean DEFAULT false,
	"approver_role" varchar,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "board_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_date" timestamp NOT NULL,
	"meeting_type" varchar NOT NULL,
	"location" varchar,
	"agenda" text NOT NULL,
	"minutes_document" text,
	"status" varchar DEFAULT 'scheduled',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "board_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"position" varchar NOT NULL,
	"bio" text,
	"photo_url" varchar,
	"is_active" boolean DEFAULT true,
	"appointed_date" date NOT NULL,
	"termination_date" date,
	"voting_rights" boolean DEFAULT true,
	"equity_shares" numeric(10, 4),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "board_members_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "board_meeting_attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"attended" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "board_meeting_attendees_meeting_id_board_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."board_meetings"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "board_meeting_attendees_member_id_board_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."board_members"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "contract_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" varchar NOT NULL,
	"template_name" varchar NOT NULL,
	"template_type" varchar NOT NULL,
	"contract_category" varchar NOT NULL,
	"jurisdiction_country" varchar NOT NULL,
	"jurisdiction_state" varchar,
	"language" varchar DEFAULT 'en',
	"version" varchar NOT NULL,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"template_content" text NOT NULL,
	"variables_list" jsonb,
	"approved_by" varchar,
	"legal_review_date" date,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contract_templates_template_id_unique" UNIQUE("template_id")
);

CREATE TABLE IF NOT EXISTS "delegation_of_authority" (
	"id" serial PRIMARY KEY NOT NULL,
	"doa_number" varchar NOT NULL,
	"delegator_employee_id" integer,
	"delegatee_employee_id" integer,
	"authority_type" varchar NOT NULL,
	"scope_description" text NOT NULL,
	"spending_limit" numeric(15, 2),
	"currency" varchar DEFAULT 'ILS',
	"start_date" date NOT NULL,
	"end_date" date,
	"reason" text,
	"approved_by" integer,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "delegation_of_authority_doa_number_unique" UNIQUE("doa_number")
);

CREATE TABLE IF NOT EXISTS "legal_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" varchar NOT NULL,
	"legal_name" varchar NOT NULL,
	"trading_name" varchar,
	"entity_type" varchar NOT NULL,
	"parent_entity_id" integer,
	"jurisdiction_country" varchar NOT NULL,
	"jurisdiction_state" varchar,
	"registration_number" varchar,
	"tax_identification_number" varchar,
	"vat_number" varchar,
	"incorporation_date" date,
	"fiscal_year_end" varchar,
	"base_currency" varchar DEFAULT 'ILS',
	"registered_address" text,
	"business_address" text,
	"is_active" boolean DEFAULT true,
	"is_holding_company" boolean DEFAULT false,
	"ownership_percentage" numeric(5, 2),
	"establishment_purpose" text,
	"authorized_capital" numeric(15, 2),
	"paid_up_capital" numeric(15, 2),
	"number_of_employees" integer DEFAULT 0,
	"annual_revenue" numeric(15, 2),
	"company_website" varchar,
	"legal_counsel" varchar,
	"auditor" varchar,
	"compliance_status" varchar DEFAULT 'compliant',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "legal_entities_entity_id_unique" UNIQUE("entity_id"),
	CONSTRAINT "legal_entities_registration_number_unique" UNIQUE("registration_number")
);

CREATE TABLE IF NOT EXISTS "generated_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_number" varchar NOT NULL,
	"template_id" integer NOT NULL,
	"entity_id" integer,
	"contract_type" varchar NOT NULL,
	"party_a_name" varchar NOT NULL,
	"party_a_role" varchar DEFAULT 'employer',
	"party_b_name" varchar NOT NULL,
	"party_b_role" varchar NOT NULL,
	"party_b_email" varchar,
	"variables_data" jsonb NOT NULL,
	"generated_content" text NOT NULL,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"signature_status" varchar DEFAULT 'pending',
	"docuseal_submission_id" varchar,
	"signed_document_url" text,
	"signed_by_party_a_at" timestamp,
	"signed_by_party_b_at" timestamp,
	"renewal_reminder_sent" boolean DEFAULT false,
	"next_renewal_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "generated_contracts_contract_number_unique" UNIQUE("contract_number"),
	CONSTRAINT "generated_contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "generated_contracts_entity_id_legal_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "intercompany_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"agreement_number" varchar NOT NULL,
	"agreement_type" varchar NOT NULL,
	"from_entity_id" integer NOT NULL,
	"to_entity_id" integer NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"auto_renewal" boolean DEFAULT false,
	"document_url" text,
	"annual_value" numeric(15, 2),
	"currency" varchar DEFAULT 'USD',
	"transfer_pricing_method" varchar,
	"arm_length_compliant" boolean DEFAULT true,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "intercompany_agreements_agreement_number_unique" UNIQUE("agreement_number"),
	CONSTRAINT "intercompany_agreements_from_entity_id_legal_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "intercompany_agreements_to_entity_id_legal_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "job_descriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar NOT NULL,
	"job_title" varchar NOT NULL,
	"department" varchar NOT NULL,
	"employment_type" varchar NOT NULL,
	"seniority_level" varchar NOT NULL,
	"reports_to" varchar,
	"direct_reports" integer DEFAULT 0,
	"location" varchar,
	"is_remote" boolean DEFAULT false,
	"job_summary" text NOT NULL,
	"key_responsibilities" text NOT NULL,
	"required_qualifications" text NOT NULL,
	"preferred_qualifications" text,
	"technical_skills" jsonb,
	"soft_skills" jsonb,
	"salary_range_min" numeric(10, 2),
	"salary_range_max" numeric(10, 2),
	"salary_currency" varchar DEFAULT 'ILS',
	"benefits_package" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_descriptions_job_id_unique" UNIQUE("job_id")
);

CREATE TABLE IF NOT EXISTS "jv_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar NOT NULL,
	"legal_name" varchar NOT NULL,
	"registration_number" varchar,
	"country" varchar NOT NULL,
	"primary_contact" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"address" text,
	"partnership_type" varchar NOT NULL,
	"equity_stake" numeric(10, 4),
	"is_active" boolean DEFAULT true,
	"partner_since" date NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "jv_partners_registration_number_unique" UNIQUE("registration_number")
);

CREATE TABLE IF NOT EXISTS "jv_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"contract_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"contract_type" varchar NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"auto_renewal" boolean DEFAULT false,
	"document_url" text,
	"revenue_share_percent" numeric(5, 2),
	"minimum_guarantee" numeric(12, 2),
	"currency" varchar DEFAULT 'ILS',
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "jv_contracts_contract_number_unique" UNIQUE("contract_number"),
	CONSTRAINT "jv_contracts_partner_id_jv_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."jv_partners"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "jv_revenue_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"partner_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_revenue" numeric(12, 2) NOT NULL,
	"revenue_share_percent" numeric(5, 2) NOT NULL,
	"share_amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"payment_status" varchar DEFAULT 'pending',
	"paid_at" timestamp,
	"invoice_url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "jv_revenue_shares_contract_id_jv_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."jv_contracts"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "jv_revenue_shares_partner_id_jv_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."jv_partners"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "organizational_chart" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" varchar NOT NULL,
	"node_name" varchar NOT NULL,
	"node_type" varchar NOT NULL,
	"parent_node_id" integer,
	"entity_id" integer,
	"employee_id" integer,
	"position_title" varchar,
	"department_name" varchar,
	"level" integer DEFAULT 0,
	"headcount" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"effective_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizational_chart_node_id_unique" UNIQUE("node_id"),
	CONSTRAINT "organizational_chart_entity_id_legal_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar NOT NULL,
	"legal_name" varchar,
	"registration_number" varchar,
	"tax_id" varchar,
	"country" varchar NOT NULL,
	"primary_contact" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"address" text,
	"supplier_type" varchar NOT NULL,
	"payment_terms" varchar DEFAULT 'Net 30',
	"preferred_currency" varchar DEFAULT 'ILS',
	"bank_account_details" jsonb,
	"is_active" boolean DEFAULT true,
	"is_approved" boolean DEFAULT false,
	"quality_score" numeric(3, 1) DEFAULT '0',
	"osek_classification" varchar(20) DEFAULT 'unknown' NOT NULL,
	"osek_certificate_url" text,
	"osek_classification_verified_at" timestamp with time zone,
	"osek_classification_verified_by" varchar(128),
	"onboarded_at" date NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "supplier_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"contract_number" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"auto_renewal" boolean DEFAULT false,
	"document_url" text,
	"total_value" numeric(12, 2),
	"currency" varchar DEFAULT 'ILS',
	"payment_schedule" varchar,
	"status" varchar DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_contracts_contract_number_unique" UNIQUE("contract_number"),
	CONSTRAINT "supplier_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "supplier_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"contract_id" integer,
	"invoice_number" varchar NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"payment_status" varchar DEFAULT 'pending',
	"paid_at" timestamp,
	"payment_method" varchar,
	"payment_reference" varchar,
	"invoice_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_payments_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "supplier_payments_contract_id_supplier_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "supplier_quality_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"evaluation_date" date NOT NULL,
	"quality_score" numeric(3, 1) NOT NULL,
	"delivery_score" numeric(3, 1) NOT NULL,
	"price_score" numeric(3, 1) NOT NULL,
	"service_score" numeric(3, 1) NOT NULL,
	"overall_score" numeric(3, 1) NOT NULL,
	"comments" text,
	"evaluated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "supplier_quality_scores_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "tax_treaties" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_a" varchar NOT NULL,
	"country_b" varchar NOT NULL,
	"treaty_name" varchar NOT NULL,
	"effective_date" date,
	"dividend_withholding_rate" numeric(5, 2),
	"interest_withholding_rate" numeric(5, 2),
	"royalty_withholding_rate" numeric(5, 2),
	"capital_gains_provision" text,
	"permanent_establishment_def" text,
	"treaty_document_url" text,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "transfer_pricing_documentation" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_year" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"document_type" varchar NOT NULL,
	"reporting_currency" varchar DEFAULT 'USD',
	"total_intercompany_revenue" numeric(15, 2),
	"total_intercompany_costs" numeric(15, 2),
	"document_url" text,
	"prepared_by" varchar,
	"reviewed_by" varchar,
	"approved_by" varchar,
	"submitted_to_authority" boolean DEFAULT false,
	"submission_date" date,
	"compliance_status" varchar DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "transfer_pricing_documentation_entity_id_legal_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."legal_entities"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "account_deletion_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" varchar(64) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"details" jsonb,
	"data_category" varchar(100),
	"records_affected" integer DEFAULT 0,
	"performed_by" varchar(100) NOT NULL,
	"ip_address" varchar(64),
	"content_hash" varchar(128),
	"previous_hash" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "company_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"legal_name" varchar DEFAULT 'Pet Wash™ Ltd' NOT NULL,
	"registration_number" varchar NOT NULL,
	"tax_id" varchar NOT NULL,
	"country" varchar DEFAULT 'IL' NOT NULL,
	"brand_name" varchar DEFAULT 'PetWash™' NOT NULL,
	"tagline" text,
	"logo" varchar,
	"website" varchar DEFAULT 'https://petwash.co.il',
	"support_email" varchar DEFAULT 'Support@PetWash.co.il',
	"support_phone" varchar,
	"headquarters" text NOT NULL,
	"city" varchar NOT NULL,
	"postal_code" varchar NOT NULL,
	"default_currency" varchar DEFAULT 'ILS',
	"vat_rate" numeric(5, 4) DEFAULT '0.18',
	"fiscal_year_start" varchar DEFAULT '01-01',
	"primary_bank_name" varchar,
	"primary_bank_account" varchar,
	"is_active" boolean DEFAULT true,
	"founded_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "company_profile_registration_number_unique" UNIQUE("registration_number"),
	CONSTRAINT "company_profile_tax_id_unique" UNIQUE("tax_id")
);

CREATE TABLE IF NOT EXISTS "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar NOT NULL,
	"description" text,
	"description_he" text,
	"platform_type" varchar NOT NULL,
	"commission_rate" numeric(5, 2),
	"is_marketplace" boolean DEFAULT false,
	"revenue_account" varchar,
	"expense_account" varchar,
	"is_active" boolean DEFAULT true,
	"launch_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "divisions_code_unique" UNIQUE("code"),
	CONSTRAINT "divisions_company_id_company_profile_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company_profile"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "contractor_lifecycle_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"contractor_type" varchar NOT NULL,
	"division_id" integer NOT NULL,
	"application_status" varchar DEFAULT 'pending' NOT NULL,
	"application_date" timestamp DEFAULT now(),
	"approved_date" timestamp,
	"approved_by" varchar,
	"rejection_reason" text,
	"background_check_status" varchar DEFAULT 'pending',
	"background_check_date" timestamp,
	"background_check_provider" varchar,
	"training_status" varchar DEFAULT 'not_started',
	"training_completed_date" timestamp,
	"certification_level" varchar,
	"certification_expiry_date" date,
	"contractor_status" varchar DEFAULT 'active' NOT NULL,
	"activated_date" timestamp,
	"deactivated_date" timestamp,
	"deactivation_reason" text,
	"total_earnings" numeric(12, 2) DEFAULT '0',
	"total_bookings" integer DEFAULT 0,
	"completion_rate" numeric(5, 2) DEFAULT '0',
	"average_rating" numeric(3, 2) DEFAULT '0',
	"total_reviews" integer DEFAULT 0,
	"last_compliance_check" timestamp,
	"next_compliance_check" timestamp,
	"compliance_score" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_lifecycle_records_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"label" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "departments_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "internal_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"role_code" varchar NOT NULL,
	"role_id" integer,
	"department" varchar,
	"franchisee_id" integer,
	"station_ids" jsonb,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"accepted_at" timestamp,
	"accepted_by_uid" varchar,
	"created_by" varchar NOT NULL,
	"created_by_uid" varchar NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "internal_invites_token_unique" UNIQUE("token"),
	CONSTRAINT "internal_invites_role_id_system_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."system_roles"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "internal_invites_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "invoice_headers" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar NOT NULL,
	"invoice_type" varchar NOT NULL,
	"seller_company_id" integer NOT NULL,
	"seller_legal_name" varchar DEFAULT 'Pet Wash™ Ltd' NOT NULL,
	"seller_tax_id" varchar NOT NULL,
	"seller_address" text NOT NULL,
	"customer_uid" varchar,
	"customer_name" varchar NOT NULL,
	"customer_email" varchar NOT NULL,
	"customer_tax_id" varchar,
	"customer_address" text,
	"division_id" integer NOT NULL,
	"division_name" varchar NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"base_amount" numeric(12, 2),
	"commission_amount" numeric(12, 2),
	"commission_vat" numeric(12, 2),
	"issue_date" date NOT NULL,
	"due_date" date,
	"paid_date" timestamp,
	"payment_status" varchar DEFAULT 'unpaid' NOT NULL,
	"payment_method" varchar,
	"payment_reference" varchar,
	"source_type" varchar,
	"source_id" varchar,
	"tax_reported" boolean DEFAULT false,
	"tax_reported_date" timestamp,
	"tax_period" varchar,
	"pdf_url" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"sent_at" timestamp,
	"voided_at" timestamp,
	"void_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoice_headers_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoice_headers_seller_company_id_company_profile_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."company_profile"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "invoice_headers_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"line_number" integer NOT NULL,
	"description" text NOT NULL,
	"description_he" text,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0',
	"subtotal" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.18' NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"item_type" varchar,
	"account_code" varchar,
	"reference_type" varchar,
	"reference_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invoice_items_invoice_id_invoice_headers_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice_headers"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "k9000_led_command_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"command_type" varchar NOT NULL,
	"previous_state" varchar,
	"new_state" varchar NOT NULL,
	"previous_color" varchar,
	"new_color" varchar NOT NULL,
	"previous_pattern" varchar,
	"new_pattern" varchar NOT NULL,
	"triggered_by" varchar NOT NULL,
	"reason" text,
	"success" boolean DEFAULT true,
	"error_message" text,
	"response_time_ms" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "k9000_led_command_history_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "k9000_led_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"state" varchar DEFAULT 'OFF' NOT NULL,
	"color" varchar DEFAULT 'OFF' NOT NULL,
	"pattern" varchar DEFAULT 'SOLID' NOT NULL,
	"source" varchar DEFAULT 'SYSTEM' NOT NULL,
	"manual_override" boolean DEFAULT false,
	"manual_expires_at" timestamp,
	"manual_set_by" varchar,
	"reason" text,
	"last_wash_session_id" varchar,
	"last_driver_id" varchar,
	"last_updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "k9000_led_status_station_id_unique" UNIQUE("station_id"),
	CONSTRAINT "k9000_led_status_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "ledger_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar NOT NULL,
	"batch_id" varchar,
	"entry_type" varchar NOT NULL,
	"account_code" varchar NOT NULL,
	"division_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"description" text NOT NULL,
	"description_he" text,
	"reference_type" varchar,
	"reference_id" varchar,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"status" varchar DEFAULT 'posted' NOT NULL,
	"voided_at" timestamp,
	"void_reason" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ledger_transactions_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "ledger_transactions_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "organizational_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar NOT NULL,
	"description" text,
	"level" integer NOT NULL,
	"reports_to_role_id" integer,
	"can_approve_budget" numeric(12, 2) DEFAULT '0',
	"can_manage_employees" boolean DEFAULT false,
	"can_access_financials" boolean DEFAULT false,
	"can_manage_stations" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizational_roles_code_unique" UNIQUE("code"),
	CONSTRAINT "organizational_roles_reports_to_role_id_organizational_roles_id_fk" FOREIGN KEY ("reports_to_role_id") REFERENCES "public"."organizational_roles"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "payment_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_code" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"account_type" varchar NOT NULL,
	"provider" varchar DEFAULT 'NAYAX_ISRAEL' NOT NULL,
	"merchant_id" varchar,
	"terminal_id" varchar,
	"currency" varchar DEFAULT 'ILS',
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"activated_date" timestamp,
	"deactivated_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_accounts_account_code_unique" UNIQUE("account_code")
);

CREATE TABLE IF NOT EXISTS "accounts_payable" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar NOT NULL,
	"supplier_id" integer NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" varchar DEFAULT 'pending',
	"payment_date" date,
	"payment_method" varchar,
	"payment_reference" varchar,
	"gl_account_code" varchar,
	"category" varchar,
	"approved_by" integer,
	"approved_at" timestamp,
	"invoice_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "accounts_payable_invoice_number_unique" UNIQUE("invoice_number")
);

CREATE TABLE IF NOT EXISTS "accounts_receivable" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"customer_type" varchar NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"payment_status" varchar DEFAULT 'pending',
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"balance_due" numeric(12, 2),
	"payment_date" date,
	"payment_method" varchar,
	"gl_account_code" varchar,
	"category" varchar,
	"invoice_url" text,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "accounts_receivable_invoice_number_unique" UNIQUE("invoice_number")
);

CREATE TABLE IF NOT EXISTS "australian_tax" (
	"id" serial PRIMARY KEY NOT NULL,
	"financial_year" varchar NOT NULL,
	"entity_id" integer NOT NULL,
	"abn" varchar,
	"acn" varchar,
	"tfn" varchar,
	"gross_revenue" numeric(15, 2) NOT NULL,
	"taxable_income" numeric(15, 2),
	"corporate_tax_rate" numeric(5, 2),
	"corporate_tax_owed" numeric(15, 2),
	"gst_collected" numeric(15, 2) DEFAULT '0',
	"gst_paid" numeric(15, 2) DEFAULT '0',
	"gst_net_owed" numeric(15, 2),
	"payg_withholding" numeric(15, 2) DEFAULT '0',
	"superannuation_contributions" numeric(15, 2) DEFAULT '0',
	"bas_statements" integer DEFAULT 0,
	"company_tax_return_filed" boolean DEFAULT false,
	"payment_summaries_issued" boolean DEFAULT false,
	"gst_return_frequency" varchar,
	"filing_deadline" date,
	"filed_date" date,
	"ato_reference" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "canadian_tax" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_year" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"business_number" varchar,
	"province" varchar NOT NULL,
	"gross_revenue" numeric(15, 2) NOT NULL,
	"federal_taxable_income" numeric(15, 2),
	"federal_tax_rate" numeric(5, 2),
	"federal_tax_owed" numeric(15, 2),
	"provincial_taxable_income" numeric(15, 2),
	"provincial_tax_rate" numeric(5, 2),
	"provincial_tax_owed" numeric(15, 2),
	"gst_hst_collected" numeric(15, 2) DEFAULT '0',
	"gst_hst_remitted" numeric(15, 2) DEFAULT '0',
	"cpp_contributions" numeric(15, 2) DEFAULT '0',
	"ei_contributions" numeric(15, 2) DEFAULT '0',
	"t2_filed" boolean DEFAULT false,
	"t4s_filed" boolean DEFAULT false,
	"t4as_filed" boolean DEFAULT false,
	"gst_hst_return" varchar,
	"filing_deadline" date,
	"filed_date" date,
	"confirmation_number" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "general_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_number" varchar NOT NULL,
	"entry_date" date NOT NULL,
	"account_code" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"account_type" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0',
	"credit" numeric(12, 2) DEFAULT '0',
	"currency" varchar DEFAULT 'ILS',
	"description" text NOT NULL,
	"reference_type" varchar,
	"reference_id" varchar,
	"vat_mode" varchar,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer NOT NULL,
	"entered_by" integer,
	"approved_by" integer,
	"is_reconciled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "general_ledger_entry_number_unique" UNIQUE("entry_number")
);

CREATE TABLE IF NOT EXISTS "legal_stamps" (
	"stamp_id" varchar(36) PRIMARY KEY NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_uid" varchar(128),
	"actor_role" varchar(32) DEFAULT 'system',
	"amount_cents" integer,
	"currency" varchar(8) DEFAULT 'ILS',
	"metadata" jsonb,
	"previous_stamp_hash" varchar(64),
	"content_hash" varchar(64) NOT NULL,
	"signature" text NOT NULL,
	"gcs_path" text,
	"firestore_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tax_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" integer NOT NULL,
	"action" varchar NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"user_id" integer,
	"user_email" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"audit_hash" varchar NOT NULL,
	"previous_audit_hash" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tax_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_number" varchar NOT NULL,
	"tax_return_id" integer,
	"payment_type" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"payment_date" date NOT NULL,
	"payment_method" varchar,
	"bank_reference" varchar,
	"ita_receipt_number" varchar,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer,
	"status" varchar DEFAULT 'pending',
	"confirmation_url" text,
	"paid_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_payments_payment_number_unique" UNIQUE("payment_number")
);

CREATE TABLE IF NOT EXISTS "tax_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_number" varchar NOT NULL,
	"return_type" varchar NOT NULL,
	"fiscal_year" integer NOT NULL,
	"fiscal_period" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_revenue" numeric(12, 2) NOT NULL,
	"taxable_income" numeric(12, 2) NOT NULL,
	"vat_collected" numeric(12, 2) DEFAULT '0',
	"vat_paid" numeric(12, 2) DEFAULT '0',
	"net_vat_owed" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'draft',
	"submitted_to_ita" boolean DEFAULT false,
	"submitted_at" timestamp,
	"ita_reference_number" varchar,
	"approved_at" timestamp,
	"prepared_by" integer,
	"reviewed_by" integer,
	"notes" text,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_returns_return_number_unique" UNIQUE("return_number")
);

CREATE TABLE IF NOT EXISTS "uk_tax" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_year" varchar NOT NULL,
	"entity_id" integer NOT NULL,
	"company_registration_number" varchar,
	"utr" varchar,
	"vat_number" varchar,
	"gross_revenue" numeric(15, 2) NOT NULL,
	"corporation_taxable_profit" numeric(15, 2),
	"corporation_tax_rate" numeric(5, 2),
	"corporation_tax_owed" numeric(15, 2),
	"vat_collected" numeric(15, 2) DEFAULT '0',
	"vat_paid" numeric(15, 2) DEFAULT '0',
	"vat_net_owed" numeric(15, 2),
	"paye_withheld" numeric(15, 2) DEFAULT '0',
	"nic_employer" numeric(15, 2) DEFAULT '0',
	"nic_employee" numeric(15, 2) DEFAULT '0',
	"ct600_filed" boolean DEFAULT false,
	"p60s_issued" boolean DEFAULT false,
	"mtd_compliant" boolean DEFAULT false,
	"vat_return_frequency" varchar,
	"filing_deadline" date,
	"filed_date" date,
	"hmrc_reference" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "us_federal_tax" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_year" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"ein" varchar,
	"entity_type" varchar NOT NULL,
	"gross_revenue" numeric(15, 2) NOT NULL,
	"deductions" numeric(15, 2) DEFAULT '0',
	"taxable_income" numeric(15, 2) NOT NULL,
	"federal_tax_rate" numeric(5, 2),
	"federal_tax_owed" numeric(15, 2) NOT NULL,
	"estimated_payments_made" numeric(15, 2) DEFAULT '0',
	"form_1120_filed" boolean DEFAULT false,
	"form_1120s_filed" boolean DEFAULT false,
	"form_1065_filed" boolean DEFAULT false,
	"filing_deadline" date NOT NULL,
	"filed_date" date,
	"confirmation_number" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "us_federal_tax_filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer,
	"filing_type" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"quarter" integer,
	"tax_amount" varchar NOT NULL,
	"withholding_amount" varchar,
	"filing_date" date NOT NULL,
	"confirmation_number" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "us_payroll_tax" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_year" integer NOT NULL,
	"quarter" varchar,
	"entity_id" integer NOT NULL,
	"total_w2_wages" numeric(15, 2) DEFAULT '0',
	"total_w2_employees" integer DEFAULT 0,
	"total_1099_payments" numeric(15, 2) DEFAULT '0',
	"total_1099_contractors" integer DEFAULT 0,
	"federal_withholding" numeric(15, 2) DEFAULT '0',
	"social_security_withheld" numeric(15, 2) DEFAULT '0',
	"medicare_withheld" numeric(15, 2) DEFAULT '0',
	"state_withholding" numeric(15, 2) DEFAULT '0',
	"form_941_filed" boolean DEFAULT false,
	"form_940_filed" boolean DEFAULT false,
	"w2s_filed" boolean DEFAULT false,
	"w3_filed" boolean DEFAULT false,
	"form_1099s_filed" boolean DEFAULT false,
	"filing_deadline" date,
	"filed_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "us_state_nexus" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar NOT NULL,
	"nexus_type" varchar NOT NULL,
	"established_date" date NOT NULL,
	"sales_threshold" varchar,
	"transaction_threshold" integer,
	"registration_number" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "us_state_tax" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_year" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"state" varchar NOT NULL,
	"state_ein" varchar,
	"has_nexus" boolean DEFAULT false,
	"nexus_type" varchar,
	"gross_revenue" numeric(15, 2),
	"apportionment_percentage" numeric(5, 2),
	"taxable_income" numeric(15, 2),
	"state_tax_rate" numeric(5, 2),
	"income_tax_owed" numeric(15, 2) DEFAULT '0',
	"sales_tax_collected" numeric(15, 2) DEFAULT '0',
	"sales_tax_remitted" numeric(15, 2) DEFAULT '0',
	"filing_deadline" date,
	"filed_date" date,
	"confirmation_number" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "us_state_tax_filings" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer,
	"state" varchar NOT NULL,
	"filing_type" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"quarter" integer,
	"tax_amount" varchar NOT NULL,
	"filing_date" date NOT NULL,
	"confirmation_number" varchar,
	"filing_status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "franchise_royalty_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"franchisee_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_revenue" numeric(12, 2) NOT NULL,
	"royalty_percent" numeric(5, 2) NOT NULL,
	"royalty_amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"payment_status" varchar DEFAULT 'pending',
	"due_date" date NOT NULL,
	"paid_date" date,
	"payment_method" varchar,
	"payment_reference" varchar,
	"invoice_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "franchise_royalty_payments_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "watchdog_auto_fixes" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer,
	"fix_type" varchar(100) NOT NULL,
	"fix_code" text,
	"explanation" text,
	"risks" text,
	"applied_at" timestamp NOT NULL,
	"success" boolean NOT NULL,
	"result" text,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "watchdog_checkout_monitoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"step" varchar(100) NOT NULL,
	"amount" integer,
	"payment_method" varchar(100),
	"error_message" text,
	"timestamp" timestamp NOT NULL,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "watchdog_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"severity" varchar(50) NOT NULL,
	"category" varchar(100) NOT NULL,
	"affected_service" varchar(100),
	"description" text NOT NULL,
	"suggested_fix" text,
	"detected_at" timestamp NOT NULL,
	"status" varchar(50) NOT NULL,
	"auto_fix_attempted" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"user_id" varchar(255),
	"session_id" varchar(255),
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "watchdog_registration_monitoring" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"step" varchar(100) NOT NULL,
	"email" varchar(255),
	"failure_reason" text,
	"timestamp" timestamp NOT NULL,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "watchdog_user_journeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"journey" varchar(255) NOT NULL,
	"step" varchar(255) NOT NULL,
	"success" boolean NOT NULL,
	"duration" integer,
	"timestamp" timestamp NOT NULL,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "watchdog_user_struggles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"action" varchar(255) NOT NULL,
	"failure_count" integer NOT NULL,
	"likely_cause" text,
	"suggested_guidance" text,
	"ux_improvement" text,
	"urgency" varchar(50) NOT NULL,
	"detected_at" timestamp NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"context" jsonb
);

CREATE TABLE IF NOT EXISTS "airbnb_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" varchar NOT NULL,
	"host_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"property_type" varchar NOT NULL,
	"room_type" varchar NOT NULL,
	"max_guests" integer NOT NULL,
	"bedrooms" integer NOT NULL,
	"beds" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"amenities" jsonb,
	"pet_policy" jsonb,
	"price_per_night" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"cleaning_fee" numeric(10, 2),
	"service_fee" numeric(10, 2),
	"location" jsonb,
	"images" jsonb,
	"calendar_url" varchar,
	"instant_book_enabled" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "airbnb_listings_listing_id_unique" UNIQUE("listing_id")
);

CREATE TABLE IF NOT EXISTS "airbnb_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"listing_id" varchar NOT NULL,
	"guest_id" varchar NOT NULL,
	"guest_name" varchar NOT NULL,
	"guest_email" varchar,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"number_of_guests" integer NOT NULL,
	"number_of_pets" integer DEFAULT 0,
	"pet_details" jsonb,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"booking_status" varchar NOT NULL,
	"confirmation_code" varchar,
	"special_requests" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "airbnb_bookings_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "airbnb_bookings_listing_id_airbnb_listings_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."airbnb_listings"("listing_id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_com_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"property_id" varchar NOT NULL,
	"hotel_id" varchar NOT NULL,
	"property_name" varchar NOT NULL,
	"property_type" varchar NOT NULL,
	"description" text,
	"address" jsonb,
	"coordinates" jsonb,
	"star_rating" integer,
	"review_score" numeric(3, 1),
	"total_reviews" integer DEFAULT 0,
	"amenities" jsonb,
	"pet_policy" jsonb,
	"pet_fees" jsonb,
	"room_types" jsonb,
	"images" jsonb,
	"policies" jsonb,
	"calendar_url" varchar,
	"commission_rate" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_com_listings_property_id_unique" UNIQUE("property_id")
);

CREATE TABLE IF NOT EXISTS "booking_com_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"reservation_id" varchar NOT NULL,
	"property_id" varchar NOT NULL,
	"guest_name" varchar NOT NULL,
	"guest_email" varchar,
	"guest_phone" varchar,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"room_type" varchar NOT NULL,
	"number_of_guests" integer NOT NULL,
	"number_of_pets" integer DEFAULT 0,
	"pet_details" jsonb,
	"total_price" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"commission" numeric(10, 2),
	"reservation_status" varchar NOT NULL,
	"confirmation_code" varchar,
	"special_requests" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_com_reservations_reservation_id_unique" UNIQUE("reservation_id"),
	CONSTRAINT "booking_com_reservations_property_id_booking_com_listings_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."booking_com_listings"("property_id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "google_calendar_integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"calendar_id" varchar NOT NULL,
	"calendar_name" varchar NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expiry" timestamp NOT NULL,
	"scope" text NOT NULL,
	"sync_enabled" boolean DEFAULT true,
	"sync_direction" varchar DEFAULT 'bidirectional',
	"last_synced_at" timestamp,
	"sync_errors" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"integration_id" integer NOT NULL,
	"event_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"location" varchar,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false,
	"attendees" jsonb,
	"recurrence" jsonb,
	"reminders" jsonb,
	"status" varchar DEFAULT 'confirmed',
	"visibility" varchar DEFAULT 'public',
	"external_event_id" varchar,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "calendar_events_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "calendar_events_integration_id_google_calendar_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."google_calendar_integrations"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "petfinder_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"petfinder_id" varchar NOT NULL,
	"organization_id" varchar NOT NULL,
	"pet_type" varchar NOT NULL,
	"species" varchar NOT NULL,
	"breed" varchar,
	"color" varchar,
	"age" varchar,
	"gender" varchar,
	"size" varchar,
	"name" varchar NOT NULL,
	"description" text,
	"photos" jsonb,
	"videos" jsonb,
	"status" varchar NOT NULL,
	"attributes" jsonb,
	"environment" jsonb,
	"tags" jsonb,
	"contact" jsonb,
	"published_at" timestamp,
	"last_updated_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "petfinder_listings_petfinder_id_unique" UNIQUE("petfinder_id")
);

CREATE TABLE IF NOT EXISTS "logistics_warehouses" (
	"id" serial PRIMARY KEY NOT NULL,
	"warehouse_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"address" text NOT NULL,
	"city" varchar NOT NULL,
	"country" varchar DEFAULT 'IL',
	"coordinates" jsonb,
	"capacity" integer,
	"current_utilization" numeric(5, 2),
	"manager_employee_id" integer,
	"operating_hours" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "logistics_warehouses_warehouse_id_unique" UNIQUE("warehouse_id")
);

CREATE TABLE IF NOT EXISTS "logistics_fulfillment_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" varchar NOT NULL,
	"order_type" varchar NOT NULL,
	"station_id" varchar,
	"warehouse_id" integer,
	"requested_by" integer,
	"assigned_to" integer,
	"items" jsonb NOT NULL,
	"priority" varchar DEFAULT 'normal',
	"status" varchar DEFAULT 'pending',
	"order_date" timestamp DEFAULT now(),
	"ship_date" timestamp,
	"delivery_date" timestamp,
	"estimated_delivery" date,
	"tracking_number" varchar,
	"shipping_carrier" varchar,
	"delivery_address" text,
	"delivery_notes" text,
	"total_value" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "logistics_fulfillment_orders_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "logistics_fulfillment_orders_warehouse_id_logistics_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."logistics_warehouses"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "logistics_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"product_name_he" varchar,
	"category" varchar NOT NULL,
	"warehouse_id" integer,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" varchar DEFAULT 'units',
	"reorder_level" integer DEFAULT 0,
	"reorder_quantity" integer DEFAULT 0,
	"unit_cost" numeric(10, 2),
	"supplier_id" integer,
	"last_restocked_date" date,
	"expiry_date" date,
	"location_in_warehouse" varchar,
	"barcode_ean" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "logistics_inventory_sku_unique" UNIQUE("sku"),
	CONSTRAINT "logistics_inventory_warehouse_id_logistics_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."logistics_warehouses"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"icon" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"rarity" varchar(50) DEFAULT 'common' NOT NULL,
	"tier" varchar(50),
	"conditions" jsonb NOT NULL,
	"points_reward" integer DEFAULT 0 NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "badges_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "daily_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"icon" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"target" integer NOT NULL,
	"duration" varchar(50) DEFAULT 'daily' NOT NULL,
	"points_reward" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	"bonus_reward" varchar(255),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_challenges_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "loyalty_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"tier" varchar(50) DEFAULT 'bronze' NOT NULL,
	"tier_since" timestamp DEFAULT now() NOT NULL,
	"tier_progress" integer DEFAULT 0 NOT NULL,
	"tier_threshold" integer DEFAULT 1000 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"total_washes" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_wash_date" timestamp,
	"preferred_stations" jsonb DEFAULT '[]'::jsonb,
	"preferred_times" jsonb DEFAULT '[]'::jsonb,
	"average_wash_interval" integer DEFAULT 21,
	"next_predicted_wash" timestamp,
	"personalized_offers" jsonb DEFAULT '[]'::jsonb,
	"is_vip" boolean DEFAULT false NOT NULL,
	"vip_since" timestamp,
	"concierge_access" boolean DEFAULT false NOT NULL,
	"priority_support" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_profiles_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "points_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"source" varchar(100) NOT NULL,
	"source_id" varchar(255),
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referral_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"referral_id" integer,
	"role" varchar(16) NOT NULL,
	"amount_ils" numeric(10, 2) NOT NULL,
	"status" varchar(24) DEFAULT 'earned' NOT NULL,
	"reason" text,
	"issued_at" timestamp with time zone,
	"issued_ref" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"inviter_user_id" varchar NOT NULL,
	"invitee_user_id" varchar,
	"invitee_email" text,
	"code" varchar(8) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"inviter_credited_at" timestamp,
	"invitee_credited_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "referrals_code_unique" UNIQUE("code"),
	CONSTRAINT "referrals_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "referrals_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "rewards_marketplace" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"image_url" varchar(500),
	"type" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"points_cost" integer NOT NULL,
	"cash_value" numeric(10, 2),
	"currency" varchar(10) DEFAULT 'ILS',
	"stock" integer,
	"max_redemptions_per_user" integer DEFAULT 1,
	"min_tier" varchar(50),
	"partner_id" integer,
	"partner_name" varchar(255),
	"external_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_marketplace_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "user_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"badge_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	"progress" integer DEFAULT 0,
	"is_new" boolean DEFAULT true NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"challenge_id" integer NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"claimed_at" timestamp,
	"expires_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"reward_id" integer NOT NULL,
	"points_cost" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"voucher_code" varchar(255),
	"redemption_code" varchar(255),
	"fulfilled_at" timestamp,
	"expires_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_redemptions_voucher_code_unique" UNIQUE("voucher_code")
);

CREATE TABLE IF NOT EXISTS "ops_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"severity" varchar NOT NULL,
	"category" varchar NOT NULL,
	"station_id" varchar,
	"franchise_id" integer,
	"reported_by" integer,
	"assigned_to" integer,
	"region" varchar,
	"country" varchar,
	"time_zone" varchar,
	"escalation_level" integer DEFAULT 0,
	"escalated_to" integer,
	"escalated_at" timestamp,
	"escalation_reason" text,
	"escalation_history" jsonb,
	"status" varchar DEFAULT 'open',
	"priority" varchar DEFAULT 'medium',
	"impact_level" varchar,
	"root_cause" text,
	"resolution" text,
	"preventive_measures" text,
	"sla_deadline" timestamp,
	"sla_breach" boolean DEFAULT false,
	"sla_breach_reason" text,
	"compliance_flags" jsonb,
	"modified_by" integer,
	"action_log" jsonb,
	"reported_at" timestamp DEFAULT now(),
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"attachments" jsonb,
	CONSTRAINT "ops_incidents_incident_id_unique" UNIQUE("incident_id"),
	CONSTRAINT "fk_incidents_franchise" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "ops_sla_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" integer NOT NULL,
	"sla_type" varchar NOT NULL,
	"target_minutes" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"deadline_time" timestamp NOT NULL,
	"completed_time" timestamp,
	"actual_minutes" integer,
	"is_breach" boolean DEFAULT false,
	"breach_minutes" integer,
	"status" varchar DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ops_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"priority" varchar DEFAULT 'medium',
	"category" varchar NOT NULL,
	"assigned_to" integer,
	"station_id" varchar,
	"franchise_id" integer,
	"created_by" integer,
	"region" varchar,
	"country" varchar,
	"time_zone" varchar,
	"escalation_level" integer DEFAULT 0,
	"escalated_to" integer,
	"escalated_at" timestamp,
	"escalation_reason" text,
	"escalation_history" jsonb,
	"due_date" timestamp,
	"status" varchar DEFAULT 'pending',
	"completed_at" timestamp,
	"completion_notes" text,
	"attachments" jsonb,
	"modified_by" integer,
	"action_log" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ops_tasks_task_id_unique" UNIQUE("task_id"),
	CONSTRAINT "fk_ops_tasks_franchise" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "pw_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" varchar NOT NULL,
	"idempotency_key" varchar,
	"transaction_type" varchar NOT NULL,
	"vertical" varchar NOT NULL,
	"commercial_model" varchar NOT NULL,
	"customer_id" varchar,
	"provider_id" varchar,
	"machine_id" varchar,
	"gross_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"processor_fee_cents" integer DEFAULT 0 NOT NULL,
	"provider_gross_cents" integer DEFAULT 0 NOT NULL,
	"provider_payout_cents" integer DEFAULT 0 NOT NULL,
	"net_revenue_cents" integer NOT NULL,
	"vat_rate" varchar DEFAULT '0.18' NOT NULL,
	"vat_mode" varchar,
	"requires_provider_tax_invoice" boolean DEFAULT false NOT NULL,
	"payment_method" varchar,
	"payment_processor" varchar DEFAULT 'nayax',
	"wallet_used" boolean DEFAULT false NOT NULL,
	"invoice_id" varchar,
	"receipt_id" varchar,
	"commission_invoice_id" varchar,
	"booking_id" varchar,
	"nayax_transaction_id" varchar,
	"wallet_ledger_entry_id" varchar,
	"general_ledger_entry_id" varchar,
	"status" varchar DEFAULT 'created' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp,
	"reversed_at" timestamp,
	CONSTRAINT "pw_payments_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "pw_payments_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "pw_provider_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"payout_id" varchar NOT NULL,
	"payment_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"vertical" varchar NOT NULL,
	"commercial_model" varchar NOT NULL,
	"gross_cents" integer NOT NULL,
	"vat_in_share_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"commission_rate" varchar NOT NULL,
	"requires_tax_invoice" boolean DEFAULT true NOT NULL,
	"provider_is_exempt" boolean DEFAULT false NOT NULL,
	"provider_tax_invoice_id" varchar,
	"commission_invoice_id" varchar,
	"commission_invoice_issued_at" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"escrow_release_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "pw_provider_payouts_payout_id_unique" UNIQUE("payout_id")
);

CREATE TABLE IF NOT EXISTS "pw_reconciliation_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" varchar NOT NULL,
	"report_date" varchar NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"total_payments" integer DEFAULT 0 NOT NULL,
	"total_gross_cents" integer DEFAULT 0 NOT NULL,
	"total_vat_cents" integer DEFAULT 0 NOT NULL,
	"total_processor_fees" integer DEFAULT 0 NOT NULL,
	"total_provider_payouts" integer DEFAULT 0 NOT NULL,
	"total_net_revenue" integer DEFAULT 0 NOT NULL,
	"total_tax_docs" integer DEFAULT 0 NOT NULL,
	"total_payouts_count" integer DEFAULT 0 NOT NULL,
	"discrepancy_count" integer DEFAULT 0 NOT NULL,
	"critical_issues" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"integrity_hash" varchar,
	"prev_report_hash" varchar,
	"status" varchar DEFAULT 'complete' NOT NULL,
	CONSTRAINT "pw_reconciliation_reports_report_id_unique" UNIQUE("report_id")
);

CREATE TABLE IF NOT EXISTS "pw_tax_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_doc_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"related_payment_id" varchar,
	"related_payout_id" varchar,
	"booking_id" varchar,
	"customer_id" varchar,
	"provider_id" varchar,
	"machine_id" varchar,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar DEFAULT 'ILS' NOT NULL,
	"vat_rate" varchar DEFAULT '0.18',
	"vat_number" varchar DEFAULT '517145033',
	"external_doc_id" varchar,
	"sequence_year" integer,
	"sequence_number" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"voided_at" timestamp,
	"drive_file_id" text,
	"drive_folder_id" text,
	"pdf_sha256" text,
	"archive_status" text DEFAULT 'PENDING' NOT NULL,
	"archive_attempts" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp,
	"retention_until" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pw_tax_documents_tax_doc_id_unique" UNIQUE("tax_doc_id")
);

CREATE TABLE IF NOT EXISTS "adp_integration" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_code" varchar NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"certificate_path" varchar,
	"environment" varchar DEFAULT 'production',
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"sync_configuration" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "deel_integration" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" varchar NOT NULL,
	"api_key" text NOT NULL,
	"webhook_secret" text,
	"environment" varchar DEFAULT 'production',
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"sync_configuration" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "deel_integration_organization_id_unique" UNIQUE("organization_id")
);

CREATE TABLE IF NOT EXISTS "gusto_integration" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" varchar NOT NULL,
	"api_token" text NOT NULL,
	"refresh_token" text,
	"token_expiry" timestamp,
	"environment" varchar DEFAULT 'production',
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"sync_configuration" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "gusto_integration_company_id_unique" UNIQUE("company_id")
);

CREATE TABLE IF NOT EXISTS "payroll_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_name" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"api_key" text,
	"api_secret" text,
	"api_base_url" varchar,
	"webhook_url" varchar,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"sync_errors" jsonb,
	"configuration" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "payroll_employee_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"internal_employee_id" integer NOT NULL,
	"external_employee_id" varchar NOT NULL,
	"external_employee_uuid" varchar,
	"employee_name" varchar NOT NULL,
	"employee_email" varchar,
	"sync_status" varchar DEFAULT 'active',
	"last_synced_at" timestamp,
	"sync_errors" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_employee_mappings_provider_id_payroll_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payroll_providers"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "payroll_pay_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"external_pay_period_id" varchar,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"frequency" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"total_gross_pay" numeric(12, 2),
	"total_net_pay" numeric(12, 2),
	"total_taxes" numeric(12, 2),
	"total_deductions" numeric(12, 2),
	"employee_count" integer,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_pay_periods_provider_id_payroll_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payroll_providers"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "payroll_paychecks" (
	"id" serial PRIMARY KEY NOT NULL,
	"pay_period_id" integer NOT NULL,
	"employee_mapping_id" integer NOT NULL,
	"external_paycheck_id" varchar,
	"employee_name" varchar NOT NULL,
	"gross_pay" numeric(10, 2) NOT NULL,
	"net_pay" numeric(10, 2) NOT NULL,
	"federal_tax" numeric(10, 2),
	"state_tax" numeric(10, 2),
	"local_tax" numeric(10, 2),
	"social_security" numeric(10, 2),
	"medicare" numeric(10, 2),
	"other_deductions" numeric(10, 2),
	"earnings" jsonb,
	"deductions" jsonb,
	"taxes" jsonb,
	"direct_deposits" jsonb,
	"status" varchar DEFAULT 'pending',
	"pay_date" date,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_paychecks_pay_period_id_payroll_pay_periods_id_fk" FOREIGN KEY ("pay_period_id") REFERENCES "public"."payroll_pay_periods"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "payroll_paychecks_employee_mapping_id_payroll_employee_mappings_id_fk" FOREIGN KEY ("employee_mapping_id") REFERENCES "public"."payroll_employee_mappings"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "payroll_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"sync_type" varchar NOT NULL,
	"sync_direction" varchar NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_succeeded" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0,
	"sync_status" varchar NOT NULL,
	"error_details" jsonb,
	"sync_data" jsonb,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_sync_logs_provider_id_payroll_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payroll_providers"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "payroll_timesheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_mapping_id" integer NOT NULL,
	"external_timesheet_id" varchar,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"regular_hours" numeric(6, 2),
	"overtime_hours" numeric(6, 2),
	"double_time_hours" numeric(6, 2),
	"pto_hours" numeric(6, 2),
	"sick_hours" numeric(6, 2),
	"holiday_hours" numeric(6, 2),
	"total_hours" numeric(6, 2),
	"hourly_rate" numeric(8, 2),
	"total_pay" numeric(10, 2),
	"status" varchar DEFAULT 'draft',
	"approved_by" varchar,
	"approved_at" timestamp,
	"time_entries" jsonb,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payroll_timesheets_employee_mapping_id_payroll_employee_mappings_id_fk" FOREIGN KEY ("employee_mapping_id") REFERENCES "public"."payroll_employee_mappings"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "compliance_certifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"certification_type" varchar NOT NULL,
	"certificate_number" varchar,
	"issued_by" varchar NOT NULL,
	"issued_date" date NOT NULL,
	"expiry_date" date NOT NULL,
	"certificate_url" text,
	"status" varchar DEFAULT 'active',
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "policy_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"category" varchar NOT NULL,
	"description" text,
	"document_url" text NOT NULL,
	"version" varchar NOT NULL,
	"effective_date" date NOT NULL,
	"expiry_date" date,
	"requires_acknowledgment" boolean DEFAULT true,
	"target_audience" varchar NOT NULL,
	"department" varchar,
	"is_active" boolean DEFAULT true,
	"created_by" integer,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "policy_documents_policy_id_unique" UNIQUE("policy_id")
);

CREATE TABLE IF NOT EXISTS "policy_acknowledgments" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"version" varchar NOT NULL,
	"acknowledged_at" timestamp DEFAULT now(),
	"ip_address" varchar,
	"user_agent" varchar,
	"digital_signature" text,
	CONSTRAINT "policy_acknowledgments_policy_id_policy_documents_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policy_documents"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "ai_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"criteria" jsonb NOT NULL,
	"user_count" integer DEFAULT 0 NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"last_refreshed" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"platform" text,
	"target_segment" jsonb NOT NULL,
	"target_users" integer,
	"subject" text,
	"content" text NOT NULL,
	"call_to_action" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"sent" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"opened" integer DEFAULT 0 NOT NULL,
	"clicked" integer DEFAULT 0 NOT NULL,
	"converted" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"budget" numeric(10, 2),
	"spent" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"platform" text,
	"subject" text,
	"content" text NOT NULL,
	"metadata" jsonb,
	"status" text DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp,
	"read_at" timestamp
);

CREATE TABLE IF NOT EXISTS "platform_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"platform" text NOT NULL,
	"user_id" text,
	"data" jsonb NOT NULL,
	"triggers" jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "platform_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"date" timestamp NOT NULL,
	"revenue" numeric(10, 2) DEFAULT '0' NOT NULL,
	"transactions" integer DEFAULT 0 NOT NULL,
	"avg_transaction_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"returning_users" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"conversion_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_360_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"total_spending" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_transactions" integer DEFAULT 0 NOT NULL,
	"platforms_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"favorite_service" text,
	"loyalty_tier" text DEFAULT 'bronze' NOT NULL,
	"lifecycle_stage" text DEFAULT 'new' NOT NULL,
	"first_purchase_date" timestamp,
	"last_activity_date" timestamp,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"predicted_churn_probability" numeric(5, 2),
	"predicted_lifetime_value" numeric(10, 2),
	"location" text,
	"preferred_language" text DEFAULT 'he',
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_360_profiles_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "user_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"action" text NOT NULL,
	"resource" text,
	"resource_id" text,
	"metadata" jsonb,
	"session_id" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wallet_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_balances_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"type" text NOT NULL,
	"platform" text NOT NULL,
	"description" text NOT NULL,
	"reference_id" text,
	"balance_after" numeric(10, 2) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "action_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_group" varchar(64),
	"sequence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_impact" numeric(10, 2),
	"confidence" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "activation_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"machine_id" varchar(64) NOT NULL,
	"event" varchar(50) NOT NULL,
	"status" varchar(30),
	"detail" text,
	"error_code" varchar(50),
	"ip" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "activation_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"machine_id" varchar(64) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"status" varchar(30) DEFAULT 'created' NOT NULL,
	"source_type" varchar(30) DEFAULT 'dynamic_qr' NOT NULL,
	"activation_token" varchar(128) NOT NULL,
	"nayax_session_id" varchar(128),
	"price_cents" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"qr_nonce" varchar(64) NOT NULL,
	"ip" varchar(64),
	"user_agent" text,
	"vend_sent_at" timestamp,
	"machine_acked_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_action_reversals" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_txn_id" varchar(100) NOT NULL,
	"reversed_by_txn_id" varchar(100),
	"admin_uid" varchar(200) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "admin_action_reversals_original_txn_id_unique" UNIQUE("original_txn_id")
);

CREATE TABLE IF NOT EXISTS "alert_delivery_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" varchar(64),
	"channel" varchar(16),
	"recipient" varchar(128),
	"delivered" boolean DEFAULT false NOT NULL,
	"response_time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "alert_priority_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_id" integer NOT NULL,
	"priority_score" numeric DEFAULT '0' NOT NULL,
	"severity_pts" numeric DEFAULT '0' NOT NULL,
	"financial_pts" numeric DEFAULT '0' NOT NULL,
	"entities_pts" numeric DEFAULT '0' NOT NULL,
	"trend_pts" numeric DEFAULT '0' NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"reason_chips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "anomaly_clusters" (
	"id" serial PRIMARY KEY NOT NULL,
	"cluster_key" varchar(128) NOT NULL,
	"root_cause_label" varchar(128) NOT NULL,
	"signal_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anomaly_clusters_cluster_key_unique" UNIQUE("cluster_key")
);

CREATE TABLE IF NOT EXISTS "anomaly_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"anomaly_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"metric_value" numeric DEFAULT '0' NOT NULL,
	"baseline_value" numeric DEFAULT '0' NOT NULL,
	"deviation_pct" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"context_json" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "apple_wallet_device_registrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_library_identifier" text NOT NULL,
	"push_token" text NOT NULL,
	"pass_type_identifier" text NOT NULL,
	"serial_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "application_fraud_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"signal_type" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"description" text NOT NULL,
	"evidence_json" jsonb,
	"ip_address" varchar(100),
	"ip_country" varchar(10),
	"device_fingerprint" varchar(255),
	"user_agent" text,
	"matched_application_ids" jsonb DEFAULT '[]'::jsonb,
	"match_type" varchar(50),
	"status" varchar(20) DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "application_step_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"step_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"completed_at" timestamp,
	"data_snapshot" jsonb,
	"validation_errors" jsonb,
	"last_updated_at" timestamp DEFAULT now(),
	"session_id" varchar(255),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "approval_bottleneck_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_name" varchar(128) NOT NULL,
	"trigger_type" varchar(64) NOT NULL,
	"division_code" varchar(40),
	"min_amount_cents" integer DEFAULT 0 NOT NULL,
	"max_amount_cents" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"escalation_hours" integer DEFAULT 48 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_chain_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"required_role" varchar(64) NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"timeout_hours" integer DEFAULT 24 NOT NULL,
	"escalate_to_role" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_chain_steps_chain_id_approval_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."approval_chains"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"requested_by_uid" varchar(128) NOT NULL,
	"current_step_order" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"amount_cents" integer,
	"division_code" varchar(40),
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_requests_chain_id_approval_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."approval_chains"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "approval_request_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"actor_uid" varchar(128) NOT NULL,
	"action" varchar(20) NOT NULL,
	"comment" text,
	"acted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_request_actions_request_id_approval_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "approval_workload_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approver_uid" varchar(128) NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"avg_age_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"overdue_count" integer DEFAULT 0 NOT NULL,
	"recommended_rebalance" boolean DEFAULT false NOT NULL,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city" varchar,
	"country" varchar DEFAULT 'IL',
	"type" varchar NOT NULL,
	"scheduled_for" timestamp,
	"status" varchar DEFAULT 'pending',
	"assigned_contractor_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "assistant_action_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"assistant_context" varchar(64) NOT NULL,
	"suggested_action" varchar(64) NOT NULL,
	"target_entity_type" varchar(64),
	"target_entity_id" varchar(128),
	"requested_by_uid" varchar(128) NOT NULL,
	"status" varchar(24) DEFAULT 'suggested' NOT NULL,
	"result_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" varchar,
	"actor_role" varchar,
	"action_type" varchar NOT NULL,
	"target_type" varchar,
	"target_id" varchar,
	"ip" varchar,
	"user_agent" text,
	"trace_id" varchar,
	"metadata" jsonb,
	"severity" varchar DEFAULT 'info'
);

CREATE TABLE IF NOT EXISTS "auth_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"event_type" varchar(50) NOT NULL,
	"success" boolean NOT NULL,
	"reason" text,
	"ip" varchar(100),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"trace_id" varchar(100)
);

CREATE TABLE IF NOT EXISTS "platforms" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar,
	"description" text,
	"description_he" text,
	"is_active" boolean DEFAULT true,
	"platform_fee_percent" numeric(5, 2),
	"stripe_connect_enabled" boolean DEFAULT false,
	"nayax_enabled" boolean DEFAULT false,
	"booking_mode" varchar DEFAULT 'SINGLE_SLOT',
	"settings" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"platform_id" varchar NOT NULL,
	"business_name" varchar,
	"bio" text,
	"bio_he" text,
	"photo_url" varchar,
	"languages" text[],
	"verification_status" varchar DEFAULT 'pending',
	"verification_documents" jsonb,
	"background_check_status" varchar DEFAULT 'pending',
	"background_check_date" timestamp,
	"insurance_provider" varchar,
	"insurance_policy_number" varchar,
	"insurance_expiry_date" date,
	"insurance_document_url" varchar,
	"average_rating" numeric(3, 2) DEFAULT '0',
	"total_reviews" integer DEFAULT 0,
	"total_bookings" integer DEFAULT 0,
	"completion_rate" numeric(5, 2) DEFAULT '0',
	"is_available" boolean DEFAULT true,
	"accepting_new_clients" boolean DEFAULT true,
	"service_radius" integer,
	"stripe_connect_account_id" varchar,
	"stripe_onboarding_complete" boolean DEFAULT false,
	"payout_enabled" boolean DEFAULT false,
	"total_earnings" numeric(12, 2) DEFAULT '0',
	"pending_payouts" numeric(12, 2) DEFAULT '0',
	"platform_data" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"kyc_status" varchar(30),
	"kyc_verified_at" timestamp,
	"kyc_verification_method" varchar(30),
	"kyc_document_type" varchar(60),
	"kyc_document_country" varchar(10),
	"kyc_document_expiry" date,
	"kyc_face_match_result" varchar(20),
	"kyc_review_reason" text,
	"kyc_manual_reviewer_id" varchar(128),
	"kyc_deletion_completed_at" timestamp,
	"provider_code" varchar(32),
	"osek_number" varchar(20),
	"osek_type" varchar(12),
	"bituach_leumi_status" varchar(20),
	"bank_account" jsonb,
	"bank_ownership_confirmed" boolean DEFAULT false,
	CONSTRAINT "providers_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"provider_id" integer,
	"type" varchar NOT NULL,
	"name" varchar,
	"address_line1" varchar NOT NULL,
	"address_line2" varchar,
	"city" varchar NOT NULL,
	"state" varchar,
	"country" varchar DEFAULT 'IL',
	"postal_code" varchar,
	"latitude" real,
	"longitude" real,
	"google_place_id" varchar,
	"phone" varchar,
	"email" varchar,
	"instructions" text,
	"is_default" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "locations_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "franchise_owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_user_id" varchar NOT NULL,
	"business_name" varchar NOT NULL,
	"contract_start" timestamp,
	"contract_end" timestamp,
	"platform_fee_override_pct" numeric(5, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "franchise_owners_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_code" varchar NOT NULL,
	"location_id" integer NOT NULL,
	"franchise_id" integer,
	"name" varchar NOT NULL,
	"name_he" varchar,
	"description" text,
	"description_he" text,
	"photo_urls" text[],
	"status" varchar DEFAULT 'operational',
	"is_active" boolean DEFAULT true,
	"iot_device_id" varchar,
	"iot_status" jsonb,
	"last_heartbeat" timestamp,
	"price_per_wash" numeric(10, 2),
	"price_per_minute" numeric(10, 2),
	"features" text[],
	"operating_hours" jsonb,
	"total_washes" integer DEFAULT 0,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_usage_minutes" integer,
	"last_maintenance_date" date,
	"next_maintenance_date" date,
	"ownership_type" varchar(20) DEFAULT 'franchise' NOT NULL,
	"trust_score" integer,
	"ranking_score" integer,
	"ranking_updated_at" timestamp,
	"daily_capacity" integer DEFAULT 20,
	"current_day_bookings" integer DEFAULT 0,
	"equipment_status" varchar DEFAULT 'operational',
	"next_downtime_start" timestamp,
	"next_downtime_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stations_station_code_unique" UNIQUE("station_code"),
	CONSTRAINT "stations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "stations_franchise_id_franchise_owners_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchise_owners"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "bookings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_number" varchar NOT NULL,
	"platform_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"provider_id" varchar,
	"pickup_location_id" integer,
	"dropoff_location_id" integer,
	"station_id" integer,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"duration" integer,
	"timezone" varchar DEFAULT 'Asia/Jerusalem',
	"status" varchar DEFAULT 'draft' NOT NULL,
	"payment_status" varchar DEFAULT 'pending',
	"payment_intent_id" varchar,
	"payment_method" varchar,
	"payout_status" varchar DEFAULT 'pending',
	"payout_date" timestamp,
	"subtotal" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) DEFAULT '0',
	"provider_payout" numeric(12, 2) DEFAULT '0',
	"discount" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"service_type" varchar,
	"service_description" text,
	"special_requests" text,
	"platform_data" jsonb,
	"cancellation_reason" text,
	"cancelled_by" varchar,
	"cancelled_at" timestamp,
	"refund_amount" numeric(12, 2),
	"refund_processed_at" timestamp,
	"refund_requested_at" timestamp,
	"refund_reason" text,
	"refund_status" varchar,
	"refund_amount_cents" integer,
	"dispute_opened_at" timestamp,
	"dispute_resolved_at" timestamp,
	"customer_rating" numeric(4, 2),
	"customer_review_id" integer,
	"provider_review_id" integer,
	"confirmed_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"tax_amount" numeric(12, 2),
	"transaction_stamped_at" timestamp,
	"confirmation_email_sent_at_customer" timestamp,
	"confirmation_email_sent_at_provider" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bookings_booking_number_unique" UNIQUE("booking_number"),
	CONSTRAINT "bookings_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bookings_pickup_location_id_locations_id_fk" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bookings_dropoff_location_id_locations_id_fk" FOREIGN KEY ("dropoff_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bookings_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "availability_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"platform_id" varchar NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"timezone" varchar DEFAULT 'Asia/Jerusalem',
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule" varchar,
	"recurrence_end" timestamp,
	"status" varchar DEFAULT 'available',
	"booking_id" varchar,
	"buffer_before" integer DEFAULT 0,
	"buffer_after" integer DEFAULT 0,
	"notes" text,
	"locked_by_uid" varchar,
	"locked_at" timestamp,
	"lock_expires_at" timestamp,
	"lock_token" varchar,
	"mode_override" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "availability_slots_lock_token_unique" UNIQUE("lock_token"),
	CONSTRAINT "availability_slots_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "availability_slots_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "availability_slots_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_number" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"account_name_he" varchar,
	"bank_name" varchar DEFAULT 'Mizrahi-Tefahot Bank' NOT NULL,
	"bank_name_he" varchar DEFAULT 'בנק מזרחי טפחות',
	"branch_name" varchar DEFAULT 'Poleg' NOT NULL,
	"branch_code" varchar,
	"swift" varchar DEFAULT 'MIZBILIT',
	"iban" varchar,
	"currency" varchar DEFAULT 'ILS',
	"account_type" varchar DEFAULT 'business',
	"is_active" boolean DEFAULT true,
	"opened_at" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_accounts_account_number_unique" UNIQUE("account_number")
);

CREATE TABLE IF NOT EXISTS "bank_import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" varchar NOT NULL,
	"account_id" integer NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer,
	"period_start" date,
	"period_end" date,
	"total_transactions" integer DEFAULT 0,
	"successful_imports" integer DEFAULT 0,
	"failed_imports" integer DEFAULT 0,
	"duplicates_skipped" integer DEFAULT 0,
	"status" varchar DEFAULT 'processing',
	"error_log" text,
	"imported_by" varchar NOT NULL,
	"imported_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "bank_import_batches_batch_id_unique" UNIQUE("batch_id"),
	CONSTRAINT "bank_import_batches_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bank_import_batches_imported_by_admin_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "bank_reconciliation_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"opening_balance" numeric(12, 2) NOT NULL,
	"closing_balance" numeric(12, 2) NOT NULL,
	"total_debits" numeric(12, 2) DEFAULT '0',
	"total_credits" numeric(12, 2) DEFAULT '0',
	"total_transactions" integer DEFAULT 0,
	"matched_transactions" integer DEFAULT 0,
	"unmatched_transactions" integer DEFAULT 0,
	"match_rate" numeric(5, 2) DEFAULT '0',
	"total_discrepancies" numeric(12, 2) DEFAULT '0',
	"unreconciled_amount" numeric(12, 2) DEFAULT '0',
	"status" varchar DEFAULT 'in_progress',
	"completed_by" varchar,
	"completed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_reconciliation_summary_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bank_reconciliation_summary_completed_by_admin_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "bank_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"transaction_date" date NOT NULL,
	"value_date" date,
	"description" text NOT NULL,
	"description_he" text,
	"reference_number" varchar,
	"debit_amount" numeric(12, 2) DEFAULT '0',
	"credit_amount" numeric(12, 2) DEFAULT '0',
	"balance" numeric(12, 2),
	"currency" varchar DEFAULT 'ILS',
	"category" varchar,
	"subcategory" varchar,
	"reconciliation_status" varchar DEFAULT 'unmatched',
	"matched_transaction_id" integer,
	"matched_entity_type" varchar,
	"match_confidence" integer,
	"import_batch_id" varchar,
	"imported_at" timestamp DEFAULT now(),
	"imported_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bank_transactions_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bank_transactions_imported_by_admin_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "bank_reconciliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"reconciliation_id" varchar NOT NULL,
	"bank_transaction_id" integer NOT NULL,
	"matched_entity_id" integer NOT NULL,
	"matched_entity_type" varchar NOT NULL,
	"match_type" varchar NOT NULL,
	"match_confidence" integer NOT NULL,
	"bank_amount" numeric(12, 2) NOT NULL,
	"entity_amount" numeric(12, 2) NOT NULL,
	"discrepancy" numeric(12, 2) DEFAULT '0',
	"discrepancy_reason" text,
	"status" varchar DEFAULT 'pending',
	"matched_by" varchar NOT NULL,
	"matched_at" timestamp DEFAULT now(),
	"approved_by" varchar,
	"approved_at" timestamp,
	"notes" text,
	CONSTRAINT "bank_reconciliations_reconciliation_id_unique" UNIQUE("reconciliation_id"),
	CONSTRAINT "bank_reconciliations_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bank_reconciliations_matched_by_admin_users_id_fk" FOREIGN KEY ("matched_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "bank_reconciliations_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "bay_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" varchar NOT NULL,
	"station_id" varchar NOT NULL,
	"side" varchar(5) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"session_id" varchar,
	"fault_id" varchar,
	"reader_id" varchar,
	"user_id" varchar,
	"source" varchar(30) DEFAULT 'petwash_server' NOT NULL,
	"metadata" text,
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bay_faults" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" varchar NOT NULL,
	"station_id" varchar NOT NULL,
	"side" varchar(5) NOT NULL,
	"fault_code" varchar(50) NOT NULL,
	"severity" varchar(10) DEFAULT 'error' NOT NULL,
	"description" text,
	"description_he" text,
	"reader_id" varchar,
	"reader_type" varchar(20),
	"session_id" varchar,
	"raw_payload" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"resolution_note" text,
	"reported_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bay_readers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" varchar NOT NULL,
	"station_id" varchar NOT NULL,
	"side" varchar(5) NOT NULL,
	"reader_type" varchar(20) NOT NULL,
	"nayax_device_id" varchar,
	"nayax_terminal_id" varchar,
	"status" varchar(20) DEFAULT 'online' NOT NULL,
	"last_heartbeat" timestamp,
	"last_fault_code" varchar,
	"last_fault_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "bay_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" varchar NOT NULL,
	"station_id" varchar NOT NULL,
	"side" varchar(5) NOT NULL,
	"user_id" varchar,
	"is_anonymous" boolean DEFAULT false,
	"source" varchar(30) NOT NULL,
	"amount_cents" integer DEFAULT 0,
	"currency" varchar(3) DEFAULT 'ILS',
	"nayax_transaction_id" varchar,
	"nayax_terminal_id" varchar,
	"wash_program" varchar(30),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"activated_at" timestamp,
	"ended_at" timestamp,
	"expected_duration_seconds" integer,
	"actual_duration_seconds" integer,
	"complimentary_cleanup_seconds" integer DEFAULT 30,
	"cleanup_started_at" timestamp,
	"cleanup_ends_at" timestamp,
	"wash_event_id" varchar,
	"correlation_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "booking_actions_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"platform" varchar DEFAULT 'walk_my_pet' NOT NULL,
	"actor_uid" varchar NOT NULL,
	"actor_role" varchar NOT NULL,
	"action" varchar NOT NULL,
	"reason_code" varchar,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_conversations" (
	"conversation_id" varchar PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"chat_status" varchar DEFAULT 'active' NOT NULL,
	"closed_reason" varchar,
	"customer_unread" integer DEFAULT 0 NOT NULL,
	"provider_unread" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp,
	"last_message_preview" varchar(120),
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"closed_at" timestamp,
	CONSTRAINT "booking_conversations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_disputes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"booking_type" varchar DEFAULT 'marketplace' NOT NULL,
	"customer_id" varchar NOT NULL,
	"reason" varchar(100) NOT NULL,
	"description" text,
	"status" varchar DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "booking_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" varchar(24) NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"provider_id" varchar(128) NOT NULL,
	"provider_profile_id" integer,
	"provider_type" varchar(32) NOT NULL,
	"service_type" varchar(32) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"pet_ids" text[],
	"pet_count" integer DEFAULT 1 NOT NULL,
	"pet_details" jsonb,
	"daily_rate_cents" integer,
	"hourly_rate_cents" integer,
	"total_days" integer,
	"total_hours" numeric,
	"subtotal_cents" integer NOT NULL,
	"service_fee_percent" numeric DEFAULT '15',
	"service_fee_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"status" "booking_request_status" DEFAULT 'pending' NOT NULL,
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"meet_greet_date" timestamp,
	"meet_greet_location" text,
	"meet_greet_notes" text,
	"meet_greet_completed_at" timestamp,
	"owner_message" text,
	"provider_response" text,
	"special_requirements" text,
	"payment_method" varchar(32),
	"payment_transaction_id" varchar(64),
	"payment_held_at" timestamp,
	"payment_released_at" timestamp,
	"service_started_at" timestamp,
	"service_completed_at" timestamp,
	"photo_updates" jsonb DEFAULT '[]'::jsonb,
	"owner_confirmed_at" timestamp,
	"owner_rating" numeric,
	"owner_review" text,
	"provider_rating" numeric,
	"provider_review" text,
	"cancelled_at" timestamp,
	"cancelled_by" varchar(16),
	"cancellation_reason" text,
	"refund_cents" integer,
	"refund_processed_at" timestamp,
	"quote_subtotal_cents" integer DEFAULT 0 NOT NULL,
	"quote_discount_cents" integer DEFAULT 0 NOT NULL,
	"quote_credit_cents" integer DEFAULT 0 NOT NULL,
	"quote_gift_card_cents" integer DEFAULT 0 NOT NULL,
	"quote_tax_cents" integer DEFAULT 0 NOT NULL,
	"quote_total_cents" integer DEFAULT 0 NOT NULL,
	"quote_currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"quote_breakdown" jsonb,
	"pricing_version" varchar(40),
	"promo_code" varchar(80),
	"coupon_id" varchar(255),
	"gift_card_id" varchar(255),
	"wallet_credit_used_cents" integer DEFAULT 0 NOT NULL,
	"loyalty_redeemed_cents" integer DEFAULT 0 NOT NULL,
	"wallet_hold_cents" integer DEFAULT 0 NOT NULL,
	"wallet_debited_cents" integer DEFAULT 0 NOT NULL,
	"wallet_refunded_cents" integer DEFAULT 0 NOT NULL,
	"wallet_hold_key" text,
	"wallet_debit_key" text,
	"wallet_release_key" text,
	"wallet_refund_key" text,
	"finance_state" varchar(30) DEFAULT 'none' NOT NULL,
	"provider_payout_cents" integer,
	"payout_status" varchar(32) DEFAULT 'pending',
	"payout_date" timestamp,
	"provider_completed_at" timestamp,
	"provider_invoice_number" varchar(64),
	"provider_invoice_submitted_at" timestamp,
	"customer_approved_at" timestamp,
	"auto_approved_at" timestamp,
	"cancellation_tier" varchar(32),
	"cancellation_penalty_cents" integer DEFAULT 0,
	"emergency_cancel_reason" text,
	"platform_calendar_event_id" varchar(256),
	"calendar_attendees_synced" boolean DEFAULT false,
	"dispute_opened_at" timestamp,
	"dispute_opened_by" varchar(16),
	"dispute_reason" text,
	"customer_address" text,
	"customer_street" varchar(200),
	"customer_street_number" varchar(40),
	"customer_apartment" varchar(80),
	"customer_floor" varchar(30),
	"customer_entrance" varchar(30),
	"customer_address_notes" text,
	"customer_city" varchar(120),
	"customer_city_key" varchar(60),
	"customer_country" varchar(2),
	"customer_postal_code" varchar(16),
	"customer_latitude" numeric(10, 7),
	"customer_longitude" numeric(10, 7),
	"customer_place_id" varchar(200),
	"stuck_hold_alert_sent_at" timestamp,
	"booking_fingerprint" varchar(200),
	"search_id" varchar(24),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_requests_request_id_unique" UNIQUE("request_id")
);

CREATE TABLE IF NOT EXISTS "booking_handover_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_request_id" integer NOT NULL,
	"request_id" varchar(24) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"confirmed_by_role" varchar(16) NOT NULL,
	"confirmed_by_uid" varchar(128) NOT NULL,
	"notes" text,
	"photo_url" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_handover_events_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"item_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar,
	"description" text,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(12, 2) NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_messages" (
	"message_id" varchar PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_uid" varchar NOT NULL,
	"sender_role" varchar NOT NULL,
	"message_type" varchar DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"system_event_type" varchar,
	"is_flagged" boolean DEFAULT false,
	"flagged_reason" varchar,
	"moderated_by" varchar,
	"is_deleted" boolean DEFAULT false,
	"deleted_by" varchar,
	"reply_to_message_id" varchar,
	"read_by_customer_at" timestamp,
	"read_by_provider_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "booking_messages_conversation_id_booking_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."booking_conversations"("conversation_id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "pets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"species" varchar NOT NULL,
	"breed" varchar,
	"age" integer,
	"date_of_birth" date,
	"weight" numeric(6, 2),
	"gender" varchar,
	"size" varchar,
	"color" varchar,
	"microchip_id" varchar,
	"country_of_birth" varchar,
	"photo_url" varchar,
	"skin_sensitivity" text,
	"allergies" text,
	"medications" text,
	"special_needs" text,
	"vet_name" varchar,
	"vet_phone" varchar,
	"vaccination_status" varchar DEFAULT 'unknown',
	"last_vaccination_date" date,
	"next_vaccination_date" date,
	"medical_data_private" boolean DEFAULT true NOT NULL,
	"medical_share_consent" boolean DEFAULT false NOT NULL,
	"medical_consent_updated_at" timestamp,
	"temperament" "pet_temperament",
	"good_with_kids" boolean,
	"good_with_dogs" boolean,
	"good_with_cats" boolean,
	"notes" text,
	"last_wash_date" timestamp,
	"last_walk_date" timestamp,
	"last_groom_date" timestamp,
	"temperament_archived" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "booking_pets" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"pet_id" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_pets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "booking_pets_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"provider_id" integer,
	"photo_url" text NOT NULL,
	"photo_type" varchar DEFAULT 'during',
	"gps_latitude" numeric(10, 7),
	"gps_longitude" numeric(10, 7),
	"captured_at" timestamp,
	"uploaded_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "booking_photos_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "booking_photos_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_request_pets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_request_id" integer NOT NULL,
	"pet_id" integer,
	"pet_name" varchar(120) NOT NULL,
	"pet_type" varchar(40) NOT NULL,
	"breed" varchar(120),
	"size_category" varchar(40),
	"age_years" numeric(4, 1),
	"weight_kg" numeric(6, 2),
	"gender" varchar(20),
	"special_notes" text,
	"requires_medication" boolean DEFAULT false NOT NULL,
	"has_behavior_flag" boolean DEFAULT false NOT NULL,
	"has_special_needs" boolean DEFAULT false NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"base_price_cents" integer DEFAULT 0 NOT NULL,
	"adjustment_price_cents" integer DEFAULT 0 NOT NULL,
	"subtotal_price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"pricing_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_request_pets_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "booking_request_pets_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_request_addons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_request_id" integer NOT NULL,
	"booking_request_pet_id" varchar,
	"addon_code" varchar(80) NOT NULL,
	"addon_name" varchar(120) NOT NULL,
	"addon_scope" varchar(20) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"subtotal_price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"pricing_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_request_addons_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "booking_request_addons_booking_request_pet_id_booking_request_pets_id_fk" FOREIGN KEY ("booking_request_pet_id") REFERENCES "public"."booking_request_pets"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "booking_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"from_status" varchar,
	"to_status" varchar NOT NULL,
	"changed_by_user_id" varchar NOT NULL,
	"changed_by_role" varchar NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"changed_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pet_awareness_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar NOT NULL,
	"event_date" date NOT NULL,
	"recurrence_type" varchar DEFAULT 'annual',
	"title_locales" jsonb NOT NULL,
	"description_locales" jsonb,
	"pet_types" text[],
	"category" varchar NOT NULL,
	"is_global" boolean DEFAULT true,
	"target_countries" text[],
	"default_campaign_type" varchar,
	"suggested_discount_percent" integer,
	"hero_image_url" varchar,
	"icon_emoji" varchar,
	"theme_color" varchar,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pet_awareness_days_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "promotional_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"awareness_day_id" integer,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"target_segments" jsonb,
	"target_locales" text[],
	"target_countries" text[],
	"discount_type" varchar NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"discount_currency" varchar DEFAULT 'ILS',
	"max_redemptions" integer,
	"current_redemptions" integer DEFAULT 0,
	"min_purchase_amount" numeric(10, 2),
	"max_discount_amount" numeric(10, 2),
	"promo_code" varchar,
	"is_auto_apply" boolean DEFAULT false,
	"content_locales" jsonb NOT NULL,
	"hero_assets" jsonb,
	"social_boost_enabled" boolean DEFAULT false,
	"social_boost_budget" numeric(10, 2),
	"scheduled_post_ids" jsonb,
	"requires_manual_review" boolean DEFAULT true,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_by" varchar NOT NULL,
	"approved_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "promotional_campaigns_slug_unique" UNIQUE("slug"),
	CONSTRAINT "promotional_campaigns_awareness_day_id_pet_awareness_days_id_fk" FOREIGN KEY ("awareness_day_id") REFERENCES "public"."pet_awareness_days"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "campaign_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_email" varchar,
	"booking_id" integer,
	"order_id" varchar,
	"discount_applied" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"promo_code_used" varchar,
	"source_channel" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"redeemed_at" timestamp DEFAULT now(),
	CONSTRAINT "campaign_redemptions_campaign_id_promotional_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."promotional_campaigns"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "career_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_id" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"title_he" varchar(255),
	"department" varchar(100) NOT NULL,
	"role_type" varchar(50) NOT NULL,
	"short_description" text NOT NULL,
	"short_description_he" text,
	"full_description" text NOT NULL,
	"full_description_he" text,
	"requirements" jsonb DEFAULT '[]'::jsonb,
	"requirements_he" jsonb DEFAULT '[]'::jsonb,
	"qualifications" jsonb DEFAULT '[]'::jsonb,
	"benefits" jsonb DEFAULT '[]'::jsonb,
	"location" varchar(255) NOT NULL,
	"location_type" varchar(50) DEFAULT 'hybrid',
	"employment_type" varchar(50) NOT NULL,
	"salary_range_min" numeric(10, 2),
	"salary_range_max" numeric(10, 2),
	"salary_currency" varchar(10) DEFAULT 'ILS',
	"salary_period" varchar(20) DEFAULT 'hourly',
	"commission_structure" text,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"urgency_level" varchar(20) DEFAULT 'normal',
	"open_positions" integer DEFAULT 1,
	"requires_resume" boolean DEFAULT true,
	"requires_cover_letter" boolean DEFAULT false,
	"requires_background_check" boolean DEFAULT true,
	"requires_driving_license" boolean DEFAULT false,
	"minimum_age" integer DEFAULT 18,
	"slug" varchar(255),
	"meta_title" varchar(255),
	"meta_description" varchar(500),
	"view_count" integer DEFAULT 0,
	"application_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "career_positions_position_id_unique" UNIQUE("position_id"),
	CONSTRAINT "career_positions_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "cash_forecast_accuracy" (
	"id" serial PRIMARY KEY NOT NULL,
	"forecast_generated_at" timestamp with time zone NOT NULL,
	"horizon_days" integer NOT NULL,
	"target_date" varchar(12) NOT NULL,
	"forecast_payouts_cents" integer DEFAULT 0 NOT NULL,
	"actual_payouts_cents" integer DEFAULT 0 NOT NULL,
	"forecast_refunds_cents" integer DEFAULT 0 NOT NULL,
	"actual_refunds_cents" integer DEFAULT 0 NOT NULL,
	"forecast_vat_cents" integer DEFAULT 0 NOT NULL,
	"actual_vat_cents" integer DEFAULT 0 NOT NULL,
	"forecast_net_cash_need_cents" integer DEFAULT 0 NOT NULL,
	"actual_net_cash_need_cents" integer DEFAULT 0 NOT NULL,
	"abs_error_cents" integer DEFAULT 0 NOT NULL,
	"pct_error" numeric(8, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cash_forecast_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"horizon_days" integer NOT NULL,
	"forecast_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" varchar(64) DEFAULT 'system' NOT NULL
);

CREATE TABLE IF NOT EXISTS "cash_forecast_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"horizon_days" integer NOT NULL,
	"factor_name" varchar(64) NOT NULL,
	"weight" numeric(8, 4) DEFAULT '1' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by_uid" varchar(128),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compliance_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"assignment_id" varchar,
	"decision_id" varchar,
	"action" varchar NOT NULL,
	"actor_type" varchar NOT NULL,
	"actor_id" varchar,
	"from_status" varchar,
	"to_status" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "compliance_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"assignment_id" varchar,
	"decision" varchar NOT NULL,
	"score" real NOT NULL,
	"reasons" jsonb NOT NULL,
	"triggered_rules" jsonb NOT NULL,
	"decided_by" varchar DEFAULT 'system',
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "compliance_verification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"verification_type" varchar NOT NULL,
	"check_status" varchar NOT NULL,
	"findings" jsonb,
	"action_required" text,
	"performed_by_user_id" varchar,
	"performed_by_system" boolean DEFAULT true,
	"action_taken" text,
	"notification_sent" boolean DEFAULT false,
	"provider_notified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "consent_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"version" varchar(50) NOT NULL,
	"locale" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_moderation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" varchar NOT NULL,
	"content_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"original_text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"blacklist_violation" boolean DEFAULT false,
	"matched_blacklist_terms" text[],
	"ai_analysis_performed" boolean DEFAULT false,
	"ai_model" varchar,
	"ai_prompt" text,
	"ai_response" text,
	"ai_decision" varchar,
	"ai_confidence_score" numeric(5, 2),
	"final_decision" varchar NOT NULL,
	"rejection_reason" text,
	"new_abusive_terms_detected" text[],
	"user_suspended" boolean DEFAULT false,
	"suspension_duration_hours" integer,
	"processing_time_ms" integer,
	"ip_address" varchar,
	"user_agent" varchar,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contractor_background_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"provider_name" varchar,
	"report_id" varchar,
	"completed_at" timestamp,
	"result" varchar DEFAULT 'PENDING',
	"findings" jsonb,
	"document_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_background_checks_contractor_id_unique" UNIQUE("contractor_id")
);

CREATE TABLE IF NOT EXISTS "contractor_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"badge_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"contractor_type" varchar NOT NULL,
	"badge_type" varchar NOT NULL,
	"badge_name" varchar NOT NULL,
	"badge_description" text,
	"badge_icon_url" varchar,
	"issued_by" varchar,
	"issued_reason" text,
	"certification_provider" varchar,
	"certification_url" varchar,
	"expires_at" timestamp,
	"is_visible" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"revoked_at" timestamp,
	"revoked_reason" text,
	CONSTRAINT "contractor_badges_badge_id_unique" UNIQUE("badge_id")
);

CREATE TABLE IF NOT EXISTS "contractor_bank_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"bank_name" varchar,
	"bank_code" varchar,
	"branch_code" varchar,
	"account_number" varchar,
	"account_holder_name" varchar,
	"is_verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"verified_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_bank_details_contractor_id_unique" UNIQUE("contractor_id")
);

CREATE TABLE IF NOT EXISTS "contractor_capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"platform_approved" boolean DEFAULT false,
	"notes_internal" text,
	"approved_by_user_id" varchar,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contractor_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"country" varchar DEFAULT 'IL',
	"url" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"verified_at" timestamp,
	"expires_at" timestamp,
	"verified_by_user_id" varchar,
	"notes_internal" text
);

CREATE TABLE IF NOT EXISTS "contractor_earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"earning_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"contractor_type" varchar NOT NULL,
	"booking_type" varchar NOT NULL,
	"booking_id" varchar NOT NULL,
	"day_count" integer,
	"hour_count" numeric(5, 2),
	"walk_duration_minutes" integer,
	"walk_distance_km" numeric(10, 3),
	"trip_distance_km" numeric(10, 3),
	"toll_charges" numeric(10, 2),
	"base_amount" numeric(12, 2) NOT NULL,
	"bonus_amount" numeric(12, 2) DEFAULT 0,
	"platform_fee" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT 0,
	"net_earnings" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"payout_status" varchar DEFAULT 'pending',
	"escrow_release_date" timestamp,
	"paid_out_at" timestamp,
	"payout_method" varchar,
	"payout_transaction_id" varchar,
	"tax_year" integer,
	"tax_quarter" integer,
	"include_in_tax_report" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_earnings_earning_id_unique" UNIQUE("earning_id")
);

CREATE TABLE IF NOT EXISTS "contractor_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"description" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"auto_blocked" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contractor_insurance" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"provider_name" varchar,
	"policy_number" varchar,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"covers_third_party" boolean DEFAULT false,
	"covers_professional_liability" boolean DEFAULT false,
	"covers_animals_under_care" boolean DEFAULT false,
	"last_verified_at" timestamp,
	"document_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_insurance_contractor_id_unique" UNIQUE("contractor_id")
);

CREATE TABLE IF NOT EXISTS "contractor_profiles" (
	"id" varchar PRIMARY KEY NOT NULL,
	"display_name" varchar NOT NULL,
	"legal_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone_e164" varchar NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false,
	"country_of_operation" varchar DEFAULT 'IL',
	"primary_city" varchar,
	"language_codes" jsonb DEFAULT '["he","en"]'::jsonb,
	"accepted_platform_terms_at" timestamp,
	"accepted_independent_status_at" timestamp,
	"accepted_privacy_policy_at" timestamp,
	"compliance_status" varchar DEFAULT 'PENDING',
	"risk_level" varchar DEFAULT 'LOW',
	"last_compliance_check_at" timestamp,
	"last_compliance_summary" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"archived_at" timestamp
);

CREATE TABLE IF NOT EXISTS "contractor_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"rater_type" varchar NOT NULL,
	"score" integer NOT NULL,
	"comment" text,
	"job_id" varchar,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contractor_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" varchar NOT NULL,
	"booking_type" varchar NOT NULL,
	"booking_id" varchar NOT NULL,
	"review_type" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"reviewer_name" varchar NOT NULL,
	"reviewer_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"subject_name" varchar NOT NULL,
	"subject_type" varchar NOT NULL,
	"overall_rating" integer NOT NULL,
	"punctuality_rating" integer,
	"communication_rating" integer,
	"professionalism_rating" integer,
	"cleanliness_rating" integer,
	"safety_rating" integer,
	"review_text" text,
	"review_photos" text[],
	"highlights" text[],
	"has_response" boolean DEFAULT false,
	"response_text" text,
	"responded_at" timestamp,
	"responded_by" varchar,
	"is_flagged" boolean DEFAULT false,
	"flagged_keywords" text[],
	"flagged_reason" varchar,
	"flagged_at" timestamp,
	"moderated_by" varchar,
	"moderation_notes" text,
	"moderation_status" varchar DEFAULT 'pending',
	"is_verified_booking" boolean DEFAULT true,
	"verification_method" varchar,
	"is_visible" boolean DEFAULT true,
	"is_public" boolean DEFAULT true,
	"trust_score_impact" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_reviews_review_id_unique" UNIQUE("review_id")
);

CREATE TABLE IF NOT EXISTS "contractor_service_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"country" varchar DEFAULT 'IL',
	"city" varchar,
	"city_symbol" varchar(20),
	"region_name" varchar,
	"radius_km" numeric(6, 2),
	"center_lat" numeric(10, 7),
	"center_lng" numeric(10, 7),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contractor_trust_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"contractor_id" varchar NOT NULL,
	"contractor_type" varchar NOT NULL,
	"public_trust_score" numeric(3, 2) DEFAULT '4.50',
	"internal_risk_score" integer DEFAULT 50,
	"vetting_score" numeric(3, 2),
	"review_score" numeric(3, 2),
	"compliance_score" numeric(3, 2),
	"experience_score" numeric(3, 2),
	"total_reviews" integer DEFAULT 0,
	"total_bookings" integer DEFAULT 0,
	"total_violations" integer DEFAULT 0,
	"total_complaints" integer DEFAULT 0,
	"is_active_contractor" boolean DEFAULT true,
	"is_recommended" boolean DEFAULT false,
	"is_premium_badge" boolean DEFAULT false,
	"last_calculated_at" timestamp DEFAULT now(),
	"calculation_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_trust_scores_contractor_id_unique" UNIQUE("contractor_id")
);

CREATE TABLE IF NOT EXISTS "contractor_violations" (
	"id" serial PRIMARY KEY NOT NULL,
	"violation_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"contractor_type" varchar NOT NULL,
	"violation_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"booking_type" varchar,
	"booking_id" varchar,
	"incident_description" text NOT NULL,
	"evidence_urls" text[],
	"reported_by" varchar,
	"reporter_type" varchar,
	"status" varchar DEFAULT 'under_review',
	"resolution_notes" text,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"trust_score_impact" numeric(5, 2),
	"warning_issued" boolean DEFAULT false,
	"suspension_days" integer DEFAULT 0,
	"permanent_deactivation" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contractor_violations_violation_id_unique" UNIQUE("violation_id")
);

CREATE TABLE IF NOT EXISTS "contractors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"country" varchar(50),
	"role_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"risk_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "control_panel_platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"label" varchar NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "control_panel_platforms_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "coupon_delivery_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"channel" varchar(20) NOT NULL,
	"message_id" varchar(120),
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"redeemed_at" timestamp,
	"sent_at" timestamp DEFAULT now(),
	CONSTRAINT "coupon_delivery_events_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "coupon_delivery_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "coupon_eligibility_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"rule_type" varchar(40) NOT NULL,
	"rule_value" varchar(120),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coupon_eligibility_rules_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"order_type" varchar(40) NOT NULL,
	"order_id" varchar(120),
	"amount_before_cents" integer NOT NULL,
	"discount_amount_cents" integer NOT NULL,
	"amount_after_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS',
	"redeemed_at" timestamp DEFAULT now(),
	CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "cpi_index_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar NOT NULL,
	"index_value" numeric(10, 2) NOT NULL,
	"year_over_year_change" numeric(5, 2),
	"source" varchar DEFAULT 'Bank of Israel',
	"published_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar(50) NOT NULL,
	"wallet_id" varchar NOT NULL,
	"credit_type" varchar NOT NULL,
	"transaction_type" varchar NOT NULL,
	"amount_cents" integer,
	"amount_units" integer,
	"balance_after_cents" integer,
	"balance_after_units" integer,
	"source_type" varchar,
	"source_id" varchar,
	"redemption_session_id" varchar,
	"platform" varchar,
	"service_type" varchar,
	"booking_id" varchar,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"initiated_by" varchar,
	"initiated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	CONSTRAINT "credit_transactions_transaction_id_unique" UNIQUE("transaction_id")
);

CREATE TABLE IF NOT EXISTS "criminal_background_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"country" varchar NOT NULL,
	"status" varchar NOT NULL,
	"details_masked" text,
	"blocking_offenses" jsonb,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);

CREATE TABLE IF NOT EXISTS "crm_meeting_attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"attendee_type" varchar NOT NULL,
	"admin_user_id" varchar,
	"customer_id" integer,
	"external_name" varchar,
	"external_email" varchar,
	"external_phone" varchar,
	"response_status" varchar DEFAULT 'pending',
	"responded_at" timestamp,
	"invitation_sent" boolean DEFAULT false,
	"invitation_sent_at" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"role" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "crm_meeting_attendees_meeting_id_crm_tasks_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."crm_tasks"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crm_meeting_attendees_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "crm_meeting_attendees_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "devices" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"os_version" varchar,
	"app_version" varchar,
	"push_token" varchar,
	"is_blocked" boolean DEFAULT false,
	"last_seen_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "digital_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_number" varchar(50) NOT NULL,
	"receipt_type" varchar(30) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"booking_id" varchar,
	"nayax_transaction_id" varchar,
	"customer_email" varchar NOT NULL,
	"customer_name" varchar,
	"customer_phone" varchar,
	"provider_name" varchar,
	"provider_id" varchar,
	"provider_type" varchar,
	"service_description" text NOT NULL,
	"service_description_he" text NOT NULL,
	"subtotal_amount" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"platform_fee_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'ILS' NOT NULL,
	"provider_payout_amount" numeric(12, 2),
	"broker_commission_amount" numeric(12, 2),
	"withholding_tax_amount" numeric(12, 2),
	"withholding_tax_rate" numeric(5, 2),
	"net_payment_to_provider" numeric(12, 2),
	"payment_method" varchar(50) NOT NULL,
	"payment_status" varchar(30) DEFAULT 'completed' NOT NULL,
	"company_name" varchar DEFAULT 'Pet Wash Ltd' NOT NULL,
	"company_tax_id" varchar DEFAULT '517145033' NOT NULL,
	"company_address" varchar DEFAULT 'Israel' NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp,
	"email_error" text,
	"accounting_recorded" boolean DEFAULT false NOT NULL,
	"accounting_entry_id" varchar,
	"sheets_backup_id" varchar,
	"audit_hash" varchar(128) NOT NULL,
	"is_voided" boolean DEFAULT false NOT NULL,
	"voided_at" timestamp,
	"void_reason" text,
	"original_receipt_id" integer,
	"shaam_required" boolean DEFAULT false NOT NULL,
	"shaam_allocation_number" varchar,
	"sumit_document_id" varchar,
	"sumit_document_url" varchar,
	"issuer_of_record" varchar(20),
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "digital_receipts_receipt_number_unique" UNIQUE("receipt_number")
);

CREATE TABLE IF NOT EXISTS "digital_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"signer_name" varchar NOT NULL,
	"signer_title" varchar NOT NULL,
	"signer_email" varchar NOT NULL,
	"signature_image_url" varchar NOT NULL,
	"signature_thumbnail_url" varchar,
	"signature_hash" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"company_name" varchar DEFAULT 'PetWash Ltd',
	"company_registration_number" varchar,
	"created_by" varchar NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "dispute_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_ref" varchar(40) NOT NULL,
	"booking_id" varchar(120),
	"complainant_uid" varchar(128) NOT NULL,
	"complainant_type" varchar(20) DEFAULT 'customer' NOT NULL,
	"division_code" varchar(40),
	"amount_disputed_cents" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolution_cents" integer,
	"resolution_type" varchar(30),
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"assigned_admin_uid" varchar(128),
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispute_cases_case_ref_unique" UNIQUE("case_ref")
);

CREATE TABLE IF NOT EXISTS "dispute_routing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_code" varchar(40),
	"min_amount_cents" integer DEFAULT 0 NOT NULL,
	"max_amount_cents" integer,
	"assign_to_uid" varchar(128),
	"queue_name" varchar(64),
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "domain_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"aggregate_type" varchar,
	"aggregate_id" varchar,
	"payload" jsonb NOT NULL,
	"metadata" jsonb,
	"version" integer DEFAULT 1,
	"occurred_at" timestamp DEFAULT now(),
	"published_at" timestamp,
	"is_published" boolean DEFAULT false,
	CONSTRAINT "domain_events_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE IF NOT EXISTS "driver_safety_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"license_number" varchar,
	"license_class" varchar,
	"license_expiry_date" date,
	"license_country" varchar DEFAULT 'IL',
	"has_active_ban" boolean DEFAULT false,
	"ban_expiry_date" date,
	"points_on_license" integer DEFAULT 0,
	"last_incident_date" timestamp,
	"safety_score" real DEFAULT 1,
	"risk_level" varchar DEFAULT 'medium',
	"declares_clean_record" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "driver_safety_profiles_contractor_id_unique" UNIQUE("contractor_id")
);

CREATE TABLE IF NOT EXISTS "drivers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar,
	"vehicle_type" varchar(100),
	"license_number" varchar(100),
	"license_expiry" varchar(50),
	"areas_of_service" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "drivers_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "e2e_proof_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_type" varchar(32) DEFAULT 'full' NOT NULL,
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"steps_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failures_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "egift_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(64) NOT NULL,
	"egift_id" varchar(64) NOT NULL,
	"event_type" "egift_event_type" NOT NULL,
	"user_id" varchar(255),
	"wallet_id" varchar(64),
	"amount_cents" integer,
	"currency" varchar(8) DEFAULT 'ILS',
	"platform" varchar(50),
	"product" varchar(50),
	"station_id" varchar(100),
	"bay_side" varchar(20),
	"booking_id" varchar(64),
	"kiosk_txn_id" varchar(64),
	"ledger_entry_id" varchar(64),
	"invoice_id" varchar(64),
	"idempotency_key" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"sha256_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "egift_events_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE IF NOT EXISTS "egift_redeem_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"egift_id" varchar(64) NOT NULL,
	"station_id" varchar(100),
	"user_id" varchar(255),
	"success" boolean DEFAULT false,
	"failure_reason" varchar(255),
	"ip_address" varchar(45),
	"attempted_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "employee_hierarchy" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar NOT NULL,
	"supervisor_id" varchar,
	"department" varchar,
	"position" varchar NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"can_approve_budget" numeric(12, 2) DEFAULT '0',
	"auto_approve" boolean DEFAULT false,
	"whatsapp_phone" varchar,
	"preferred_language" varchar DEFAULT 'he',
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "employee_hierarchy_employee_id_unique" UNIQUE("employee_id"),
	CONSTRAINT "employee_hierarchy_employee_id_admin_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "employee_hierarchy_supervisor_id_admin_users_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "escalation_policy_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" integer,
	"previous_threshold_hours" integer,
	"suggested_threshold_hours" integer,
	"reason" text,
	"impact_estimate" numeric(8, 2),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "escrow_holdings" (
	"id" serial PRIMARY KEY NOT NULL,
	"escrow_id" varchar NOT NULL,
	"booking_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"platform_fee_cents" integer NOT NULL,
	"vat_cents" integer NOT NULL,
	"net_provider_amount_cents" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"captured_at" timestamp,
	"service_completed_at" timestamp,
	"release_eligible_at" timestamp,
	"released_at" timestamp,
	"refund_requested_at" timestamp,
	"refund_processed_at" timestamp,
	"refund_amount_cents" integer,
	"refund_reason" text,
	"dispute_opened_at" timestamp,
	"dispute_resolved_at" timestamp,
	"dispute_resolution" varchar,
	"payment_intent_id" varchar,
	"payout_transfer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "escrow_holdings_escrow_id_unique" UNIQUE("escrow_id")
);

CREATE TABLE IF NOT EXISTS "exception_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"exception_type" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"exception_detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suggested_action" text NOT NULL,
	"suggestion_detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"auto_applicable" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"applied_by_uid" varchar(128),
	"applied_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "execution_review_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" varchar(32) NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "executive_digest_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_start" varchar(12) NOT NULL,
	"period_end" varchar(12) NOT NULL,
	"sent_to" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"error_detail" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "executive_kpi_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" varchar(12) NOT NULL,
	"snapshot_type" varchar(20) DEFAULT 'daily' NOT NULL,
	"kpi_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar NOT NULL,
	"employee_name" varchar NOT NULL,
	"employee_email" varchar NOT NULL,
	"business_id" varchar DEFAULT 'petwash-ltd' NOT NULL,
	"department_id" varchar,
	"expense_date" date NOT NULL,
	"report_period" varchar NOT NULL,
	"total_amount_ils" numeric(10, 2) NOT NULL,
	"net_amount_ils" numeric(10, 2) NOT NULL,
	"vat_amount_ils" numeric(10, 2) NOT NULL,
	"vat_rate_applied" numeric(5, 4) NOT NULL,
	"vat_exemption_reason" varchar,
	"municipal_tax_rate" numeric(5, 4),
	"municipal_tax_amount" numeric(10, 2),
	"is_tax_deductible" boolean DEFAULT true,
	"deductibility_reason" text,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"description" text NOT NULL,
	"receipt_image_urls" text[],
	"receipt_ocr_text" text,
	"receipt_vendor_name" varchar,
	"receipt_vendor_tax_id" varchar,
	"status" varchar DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"approver_id" varchar,
	"approver_name" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"policy_violations" jsonb,
	"policy_status" varchar DEFAULT 'compliant',
	"mileage_km" numeric(10, 2),
	"mileage_rate_per_km" numeric(5, 2),
	"location_name" varchar,
	"location_coordinates" varchar,
	"reimbursement_status" varchar DEFAULT 'pending',
	"reimbursement_date" date,
	"reimbursement_method" varchar,
	"ip_address" varchar,
	"user_agent" varchar,
	"last_modified_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"description" text,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiments_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "experiment_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"experiment_key" text NOT NULL,
	"user_id" varchar NOT NULL,
	"variant" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_assignments_experiment_key_experiments_key_fk" FOREIGN KEY ("experiment_key") REFERENCES "public"."experiments"("key") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "experiment_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "experiment_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"experiment_key" text NOT NULL,
	"winner_variant" text,
	"paused_variants" text[] DEFAULT '{}'::text[] NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	"decided_by" text DEFAULT 'auto' NOT NULL,
	"confidence_pct" numeric(5, 2),
	"uplift_pct" numeric(5, 2),
	"promoted_at" timestamp,
	"promotion_locked" boolean DEFAULT false NOT NULL,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_decisions_experiment_key_unique" UNIQUE("experiment_key")
);

CREATE TABLE IF NOT EXISTS "experiment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"experiment_key" text NOT NULL,
	"user_id" varchar NOT NULL,
	"variant" text NOT NULL,
	"event" text NOT NULL,
	"channel" text DEFAULT 'inapp' NOT NULL,
	"booking_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "logistics_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_number" varchar NOT NULL,
	"type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"station_id" integer NOT NULL,
	"description" text NOT NULL,
	"assigned_to_user_id" varchar,
	"preferred_window_start" timestamp,
	"preferred_window_end" timestamp,
	"failure_reason" text,
	"created_by_user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "logistics_tasks_task_number_unique" UNIQUE("task_number"),
	CONSTRAINT "logistics_tasks_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "field_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"task_id" integer,
	"created_by_user_id" varchar NOT NULL,
	"message" text NOT NULL,
	"status" varchar,
	"tags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "field_updates_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "field_updates_task_id_logistics_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."logistics_tasks"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "field_update_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_update_id" integer NOT NULL,
	"file_name" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"file_size_bytes" integer,
	"mime_type" varchar,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "field_update_photos_field_update_id_field_updates_id_fk" FOREIGN KEY ("field_update_id") REFERENCES "public"."field_updates"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "finance_archive_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"storage_ref" varchar(255) NOT NULL,
	"archived_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_archive_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"retention_days" integer NOT NULL,
	"archive_after_days" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_archive_retrievals" (
	"id" serial PRIMARY KEY NOT NULL,
	"artifact_id" integer NOT NULL,
	"requested_by_uid" varchar(128) NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retrieval_ref" varchar(255),
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_detail" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_archive_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"moved_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_control_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" varchar(128) NOT NULL,
	"signal_code" varchar(64) NOT NULL,
	"delivery_channel" varchar(20) DEFAULT 'email' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_digest_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uid" varchar(128) NOT NULL,
	"digest_type" varchar(32) NOT NULL,
	"min_severity" varchar(16) DEFAULT 'warning' NOT NULL,
	"include_control_center" boolean DEFAULT true NOT NULL,
	"include_executive_summary" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_code" varchar(32) NOT NULL,
	"entity_name" varchar(255) NOT NULL,
	"country_code" varchar(8) NOT NULL,
	"base_currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_entities_entity_code_unique" UNIQUE("entity_code")
);

CREATE TABLE IF NOT EXISTS "finance_playbook_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"surface_key" varchar(64) NOT NULL,
	"title" varchar(255) NOT NULL,
	"doc_url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_policy_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_key" varchar(64) NOT NULL,
	"policy_scope" varchar(32) NOT NULL,
	"division_code" varchar(40),
	"value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by_uid" varchar(128),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_policy_rules_policy_key_unique" UNIQUE("policy_key")
);

CREATE TABLE IF NOT EXISTS "finance_replay_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"replay_run_id" integer NOT NULL,
	"requested_by_uid" varchar(128) NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approved_by_uid" varchar(128),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_replay_diffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"replay_run_id" integer NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(128) NOT NULL,
	"before" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_replay_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"replay_run_id" integer NOT NULL,
	"report_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "finance_replay_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"replay_type" varchar(40) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"findings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"initiated_by" varchar(128)
);

CREATE TABLE IF NOT EXISTS "financial_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_reference" varchar(64) NOT NULL,
	"user_id" varchar NOT NULL,
	"booking_id" varchar,
	"transaction_id" varchar,
	"document_type" varchar(60) NOT NULL,
	"issued_by_entity" varchar(100) DEFAULT 'PetWash' NOT NULL,
	"document_payload_json" jsonb NOT NULL,
	"rendered_html" text NOT NULL,
	"rendered_pdf_url" varchar,
	"idempotency_key" varchar(255),
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "financial_documents_document_reference_unique" UNIQUE("document_reference")
);

CREATE TABLE IF NOT EXISTS "forecast_backtests" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" integer,
	"horizon_days" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"forecast_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actual_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "forecast_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_name" varchar(128) NOT NULL,
	"description" text,
	"base_horizon_days" integer DEFAULT 30 NOT NULL,
	"weight_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revenue_adjustment_pct" numeric(8, 4) DEFAULT '0' NOT NULL,
	"booking_volume_adjustment_pct" numeric(8, 4) DEFAULT '0' NOT NULL,
	"division_code" varchar(40),
	"last_run_at" timestamp with time zone,
	"last_run_result" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_uid" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "franchise_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"franchise_id" integer NOT NULL,
	"order_type" varchar(100) NOT NULL,
	"items" jsonb NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"payment_status" varchar(50) DEFAULT 'payment_required' NOT NULL,
	"payment_method" varchar(100),
	"payment_reference" varchar(255),
	"paid_at" timestamp,
	"order_status" varchar(50) DEFAULT 'pending_payment' NOT NULL,
	"processed_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"tracking_number" varchar(255),
	"notes" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "go_live_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"item" varchar(128),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"verified_by" varchar(128),
	"verified_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "go_live_gates" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" varchar(16) DEFAULT 'locked' NOT NULL,
	"checks_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approved_by" varchar(128),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "google_forms_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_type" varchar(50) NOT NULL,
	"form_url" text NOT NULL,
	"form_title" text,
	"form_title_he" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"height" integer DEFAULT 800,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_forms_config_form_type_unique" UNIQUE("form_type")
);

CREATE TABLE IF NOT EXISTS "governance_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_type" varchar(64),
	"severity" varchar(16),
	"message" text,
	"triggered_by" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "governance_delivery_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"pack_type" varchar(32) NOT NULL,
	"audience_name" varchar(128) NOT NULL,
	"period_key" varchar(32) NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "governance_pack_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"pack_type" varchar(32) NOT NULL,
	"period_key" varchar(32) NOT NULL,
	"sent_to" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature" varchar(255) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"error_detail" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "governance_pack_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"audience_name" varchar(128) NOT NULL,
	"pack_type" varchar(32) NOT NULL,
	"entity_code" varchar(32),
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"include_commentary" boolean DEFAULT true NOT NULL,
	"include_control_center" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "grooming_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"feedback_id" varchar NOT NULL,
	"station_id" integer NOT NULL,
	"customer_id" varchar NOT NULL,
	"customer_name" varchar,
	"pet_name" varchar,
	"pet_type" varchar,
	"service_type" varchar DEFAULT 'self_service_wash',
	"overall_rating" integer NOT NULL,
	"cleanliness_rating" integer,
	"equipment_rating" integer,
	"value_rating" integer,
	"ease_of_use_rating" integer,
	"comment" text,
	"photos" text[],
	"would_recommend" boolean,
	"is_flagged" boolean DEFAULT false,
	"flagged_reason" varchar,
	"is_visible" boolean DEFAULT true,
	"is_public" boolean DEFAULT true,
	"admin_response" text,
	"admin_responded_at" timestamp,
	"admin_responded_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "grooming_feedback_feedback_id_unique" UNIQUE("feedback_id"),
	CONSTRAINT "grooming_feedback_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "handbook_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"name_translations" jsonb,
	"description" text,
	"description_translations" jsonb,
	"icon" varchar(100),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "handbook_manuals" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"role" varchar(100) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"visibility" varchar(50) DEFAULT 'published',
	"view_count" integer DEFAULT 0,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "handbook_manuals_slug_unique" UNIQUE("slug"),
	CONSTRAINT "handbook_manuals_category_id_handbook_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."handbook_categories"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "handbook_manual_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"manual_id" integer NOT NULL,
	"language" varchar(10) NOT NULL,
	"current_version_id" integer,
	"published_at" timestamp,
	"published_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "handbook_manual_states_manual_id_handbook_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."handbook_manuals"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "handbook_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"manual_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"language" varchar(10) NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"content" jsonb NOT NULL,
	"media_urls" jsonb,
	"attachments" jsonb,
	"published_at" timestamp,
	"published_by" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "handbook_versions_manual_id_handbook_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."handbook_manuals"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "handbook_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"manual_id" integer NOT NULL,
	"version_id" integer,
	"assignee_role" varchar(100),
	"assignee_user_id" varchar,
	"title" varchar(500) NOT NULL,
	"title_translations" jsonb,
	"description" text,
	"description_translations" jsonb,
	"status" varchar(50) DEFAULT 'pending',
	"priority" varchar(50) DEFAULT 'normal',
	"due_date" timestamp,
	"completed_at" timestamp,
	"completed_by" varchar,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "handbook_tasks_manual_id_handbook_manuals_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."handbook_manuals"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "handbook_tasks_version_id_handbook_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."handbook_versions"("id") ON DELETE set null ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "health_safety_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_number" varchar NOT NULL,
	"station_id" integer NOT NULL,
	"reported_by_user_id" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"status" varchar DEFAULT 'open',
	"action_taken" text,
	"resolution_notes" text,
	"resolved_by_user_id" varchar,
	"resolved_at" timestamp,
	"reported_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "health_safety_incidents_incident_number_unique" UNIQUE("incident_number"),
	CONSTRAINT "health_safety_incidents_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "host_stay_details" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_request_id" integer NOT NULL,
	"request_id" varchar(24) NOT NULL,
	"owner_id" varchar(128) NOT NULL,
	"flow_type" varchar(20) DEFAULT 'HOST_HOME' NOT NULL,
	"pickup_at" timestamp,
	"dropoff_at" timestamp,
	"meeting_location" text,
	"emergency_contact_name" varchar(160),
	"emergency_contact_phone" varchar(40),
	"vet_name" varchar(160),
	"vet_phone" varchar(40),
	"food_instructions" text,
	"medication" text,
	"medication_dosage" text,
	"allergies" text,
	"behaviour_notes" text,
	"special_instructions" text,
	"provider_home_ready" boolean DEFAULT false NOT NULL,
	"provider_readiness" jsonb,
	"extra" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "host_stay_details_booking_request_id_unique" UNIQUE("booking_request_id"),
	CONSTRAINT "host_stay_details_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"endpoint" varchar(128),
	"response_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "identity_document_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_verification_id" varchar NOT NULL,
	"file_path" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "identity_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar,
	"document_type" varchar(50) NOT NULL,
	"document_number" varchar(100) NOT NULL,
	"issued_country" varchar(50),
	"expiry_date" varchar(50),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "identity_documents_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "identity_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"provider" varchar,
	"details" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);

CREATE TABLE IF NOT EXISTS "incident_drills" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario" varchar(64),
	"actions_taken_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recovery_time_seconds" integer,
	"success" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "incident_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"file_name" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"file_size_bytes" integer,
	"mime_type" varchar,
	"uploaded_by_user_id" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	CONSTRAINT "incident_photos_incident_id_health_safety_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."health_safety_incidents"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "incident_rca" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"anomaly_type" varchar(80),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hypotheses_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conclusion" text,
	"recommended_action" text,
	"confidence_overall" varchar(20) DEFAULT 'low',
	"generated_by" varchar(50) DEFAULT 'rca_engine' NOT NULL
);

CREATE TABLE IF NOT EXISTS "incident_timeline_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"actor" varchar(100) DEFAULT 'system' NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"anomaly_event_id" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_by" varchar(100) DEFAULT 'system' NOT NULL,
	"summary" text
);

CREATE TABLE IF NOT EXISTS "intervention_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"trigger_signal" varchar(50),
	"trigger_flag" varchar(50),
	"decision" varchar(50),
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"snapshot_margin_pct" numeric(6, 2),
	"snapshot_friction_pct" numeric(6, 2),
	"snapshot_reserve_risk" varchar(10),
	"snapshot_failure_rate" numeric(6, 2),
	"snapshot_gross_ils" numeric(12, 2)
);

CREATE TABLE IF NOT EXISTS "supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"unit_type" varchar NOT NULL,
	"unit_cost" numeric(10, 2),
	"supplier" varchar,
	"reorder_threshold" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "supplies_sku_unique" UNIQUE("sku")
);

CREATE TABLE IF NOT EXISTS "station_supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"supply_id" integer NOT NULL,
	"current_level" integer DEFAULT 0,
	"reorder_threshold" integer,
	"last_refill_at" timestamp,
	"last_refill_amount" integer,
	"last_refill_by_user_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "station_supplies_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "station_supplies_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "inventory_refills" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_supply_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"previous_level" integer NOT NULL,
	"new_level" integer NOT NULL,
	"refilled_by_user_id" varchar NOT NULL,
	"notes" text,
	"refilled_at" timestamp DEFAULT now(),
	CONSTRAINT "inventory_refills_station_supply_id_station_supplies_id_fk" FOREIGN KEY ("station_supply_id") REFERENCES "public"."station_supplies"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "israeli_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" varchar NOT NULL,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"description" text NOT NULL,
	"vendor" varchar NOT NULL,
	"amount_before_vat" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.18',
	"payment_method" varchar NOT NULL,
	"receipt_number" varchar,
	"invoice_number" varchar,
	"receipt_url" text,
	"is_deductible" boolean DEFAULT true,
	"deduction_percentage" integer DEFAULT 100,
	"tax_year" integer NOT NULL,
	"tax_month" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"notes" text,
	"attachments" text[],
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "israeli_expenses_expense_id_unique" UNIQUE("expense_id"),
	CONSTRAINT "israeli_expenses_approved_by_admin_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_expenses_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "israeli_income_tax_declarations" (
	"id" serial PRIMARY KEY NOT NULL,
	"declaration_id" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"tax_month" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_income" numeric(12, 2) NOT NULL,
	"net_income" numeric(12, 2) NOT NULL,
	"total_deductible_expenses" numeric(12, 2) DEFAULT '0',
	"salary_expenses" numeric(12, 2) DEFAULT '0',
	"operating_expenses" numeric(12, 2) DEFAULT '0',
	"depreciation" numeric(12, 2) DEFAULT '0',
	"other_deductions" numeric(12, 2) DEFAULT '0',
	"taxable_income" numeric(12, 2) NOT NULL,
	"estimated_tax" numeric(12, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft',
	"prepared_by" varchar NOT NULL,
	"prepared_at" timestamp DEFAULT now(),
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"submitted_to_accountant" boolean DEFAULT false,
	"submitted_at" timestamp,
	"filed_with_authority" boolean DEFAULT false,
	"filing_date" date,
	"excel_report_url" text,
	"pdf_report_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "israeli_income_tax_declarations_declaration_id_unique" UNIQUE("declaration_id"),
	CONSTRAINT "israeli_income_tax_declarations_prepared_by_admin_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_income_tax_declarations_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "israeli_vat_declarations" (
	"id" serial PRIMARY KEY NOT NULL,
	"declaration_id" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"tax_month" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_revenue" numeric(12, 2) NOT NULL,
	"total_output_vat" numeric(12, 2) NOT NULL,
	"transaction_count" integer DEFAULT 0,
	"total_expenses" numeric(12, 2) NOT NULL,
	"total_input_vat" numeric(12, 2) NOT NULL,
	"expense_count" integer DEFAULT 0,
	"net_vat_payable" numeric(12, 2) NOT NULL,
	"vat_refund_due" numeric(12, 2) DEFAULT '0',
	"form_1206_data" jsonb,
	"domestic_sales" numeric(12, 2) DEFAULT '0',
	"export_sales" numeric(12, 2) DEFAULT '0',
	"zero_rated_sales" numeric(12, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft',
	"prepared_by" varchar NOT NULL,
	"prepared_at" timestamp DEFAULT now(),
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"submitted_to_accountant" boolean DEFAULT false,
	"submitted_at" timestamp,
	"filed_with_authority" boolean DEFAULT false,
	"filing_date" date,
	"filing_reference_number" varchar,
	"excel_report_url" text,
	"pdf_report_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "israeli_vat_declarations_declaration_id_unique" UNIQUE("declaration_id"),
	CONSTRAINT "israeli_vat_declarations_prepared_by_admin_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_vat_declarations_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "israeli_national_insurance_declarations" (
	"id" serial PRIMARY KEY NOT NULL,
	"declaration_id" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"tax_month" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_employees" integer DEFAULT 0,
	"total_gross_salary" numeric(12, 2) DEFAULT '0',
	"employer_contribution" numeric(12, 2) DEFAULT '0',
	"employee_contribution" numeric(12, 2) DEFAULT '0',
	"total_contribution" numeric(12, 2) DEFAULT '0',
	"owner_income" numeric(12, 2) DEFAULT '0',
	"owner_contribution" numeric(12, 2) DEFAULT '0',
	"status" varchar DEFAULT 'draft',
	"prepared_by" varchar NOT NULL,
	"prepared_at" timestamp DEFAULT now(),
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"submitted_to_accountant" boolean DEFAULT false,
	"submitted_at" timestamp,
	"filed_with_authority" boolean DEFAULT false,
	"filing_date" date,
	"excel_report_url" text,
	"pdf_report_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "israeli_national_insurance_declarations_declaration_id_unique" UNIQUE("declaration_id"),
	CONSTRAINT "israeli_national_insurance_declarations_prepared_by_admin_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_national_insurance_declarations_reviewed_by_admin_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "israeli_monthly_financial_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" varchar NOT NULL,
	"tax_year" integer NOT NULL,
	"tax_month" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"vat_declaration_id" varchar,
	"income_tax_declaration_id" varchar,
	"national_insurance_declaration_id" varchar,
	"total_revenue" numeric(12, 2) NOT NULL,
	"total_expenses" numeric(12, 2) NOT NULL,
	"net_profit" numeric(12, 2) NOT NULL,
	"status" varchar DEFAULT 'in_progress',
	"master_excel_url" text,
	"master_pdf_url" text,
	"transaction_details_url" text,
	"expense_details_url" text,
	"accountant_email" varchar,
	"sent_to_accountant_at" timestamp,
	"accountant_confirmed_receipt" boolean DEFAULT false,
	"accountant_notes" text,
	"vat_filed" boolean DEFAULT false,
	"income_tax_filed" boolean DEFAULT false,
	"national_insurance_filed" boolean DEFAULT false,
	"all_filings_complete" boolean DEFAULT false,
	"prepared_by" varchar NOT NULL,
	"prepared_at" timestamp DEFAULT now(),
	"final_approved_by" varchar,
	"final_approved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "israeli_monthly_financial_packages_package_id_unique" UNIQUE("package_id"),
	CONSTRAINT "israeli_monthly_financial_packages_vat_declaration_id_israeli_vat_declarations_declaration_id_fk" FOREIGN KEY ("vat_declaration_id") REFERENCES "public"."israeli_vat_declarations"("declaration_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_monthly_financial_packages_income_tax_declaration_id_israeli_income_tax_declarations_declaration_id_fk" FOREIGN KEY ("income_tax_declaration_id") REFERENCES "public"."israeli_income_tax_declarations"("declaration_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_monthly_financial_packages_national_insurance_declaration_id_israeli_national_insurance_declarations_declaration_id_fk" FOREIGN KEY ("national_insurance_declaration_id") REFERENCES "public"."israeli_national_insurance_declarations"("declaration_id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_monthly_financial_packages_prepared_by_admin_users_id_fk" FOREIGN KEY ("prepared_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "israeli_monthly_financial_packages_final_approved_by_admin_users_id_fk" FOREIGN KEY ("final_approved_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "job_offers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"platform" varchar(50) NOT NULL,
	"operator_id" varchar,
	"operator_name" varchar,
	"customer_id" varchar NOT NULL,
	"customer_name" varchar,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"service_type" varchar(100) NOT NULL,
	"service_date" timestamp NOT NULL,
	"duration" integer,
	"location" jsonb,
	"geohash" varchar(20),
	"base_amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"vat" numeric(10, 2) NOT NULL,
	"total_charge" numeric(10, 2) NOT NULL,
	"operator_payout" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'ILS' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"offered_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"expired_at" timestamp,
	"completed_at" timestamp,
	"offer_history" jsonb,
	"payment_intent_id" varchar,
	"dispatch_wave" integer DEFAULT 0,
	"dispatch_radius_km" integer,
	"offer_expires_at" timestamp,
	"next_wave_at" timestamp,
	"dispatch_leased_until" timestamp,
	"offered_operator_ids" jsonb,
	"pet_ids" jsonb,
	"special_instructions" text,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "k9000_wash_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_source" varchar NOT NULL,
	"redemption_source" varchar NOT NULL,
	"egift_id" varchar,
	"user_id" varchar,
	"document_reference" varchar,
	"nayax_transaction_id" varchar,
	"nayax_terminal_id" varchar,
	"nayax_session_id" varchar,
	"station_id" varchar,
	"bay_side" varchar,
	"platform" varchar,
	"product" varchar,
	"amount_cents" integer,
	"currency" varchar(3) DEFAULT 'ILS',
	"loyalty_points_awarded" integer DEFAULT 0,
	"loyalty_event_logged" boolean DEFAULT false,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"failure_reason" text,
	"idempotency_key" varchar,
	"sumit_document_id" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "k9000_wash_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "k9000_wash_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "kill_switch_trigger_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"anomaly_event_id" integer NOT NULL,
	"priority_score" numeric NOT NULL,
	"kill_switch_key" varchar(100) NOT NULL,
	"action_taken" varchar(20) NOT NULL,
	"operator_note" text,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kill_switch_trigger_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"anomaly_type" varchar(100) NOT NULL,
	"min_score" integer DEFAULT 70 NOT NULL,
	"kill_switch_key" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"action" varchar(20) DEFAULT 'suggest' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kiosk_machines" (
	"id" serial PRIMARY KEY NOT NULL,
	"kiosk_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar,
	"location" varchar NOT NULL,
	"location_he" varchar,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"machine_type" varchar NOT NULL,
	"manufacturer" varchar,
	"model" varchar,
	"serial_number" varchar,
	"nayax_terminal_id" varchar,
	"nayax_merchant_id" varchar,
	"qr_reader_enabled" boolean DEFAULT true,
	"hmac_secret_encrypted" text,
	"hmac_secret_rotated_at" timestamp,
	"total_slots" integer DEFAULT 36,
	"active_slots" integer DEFAULT 0,
	"status" varchar DEFAULT 'planned',
	"is_online" boolean DEFAULT false,
	"last_heartbeat" timestamp,
	"installation_date" date,
	"last_maintenance_date" date,
	"next_maintenance_date" date,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"total_transactions" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kiosk_machines_kiosk_id_unique" UNIQUE("kiosk_id"),
	CONSTRAINT "kiosk_machines_nayax_terminal_id_unique" UNIQUE("nayax_terminal_id")
);

CREATE TABLE IF NOT EXISTS "kiosk_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar,
	"description" text,
	"description_he" text,
	"category" varchar NOT NULL,
	"subcategory" varchar,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"cost" numeric(10, 2),
	"brand" varchar,
	"weight" varchar,
	"ingredients" text,
	"ingredients_he" text,
	"allergens" text,
	"allergens_he" text,
	"calories_per_serving" integer,
	"protein_percent" numeric(5, 2),
	"fat_percent" numeric(5, 2),
	"barcode" varchar,
	"supplier_sku" varchar,
	"is_active" boolean DEFAULT true,
	"is_healthy" boolean DEFAULT true,
	"image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kiosk_products_sku_unique" UNIQUE("sku")
);

CREATE TABLE IF NOT EXISTS "kiosk_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"kiosk_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"slot_number" integer NOT NULL,
	"current_stock" integer DEFAULT 0,
	"max_capacity" integer DEFAULT 10,
	"min_threshold" integer DEFAULT 3,
	"last_restocked" timestamp,
	"restocked_by" varchar,
	"is_low_stock" boolean DEFAULT false,
	"is_out_of_stock" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kiosk_inventory_kiosk_id_kiosk_machines_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_machines"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "kiosk_inventory_product_id_kiosk_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."kiosk_products"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "kiosk_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" varchar NOT NULL,
	"kiosk_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"payment_method" varchar NOT NULL,
	"nayax_transaction_id" varchar,
	"voucher_code" varchar,
	"status" varchar DEFAULT 'completed',
	"customer_email" varchar,
	"customer_phone" varchar,
	"transaction_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kiosk_sales_sale_id_unique" UNIQUE("sale_id"),
	CONSTRAINT "kiosk_sales_kiosk_id_kiosk_machines_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_machines"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "kiosk_sales_product_id_kiosk_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."kiosk_products"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "kyc_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" varchar(64) NOT NULL,
	"action" varchar(50) NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"actor_role" varchar(100) NOT NULL,
	"target_user_id" varchar(255),
	"verification_id" varchar(100),
	"ip_address" varchar(100),
	"user_agent" text,
	"device_fingerprint" varchar(64),
	"metadata" jsonb,
	"risk_score" integer,
	"previous_hash" varchar(64) NOT NULL,
	"entry_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kyc_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role_context" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"risk_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"decided_by" varchar,
	"decided_at" timestamp,
	"decision_reason" text
);

CREATE TABLE IF NOT EXISTS "kyc_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"kyc_case_id" integer NOT NULL,
	"check_type" varchar NOT NULL,
	"result" varchar NOT NULL,
	"score" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "kyc_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"kyc_case_id" integer NOT NULL,
	"doc_type" varchar NOT NULL,
	"country" varchar(5),
	"storage_mode" varchar DEFAULT 'zero_storage',
	"storage_ref" varchar,
	"processing_ref" varchar,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"fingerprint_hash" varchar,
	"status" varchar DEFAULT 'received' NOT NULL
);

CREATE TABLE IF NOT EXISTS "kyc_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"actor" varchar(128) NOT NULL,
	"result" varchar(40),
	"reason" text,
	"source_ip" varchar(60),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kyc_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" varchar(64) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'detected' NOT NULL,
	"affected_users" jsonb,
	"containment_actions" jsonb,
	"evidence" jsonb,
	"detected_at" timestamp NOT NULL,
	"responded_at" timestamp,
	"resolved_at" timestamp,
	"resolved_by" varchar(255),
	"resolution" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kyc_incidents_incident_id_unique" UNIQUE("incident_id")
);

CREATE TABLE IF NOT EXISTS "kyc_quarantine_objects" (
	"id" serial PRIMARY KEY NOT NULL,
	"object_key" varchar(500) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"document_type" varchar(60) NOT NULL,
	"storage_system" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delete_by" timestamp NOT NULL,
	"deleted_at" timestamp,
	"deletion_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason_code" varchar(100)
);

CREATE TABLE IF NOT EXISTS "kyc_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"assigned_by" varchar(255) NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "liveness_checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"risk_score" real NOT NULL,
	"failure_reason" text,
	"selfie_url" varchar,
	"face_match_score" real,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "logistics_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar NOT NULL,
	"type" varchar NOT NULL,
	"plate_number" varchar NOT NULL,
	"driver_user_id" varchar,
	"capacity_kg" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "logistics_vehicles_plate_number_unique" UNIQUE("plate_number")
);

CREATE TABLE IF NOT EXISTS "loyalty_rules" (
	"rule_key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"reward_ils_cents" integer DEFAULT 0 NOT NULL,
	"expiry_days" integer,
	"min_booking_ils" integer,
	"max_uses_per_user" integer,
	"description" text,
	"armed" boolean DEFAULT false NOT NULL,
	"daily_send_cap" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reward_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"rule_key" text NOT NULL,
	"booking_id" integer,
	"referral_id" integer,
	"unique_fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reward_claims_unique_fingerprint_unique" UNIQUE("unique_fingerprint"),
	CONSTRAINT "reward_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "reward_claims_rule_key_loyalty_rules_rule_key_fk" FOREIGN KEY ("rule_key") REFERENCES "public"."loyalty_rules"("rule_key") ON DELETE restrict ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "loyalty_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"amount_ils_cents" integer NOT NULL,
	"balance_after_cents" integer NOT NULL,
	"booking_id" integer,
	"referral_id" integer,
	"reward_claim_id" integer,
	"experiment_variant" text,
	"expires_at" timestamp,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "loyalty_ledger_reward_claim_id_reward_claims_id_fk" FOREIGN KEY ("reward_claim_id") REFERENCES "public"."reward_claims"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "machine_commands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command_id" varchar(64) NOT NULL,
	"station_id" varchar(64) NOT NULL,
	"bay_id" varchar(64),
	"session_id" varchar(64),
	"side" varchar(10),
	"command_type" varchar(30) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timeout_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"compensation_triggered_at" timestamp with time zone,
	"machine_client_ip" varchar(64),
	"correlation_id" varchar(64),
	"source" varchar(30),
	CONSTRAINT "machine_commands_command_id_unique" UNIQUE("command_id")
);

CREATE TABLE IF NOT EXISTS "marketplace_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"overall_rating" integer NOT NULL,
	"review_text" text,
	"is_visible" boolean DEFAULT true,
	"is_flagged" boolean DEFAULT false,
	"flag_reason" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"platform_id" varchar NOT NULL,
	"plan_name" varchar NOT NULL,
	"plan_type" varchar NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"billing_interval" varchar NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar,
	"status" varchar DEFAULT 'active',
	"bookings_per_interval" integer,
	"bookings_used" integer DEFAULT 0,
	"start_date" timestamp NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at" timestamp,
	"cancelled_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "memberships_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "user_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"sender_email" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"recipient_name" varchar NOT NULL,
	"recipient_email" varchar NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"message_type" varchar DEFAULT 'general',
	"priority" varchar DEFAULT 'normal',
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"is_starred" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"message_hash" varchar NOT NULL,
	"gcs_backup_path" varchar,
	"backup_status" varchar DEFAULT 'pending',
	"encrypted_content" text,
	"audit_hash" varchar NOT NULL,
	"previous_message_hash" varchar,
	"deleted_by_sender" boolean DEFAULT false,
	"deleted_by_recipient" boolean DEFAULT false,
	"permanently_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar NOT NULL,
	"gcs_path" varchar NOT NULL,
	"public_url" varchar,
	"url_expires_at" timestamp,
	"file_hash" varchar NOT NULL,
	"is_scanned" boolean DEFAULT false,
	"scan_status" varchar DEFAULT 'pending',
	"backup_status" varchar DEFAULT 'completed',
	"retention_policy" varchar DEFAULT '7_years',
	"scheduled_deletion_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "message_attachments_message_id_user_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."user_messages"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "signed_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"signature_id" integer NOT NULL,
	"document_type" varchar NOT NULL,
	"document_title" varchar NOT NULL,
	"document_description" text,
	"original_document_url" varchar NOT NULL,
	"signed_document_url" varchar NOT NULL,
	"document_hash" varchar NOT NULL,
	"signed_by" varchar NOT NULL,
	"signed_by_title" varchar,
	"recipient_name" varchar,
	"recipient_email" varchar,
	"signed_date" timestamp NOT NULL,
	"effective_date" timestamp,
	"expiry_date" timestamp,
	"metadata" jsonb,
	"email_sent_to" text,
	"cc_emails" text,
	"email_sent_at" timestamp,
	"email_delivery_status" varchar,
	"audit_hash" varchar NOT NULL,
	"previous_document_hash" varchar,
	"status" varchar DEFAULT 'active',
	"revoked_at" timestamp,
	"revoked_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "signed_documents_signature_id_digital_signatures_id_fk" FOREIGN KEY ("signature_id") REFERENCES "public"."digital_signatures"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "message_signature_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"signature_id" integer,
	"signed_document_id" integer,
	"requested_by" varchar NOT NULL,
	"requested_from" varchar NOT NULL,
	"document_title" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_description" text,
	"unsigned_document_gcs_path" varchar NOT NULL,
	"signed_document_gcs_path" varchar,
	"status" varchar DEFAULT 'pending',
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"expires_at" timestamp,
	"notification_sent" boolean DEFAULT false,
	"reminders_sent" integer DEFAULT 0,
	"last_reminder_at" timestamp,
	"audit_hash" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "message_signature_requests_message_id_user_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."user_messages"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "message_signature_requests_signature_id_digital_signatures_id_fk" FOREIGN KEY ("signature_id") REFERENCES "public"."digital_signatures"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "message_signature_requests_signed_document_id_signed_documents_id_fk" FOREIGN KEY ("signed_document_id") REFERENCES "public"."signed_documents"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "mfa_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"method" varchar(20) NOT NULL,
	"totp_secret" varchar(512),
	"totp_verified" boolean DEFAULT false,
	"sms_phone" varchar(30),
	"email_address" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "money_flow_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"check_type" varchar(64),
	"entity_id" varchar(128),
	"expected_value" numeric(12, 2),
	"actual_value" numeric(12, 2),
	"status" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "nayax_transaction_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_transaction_id" varchar NOT NULL,
	"machine_id" varchar NOT NULL,
	"terminal_id" varchar,
	"station_id" varchar,
	"payment_channel" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"approval_status" varchar NOT NULL,
	"amount_gross" numeric(10, 2) NOT NULL,
	"amount_net" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'ILS',
	"transaction_time" timestamp NOT NULL,
	"customer_phone_hash" varchar,
	"monyx_customer_id" varchar,
	"linked_petwash_user_id" varchar,
	"raw_payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"processing_status" varchar DEFAULT 'pending',
	"loyalty_awarded" boolean DEFAULT false,
	"loyalty_points_awarded" integer DEFAULT 0,
	"refund_reversed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "nayax_transaction_events_external_transaction_id_unique" UNIQUE("external_transaction_id")
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_key" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"recipient_user_id" varchar,
	"recipient_email" varchar,
	"recipient_phone" varchar,
	"status" varchar DEFAULT 'pending',
	"payload" jsonb,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now(),
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"booking_id" varchar,
	"transaction_id" varchar,
	"event_type" varchar,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"permanently_failed" boolean DEFAULT false NOT NULL,
	"idempotency_key" varchar(255),
	"provider_message_id" varchar(255),
	"title" varchar(500),
	"body" text,
	"deep_link" varchar(500)
);

CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"channels" jsonb NOT NULL,
	"email_subject" varchar,
	"email_body" text,
	"sms_body" text,
	"whatsapp_body" text,
	"push_title" varchar,
	"push_body" text,
	"in_app_title" varchar,
	"in_app_body" text,
	"default_recipients" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_templates_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "oauth_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"provider" varchar NOT NULL,
	"user_email" varchar,
	"timestamp" timestamp NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"language" varchar DEFAULT 'en',
	"consent_version" varchar DEFAULT '1.0',
	"privacy_policy_version" varchar,
	"terms_of_service_version" varchar,
	"audit_hash" varchar,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "operating_review_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_key" varchar(32),
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "operating_review_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar(7) NOT NULL,
	"pack_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature" varchar(255) DEFAULT '' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operating_review_packs_month_unique" UNIQUE("month")
);

CREATE TABLE IF NOT EXISTS "operator_presence" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" varchar NOT NULL,
	"operator_name" varchar,
	"platform" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'offline' NOT NULL,
	"current_location" jsonb,
	"geohash" varchar(20),
	"rating_avg" numeric(3, 2) DEFAULT '5.00',
	"acceptance_rate" numeric(5, 2) DEFAULT '100.00',
	"completed_jobs_30d" integer DEFAULT 0,
	"premium_badge" boolean DEFAULT false,
	"subscription_active" boolean DEFAULT false,
	"cooldown_until" timestamp,
	"recent_rejects" integer DEFAULT 0,
	"recent_ignores" integer DEFAULT 0,
	"service_types" jsonb,
	"last_active_at" timestamp DEFAULT now(),
	"last_location_update_at" timestamp,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "operator_presence_operator_id_unique" UNIQUE("operator_id")
);

CREATE TABLE IF NOT EXISTS "orchestration_retry_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"orchestration_run_id" integer NOT NULL,
	"attempt_no" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'started' NOT NULL,
	"error_message" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "orchestration_retry_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_type" varchar(64) NOT NULL,
	"error_pattern" varchar(255) NOT NULL,
	"auto_retry_enabled" boolean DEFAULT true NOT NULL,
	"max_retries" integer DEFAULT 2 NOT NULL,
	"retry_delay_minutes" integer DEFAULT 15 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"contact_email" varchar,
	"contact_phone" varchar,
	"revenue_share_percent" numeric(5, 2),
	"contract_start" timestamp,
	"contract_end" timestamp,
	"is_active" boolean DEFAULT true,
	"billing_address" text,
	"tax_id" varchar,
	"bank_details" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "partner_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"station_id" integer,
	"revenue_share_percent" numeric(5, 2) NOT NULL,
	"minimum_monthly_amount" numeric(10, 2),
	"maximum_monthly_amount" numeric(10, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "partner_agreements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "partner_agreements_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "passport_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"passport_number" varchar NOT NULL,
	"surname" varchar NOT NULL,
	"given_names" varchar NOT NULL,
	"date_of_birth" date NOT NULL,
	"country_code" varchar(3) NOT NULL,
	"nationality" varchar(3) NOT NULL,
	"sex" varchar(1) NOT NULL,
	"expiry_date" date NOT NULL,
	"is_expired" boolean DEFAULT false,
	"verification_status" varchar DEFAULT 'pending',
	"verified_by" varchar,
	"verified_at" timestamp,
	"rejection_reason" text,
	"passport_image_url" varchar,
	"selfie_image_url" varchar,
	"raw_mrz" text,
	"mrz_confidence" numeric(5, 2),
	"ip_address" varchar,
	"user_agent" varchar,
	"consent_given" boolean DEFAULT false,
	"consent_timestamp" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "payment_intents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"platform_id" varchar(50) NOT NULL,
	"user_id" varchar NOT NULL,
	"provider_id" varchar,
	"transaction_id" varchar,
	"nayax_authorization_id" varchar,
	"nayax_capture_id" varchar,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"status" varchar(20) DEFAULT 'created' NOT NULL,
	"payment_method" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"error_code" varchar,
	"error_message" text
);

CREATE TABLE IF NOT EXISTS "payout_release_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" varchar(64) NOT NULL,
	"requested_by_uid" varchar(128) NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by_uid" varchar(128),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payout_release_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_code" varchar(40),
	"min_amount_cents" integer DEFAULT 0 NOT NULL,
	"max_amount_cents" integer,
	"requires_second_approval" boolean DEFAULT true NOT NULL,
	"allowed_auto_release" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_by_uid" varchar(128),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payout_schedule_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" varchar(20) DEFAULT 'created' NOT NULL,
	"batch_id" varchar(64),
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "payout_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_code" varchar(40),
	"cadence" varchar(20) NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"min_batch_net_cents" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by_uid" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "period_close_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_type" varchar(16) NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pack_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature" varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "petwash_vouchers_2025" (
	"id" varchar PRIMARY KEY NOT NULL,
	"public_code" varchar NOT NULL,
	"type" varchar NOT NULL,
	"value_type" varchar NOT NULL,
	"tier" varchar DEFAULT '7star_metal' NOT NULL,
	"card_theme" varchar DEFAULT 'neo_black_platinum' NOT NULL,
	"animated_highlight" boolean DEFAULT true,
	"highres_svg_url" text,
	"value_original" numeric(12, 2),
	"value_remaining" numeric(12, 2),
	"washes_original" integer,
	"washes_remaining" integer,
	"currency" varchar DEFAULT 'ILS',
	"expires_at" timestamp with time zone,
	"transferable" boolean DEFAULT true,
	"owner_id" varchar NOT NULL,
	"owner_name" varchar NOT NULL,
	"owner_email" varchar NOT NULL,
	"created_in_app" varchar DEFAULT 'PetWash Hub 1.0.0',
	"qr_url" text,
	"sha256_hash" text NOT NULL,
	"signed_jws" text,
	"last_used" timestamp with time zone,
	"redeem_method" varchar DEFAULT 'app',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "petwash_vouchers_2025_public_code_unique" UNIQUE("public_code")
);

CREATE TABLE IF NOT EXISTS "petwash_pass_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_id" text NOT NULL,
	"user_id" text NOT NULL,
	"owner_name" text NOT NULL,
	"owner_email" text,
	"owner_phone" text,
	"primary_pet_name" text,
	"tier" text DEFAULT 'PREMIUM' NOT NULL,
	"available_credit_ils" numeric(12, 2) DEFAULT '0' NOT NULL,
	"valid_until" timestamp with time zone,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"qr_token_version" integer DEFAULT 1 NOT NULL,
	"apple_serial_number" text NOT NULL,
	"google_object_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "petwash_pass_accounts_pass_id_unique" UNIQUE("pass_id"),
	CONSTRAINT "petwash_pass_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "petwash_pass_accounts_apple_serial_number_unique" UNIQUE("apple_serial_number"),
	CONSTRAINT "petwash_pass_accounts_google_object_id_unique" UNIQUE("google_object_id")
);

CREATE TABLE IF NOT EXISTS "petwash_pass_nonce_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"pass_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "petwash_pass_nonce_registry_nonce_unique" UNIQUE("nonce")
);

CREATE TABLE IF NOT EXISTS "petwash_pass_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_id" text NOT NULL,
	"user_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text,
	"direction" text NOT NULL,
	"amount_ils" numeric(12, 2) NOT NULL,
	"balance_before_ils" numeric(12, 2) NOT NULL,
	"balance_after_ils" numeric(12, 2) NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pin_auth_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_type" varchar(20) NOT NULL,
	"action" varchar(30) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"device_id" varchar(255),
	"device_type" varchar(50),
	"failed_attempt_number" integer,
	"lockout_duration" integer,
	"country" varchar(2),
	"city" varchar(100),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "policy_learning_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_plan_id" integer,
	"suggestion_type" varchar(30) NOT NULL,
	"policy_area" varchar(100) NOT NULL,
	"suggested_change" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trigger_reason" text,
	"confidence_delta" numeric(8, 4) DEFAULT '0',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "policy_outcome_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_key" varchar(64) NOT NULL,
	"entity_code" varchar(32),
	"evaluation_period_start" date NOT NULL,
	"evaluation_period_end" date NOT NULL,
	"baseline_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actual_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"roi_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "policy_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"simulation_id" integer NOT NULL,
	"policy_key" varchar(64) NOT NULL,
	"proposed_value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"promoted_by_uid" varchar(128) NOT NULL,
	"promoted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rollback_value_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "policy_simulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"simulated_by_uid" varchar(128) NOT NULL,
	"policy_key" varchar(64) NOT NULL,
	"original_value" text,
	"proposed_value" text NOT NULL,
	"division_code" varchar(40),
	"simulation_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"outcome_summary" text,
	"outcome_detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"affected_entities" integer DEFAULT 0 NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"would_save_cents" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "priority_feedback_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_id" integer,
	"previous_score" numeric(8, 2),
	"adjusted_score" numeric(8, 2),
	"delta" numeric(8, 2),
	"adjustment_reason" text,
	"based_on_outcome_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"date" date NOT NULL,
	"time_slot" varchar,
	"is_available" boolean DEFAULT true,
	"max_bookings" integer DEFAULT 1,
	"current_bookings" integer DEFAULT 0,
	"custom_rate_cents" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_blocked_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_uid" varchar NOT NULL,
	"blocked_type" varchar NOT NULL,
	"blocked_ref" varchar NOT NULL,
	"blocked_name" varchar,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"certificate_id" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"provider_name" varchar(255) NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"status" varchar(20) DEFAULT 'active',
	"verification_hash" varchar(64),
	"verification_url" varchar(500),
	"pdf_url" varchar(500),
	"qr_code_url" varchar(500),
	"revoked_at" timestamp,
	"revoked_by" varchar(255),
	"revocation_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_certificates_certificate_id_unique" UNIQUE("certificate_id")
);

CREATE TABLE IF NOT EXISTS "provider_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"commission_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"booking_id" integer NOT NULL,
	"customer_paid_amount" numeric(10, 2) NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"provider_earnings" numeric(10, 2) NOT NULL,
	"includes_vat" boolean DEFAULT true,
	"vat_amount" numeric(10, 2),
	"status" varchar DEFAULT 'pending',
	"paid_to_provider_at" timestamp,
	"payment_method" varchar,
	"payment_reference_id" varchar,
	"invoice_generated" boolean DEFAULT false,
	"invoice_number" varchar NOT NULL,
	"invoice_url" varchar,
	"transaction_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_commissions_commission_id_unique" UNIQUE("commission_id"),
	CONSTRAINT "provider_commissions_invoice_number_unique" UNIQUE("invoice_number")
);

CREATE TABLE IF NOT EXISTS "provider_independence_score" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"total_clients" integer DEFAULT 1,
	"exclusivity_score" numeric(5, 2) DEFAULT '100.00',
	"petwash_revenue_percent" numeric(5, 2) DEFAULT '100.00',
	"other_platforms_revenue" numeric(10, 2) DEFAULT '0.00',
	"has_own_equipment" boolean DEFAULT false,
	"can_refuse_gigs" boolean DEFAULT true,
	"set_own_rates" boolean DEFAULT false,
	"has_substitutes" boolean DEFAULT false,
	"employee_risk_score" numeric(5, 2) DEFAULT '0.00',
	"risk_level" varchar DEFAULT 'low',
	"compliance_recommendations" jsonb,
	"last_calculated_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_independence_score_provider_id_unique" UNIQUE("provider_id")
);

CREATE TABLE IF NOT EXISTS "provider_intake_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"intake_id" varchar NOT NULL,
	"google_form_response_id" varchar,
	"google_sheet_row_number" integer,
	"synced_from_sheet_id" varchar,
	"synced_at" timestamp,
	"email" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"selected_platforms" text[] DEFAULT '{}',
	"intended_pricing" jsonb DEFAULT '{}'::jsonb,
	"city" varchar,
	"country" varchar DEFAULT 'IL',
	"latitude" numeric,
	"longitude" numeric,
	"years_experience" integer,
	"has_own_transport" boolean DEFAULT false,
	"has_pet_first_aid" boolean DEFAULT false,
	"has_insurance" boolean DEFAULT false,
	"availability_notes" text,
	"preferred_working_days" text[],
	"preferred_hours" varchar,
	"about_me" text,
	"why_join_pet_wash" text,
	"referral_source" varchar,
	"resume_url" varchar,
	"portfolio_url" varchar,
	"linkedin_url" varchar,
	"profile_photo_url" text,
	"status" varchar DEFAULT 'new',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"generated_invite_code" varchar,
	"invite_sent_at" timestamp,
	"invite_sent_via" varchar,
	"converted_to_application_id" varchar,
	"converted_at" timestamp,
	"backup_drive_file_id" varchar,
	"backup_sheet_row_ref" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_intake_queue_intake_id_unique" UNIQUE("intake_id"),
	CONSTRAINT "provider_intake_queue_google_form_response_id_unique" UNIQUE("google_form_response_id")
);

CREATE TABLE IF NOT EXISTS "provider_operational_settings" (
	"provider_uid" varchar PRIMARY KEY NOT NULL,
	"auto_accept" boolean DEFAULT false NOT NULL,
	"instant_booking" boolean DEFAULT false NOT NULL,
	"require_approval" boolean DEFAULT true NOT NULL,
	"same_day_bookings" boolean DEFAULT true NOT NULL,
	"weekend_jobs" boolean DEFAULT true NOT NULL,
	"night_jobs" boolean DEFAULT false NOT NULL,
	"night_start_hour" integer DEFAULT 22 NOT NULL,
	"night_end_hour" integer DEFAULT 6 NOT NULL,
	"repeat_customers_only" boolean DEFAULT false NOT NULL,
	"new_customer_requests" boolean DEFAULT true NOT NULL,
	"notif_in_app" boolean DEFAULT true NOT NULL,
	"notif_push" boolean DEFAULT true NOT NULL,
	"notif_email" boolean DEFAULT true NOT NULL,
	"notif_sms_emergency" boolean DEFAULT true NOT NULL,
	"ai_suggestions" boolean DEFAULT true NOT NULL,
	"max_simultaneous" integer DEFAULT 1 NOT NULL,
	"max_jobs_per_day" integer DEFAULT 5 NOT NULL,
	"buffer_minutes" integer DEFAULT 30 NOT NULL,
	"travel_radius_km" integer DEFAULT 10 NOT NULL,
	"home_visits_only" boolean DEFAULT false NOT NULL,
	"holiday_mode" boolean DEFAULT false NOT NULL,
	"holiday_start" timestamp,
	"holiday_end" timestamp,
	"emergency_unavailable" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_payout_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_uid" varchar(200) NOT NULL,
	"division_code" varchar(50) NOT NULL,
	"booking_id" varchar(100),
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"commission_rate_bps" integer DEFAULT 0 NOT NULL,
	"net_cents" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'earned' NOT NULL,
	"payout_batch_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_platform_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"membership_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"approved_at" timestamp,
	"approved_by" varchar,
	"platform_verification_status" varchar DEFAULT 'pending',
	"platform_specific_docs" jsonb DEFAULT '{}'::jsonb,
	"total_bookings" integer DEFAULT 0,
	"average_rating" numeric(3, 2),
	"response_rate" numeric(5, 2),
	"acceptance_rate" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_platform_memberships_membership_id_unique" UNIQUE("membership_id")
);

CREATE TABLE IF NOT EXISTS "provider_police_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"document_type" varchar(50) DEFAULT 'police_clearance',
	"document_url" varchar(500),
	"document_file_name" varchar(255),
	"status" varchar(20) DEFAULT 'pending',
	"issued_at" timestamp,
	"expires_at" timestamp,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"badge_issued" boolean DEFAULT false,
	"badge_issued_at" timestamp,
	"biometric_verified" boolean DEFAULT false,
	"biometric_match_score" varchar(10),
	"id_document_url" varchar(500),
	"selfie_url" varchar(500),
	"biometric_verified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_ranking_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_user_id" text NOT NULL,
	"admin_uid" text NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_rate_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"rate_card_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"provider_profile_id" integer,
	"platform" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"base_rate_per_night_cents" integer,
	"base_rate_per_hour_cents" integer,
	"base_rate_per_visit_cents" integer,
	"additional_pet_surcharge_cents" integer DEFAULT 0,
	"max_pets" integer DEFAULT 3,
	"weekly_discount_percent" integer DEFAULT 0,
	"monthly_discount_percent" integer DEFAULT 0,
	"weekend_surcharge_percent" integer DEFAULT 0,
	"holiday_surcharge_percent" integer DEFAULT 0,
	"biweekly_discount_percent" integer DEFAULT 0,
	"cleaning_fee_cents" integer DEFAULT 0,
	"security_deposit_percent" integer DEFAULT 0,
	"nightly_rate_progression" jsonb,
	"peak_date_ranges" jsonb DEFAULT '[]'::jsonb,
	"pet_type_pricing" jsonb DEFAULT '{}'::jsonb,
	"enabled_addons" text[] DEFAULT '{}',
	"addon_pricing" jsonb DEFAULT '{}'::jsonb,
	"pricing_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"addons_catalog" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"min_booking_hours" integer DEFAULT 1,
	"max_booking_days" integer DEFAULT 30,
	"last_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_rate_cards_rate_card_id_unique" UNIQUE("rate_card_id")
);

CREATE TABLE IF NOT EXISTS "provider_safety_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_uid" varchar NOT NULL,
	"subject_type" varchar NOT NULL,
	"subject_id" varchar NOT NULL,
	"subject_name" varchar,
	"notes" text NOT NULL,
	"risk_level" varchar DEFAULT 'low' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_tax_compliance" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"tax_id_type" varchar NOT NULL,
	"tax_id" varchar NOT NULL,
	"tax_registration_number" varchar,
	"is_vat_registered" boolean DEFAULT false,
	"vat_number" varchar,
	"national_insurance_number" varchar NOT NULL,
	"is_bituach_leumi_active" boolean DEFAULT true,
	"verification_status" varchar DEFAULT 'pending',
	"verified_at" timestamp,
	"verified_by_user_id" varchar,
	"rejection_reason" text,
	"expires_at" timestamp,
	"tax_registration_document_url" varchar,
	"national_insurance_document_url" varchar,
	"withholding_cert_expiry_date" date,
	"withholding_cert_rate" numeric(5, 2),
	"is_compliant" boolean DEFAULT false,
	"risk_level" varchar DEFAULT 'low',
	"last_compliance_check_at" timestamp,
	"next_compliance_check_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_training_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"module_number" integer NOT NULL,
	"title_he" varchar(255) NOT NULL,
	"title_en" varchar(255) NOT NULL,
	"description_he" text,
	"description_en" text,
	"duration_minutes" integer DEFAULT 15,
	"required_for_certification" boolean DEFAULT true,
	"video_url" varchar(500),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_training_modules_module_id_unique" UNIQUE("module_id")
);

CREATE TABLE IF NOT EXISTS "provider_training_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"started" boolean DEFAULT false,
	"started_at" timestamp,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"video_progress" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_training_progress_provider_module" UNIQUE("provider_id","module_id")
);

CREATE TABLE IF NOT EXISTS "provider_training_quiz_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"module_id" varchar(50) NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"attempt_number" integer NOT NULL,
	"answers" jsonb,
	"incorrect_questions" jsonb,
	"submitted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "quote_engine_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_request_id" integer,
	"user_id" varchar(255),
	"provider_id" varchar(255),
	"service_type" varchar(60) NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_payload" jsonb NOT NULL,
	"pricing_version" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quote_engine_logs_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "quote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"provider_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"number_of_nights" integer,
	"number_of_hours" integer,
	"pet_count" integer DEFAULT 1,
	"pet_details" jsonb DEFAULT '[]'::jsonb,
	"requested_addons" text[] DEFAULT '{}',
	"special_requirements" text,
	"base_amount_cents" integer,
	"additional_pets_cents" integer,
	"addons_cents" integer,
	"surcharge_cents" integer,
	"discount_cents" integer,
	"subtotal_cents" integer,
	"platform_fee_cents" integer,
	"tax_cents" integer,
	"total_cents" integer,
	"provider_earnings_cents" integer,
	"status" varchar DEFAULT 'pending',
	"quoted_at" timestamp,
	"expires_at" timestamp,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"provider_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "quote_requests_quote_id_unique" UNIQUE("quote_id")
);

CREATE TABLE IF NOT EXISTS "ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar,
	"given_by_user_id" varchar,
	"score" integer,
	"category" varchar(50),
	"comment" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ratings_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "rebook_triggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"trigger_type" varchar NOT NULL,
	"request_id" varchar,
	"provider_id" varchar,
	"provider_name" varchar,
	"service_type" varchar,
	"service_date" timestamp,
	"scheduled_at" timestamp NOT NULL,
	"fired_at" timestamp,
	"notification_id" varchar,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"rebook_started_at" timestamp,
	"rebook_completed_at" timestamp,
	"suppressed" boolean DEFAULT false NOT NULL,
	"suppression_reason" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recommendation_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_score_id" integer NOT NULL,
	"action_type" varchar(20) NOT NULL,
	"actor_uid" varchar(255) NOT NULL,
	"reason" text,
	"assigned_to" varchar(255),
	"snoozed_until" timestamp with time zone,
	"sla_due_at" timestamp with time zone,
	"sla_met" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recommendation_priority_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_id" integer NOT NULL,
	"priority_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"urgency_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"value_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"confidence_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"bottleneck_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"reasoning_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "recommendation_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_type" varchar(64) NOT NULL,
	"target_entity_type" varchar(64) NOT NULL,
	"target_entity_id" varchar(128) NOT NULL,
	"confidence_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"impact_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"urgency_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"explanation_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "redeemed_qr_tokens" (
	"jti" varchar(64) PRIMARY KEY NOT NULL,
	"voucher_id" varchar NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" varchar(16) NOT NULL,
	"station_id" varchar(100),
	"actor_user_id" varchar(128),
	"external_ref" varchar(200),
	"token_exp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "redemption_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(50) NOT NULL,
	"wallet_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"session_type" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"service_type" varchar,
	"requested_amount_cents" integer NOT NULL,
	"egift_applied_cents" integer DEFAULT 0,
	"wash_packages_applied" integer DEFAULT 0,
	"loyalty_points_applied" integer DEFAULT 0,
	"promo_applied_cents" integer DEFAULT 0,
	"total_credits_applied_cents" integer DEFAULT 0,
	"cash_due_cents" integer DEFAULT 0,
	"payment_method" varchar,
	"payment_status" varchar DEFAULT 'pending',
	"station_id" varchar,
	"terminal_id" varchar,
	"redemption_code" varchar(20),
	"redemption_qr_data" text,
	"code_hmac" varchar(128),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"scanned_at" timestamp,
	"acknowledged_at" timestamp,
	"completed_at" timestamp,
	"booking_id" varchar,
	"device_info" jsonb DEFAULT '{}'::jsonb,
	"location_info" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "redemption_sessions_session_id_unique" UNIQUE("session_id")
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"device_id" varchar,
	"jti" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp
);

CREATE TABLE IF NOT EXISTS "refund_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"refund_request_id" varchar(80) NOT NULL,
	"requested_by_uid" varchar(128) NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by_uid" varchar(128),
	"reviewed_at" timestamp with time zone,
	"linked_dispute_case_ref" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"booking_id" varchar(120),
	"booking_type" varchar(30),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "refund_approvals_refund_request_id_unique" UNIQUE("refund_request_id")
);

CREATE TABLE IF NOT EXISTS "remediation_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"remediation_plan_id" integer NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"before_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"after_value" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit" varchar(30),
	"outcome_status" varchar(20) DEFAULT 'unchanged' NOT NULL,
	"effectiveness_score" numeric(8, 2) DEFAULT '0',
	"effectiveness_reason" text DEFAULT '',
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "remediation_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_type" varchar(64) NOT NULL,
	"target_entity_type" varchar(64) NOT NULL,
	"target_entity_id" varchar(128) NOT NULL,
	"plan_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"status" varchar(24) DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "remediation_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"incident_id" integer NOT NULL,
	"rca_id" integer,
	"anomaly_type" varchar(80),
	"rank" integer DEFAULT 1 NOT NULL,
	"action_type" varchar(60) NOT NULL,
	"action_label" varchar(200) NOT NULL,
	"action_detail" text,
	"action_params" jsonb DEFAULT '{}'::jsonb,
	"rationale" text,
	"confidence" varchar(20) DEFAULT 'medium',
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"applied_by" varchar(100),
	"applied_at" timestamp with time zone,
	"dismissed_by" varchar(100),
	"dismissed_at" timestamp with time zone,
	"audit_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "review_flagging_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" varchar NOT NULL,
	"flag_reason" varchar NOT NULL,
	"severity" varchar DEFAULT 'medium',
	"language" varchar DEFAULT 'en',
	"auto_hide_review" boolean DEFAULT false,
	"require_moderation" boolean DEFAULT true,
	"notify_management" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "review_follow_up_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar(7) NOT NULL,
	"title" varchar(255) NOT NULL,
	"owner_uid" varchar(255) NOT NULL,
	"due_date" varchar(10) NOT NULL,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"notes" text,
	"closed_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"blocked_reason" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reviewer_performance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"reviewer_uid" varchar(255) NOT NULL,
	"period_key" varchar(10) NOT NULL,
	"total_reviewed" integer DEFAULT 0 NOT NULL,
	"avg_approval_hours" numeric(8, 2) DEFAULT '0',
	"reversal_rate" numeric(6, 4) DEFAULT '0',
	"overdue_rate" numeric(6, 4) DEFAULT '0',
	"outcome_quality_score" numeric(6, 2) DEFAULT '0',
	"action_accept_rate" numeric(6, 4) DEFAULT '0',
	"action_success_rate" numeric(6, 4) DEFAULT '0',
	"avg_time_to_resolution_hours" numeric(8, 2) DEFAULT '0',
	"followup_overdue_rate" numeric(6, 4) DEFAULT '0',
	"quality_band" varchar(16) DEFAULT 'unrated',
	"snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reviewer_workload_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"reviewer_uid" varchar(128),
	"current_load" integer,
	"optimal_load" integer,
	"suggested_shift" integer,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar NOT NULL,
	"label" varchar NOT NULL,
	"department_id" integer,
	"description" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "roles_key_unique" UNIQUE("key"),
	CONSTRAINT "roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "rollout_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase" varchar(16) DEFAULT 'internal' NOT NULL,
	"traffic_percentage" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scenario_entity_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" integer NOT NULL,
	"entity_code" varchar(32) NOT NULL,
	"score_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scenario_quality_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"scenario_id" integer NOT NULL,
	"reuse_count" integer DEFAULT 0 NOT NULL,
	"avg_backtest_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"avg_entity_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"quality_rank" varchar(16) DEFAULT 'unranked' NOT NULL,
	"detail_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "self_healing_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"incident_id" integer,
	"anomaly_event_id" integer,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anomaly_type" varchar(80),
	"anomaly_score" integer,
	"action_type" varchar(60) NOT NULL,
	"action_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" varchar(20) DEFAULT 'success' NOT NULL,
	"result_note" text,
	"executed_by" varchar(80) DEFAULT 'self_healing_engine' NOT NULL
);

CREATE TABLE IF NOT EXISTS "self_healing_rule_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"changed_by" varchar(100) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"field_changed" varchar(60) NOT NULL,
	"old_value" varchar(200),
	"new_value" varchar(200) NOT NULL,
	"reason" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "self_healing_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"anomaly_type" varchar(80) DEFAULT 'any' NOT NULL,
	"min_score" integer DEFAULT 60 NOT NULL,
	"consecutive_triggers" integer DEFAULT 1 NOT NULL,
	"cooldown_minutes" integer DEFAULT 10 NOT NULL,
	"action_type" varchar(60) NOT NULL,
	"action_label" varchar(200) NOT NULL,
	"action_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rationale" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"addon_id" varchar NOT NULL,
	"code" varchar NOT NULL,
	"name_en" varchar NOT NULL,
	"name_he" varchar NOT NULL,
	"description_en" text,
	"description_he" text,
	"applicable_platforms" text[] DEFAULT '{}',
	"applicable_service_types" text[] DEFAULT '{}',
	"suggested_price_cents" integer DEFAULT 0,
	"min_price_cents" integer DEFAULT 0,
	"max_price_cents" integer,
	"icon" varchar,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "service_addons_addon_id_unique" UNIQUE("addon_id"),
	CONSTRAINT "service_addons_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_number" varchar NOT NULL,
	"partner_id" integer NOT NULL,
	"period_type" varchar DEFAULT 'monthly',
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"gross_revenue" numeric(12, 2) NOT NULL,
	"partner_share" numeric(12, 2) NOT NULL,
	"petwash_share" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2),
	"status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"payment_reference" varchar,
	"notes" text,
	"audit_hash" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settlements_settlement_number_unique" UNIQUE("settlement_number"),
	CONSTRAINT "settlements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "shadow_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(64),
	"entity_id" varchar(128),
	"action" varchar(128),
	"expected_result" jsonb,
	"actual_result" jsonb,
	"mismatch_flag" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "signing_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"submission_id" varchar,
	"template_slug" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_name" varchar NOT NULL,
	"language" varchar DEFAULT 'he',
	"status" varchar DEFAULT 'pending',
	"signer_email" varchar NOT NULL,
	"signer_name" varchar NOT NULL,
	"signer_phone" varchar,
	"signing_url" varchar,
	"embed_code" text,
	"signed_document_url" varchar,
	"audit_log_url" varchar,
	"certificate_url" varchar,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"signed_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"ip_address" varchar,
	"user_agent" varchar,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "signing_sessions_submission_id_unique" UNIQUE("submission_id")
);

CREATE TABLE IF NOT EXISTS "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"user_avatar" varchar,
	"caption" text,
	"media_urls" text[],
	"media_types" text[],
	"location" varchar,
	"pet_tags" text[],
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"moderation_status" varchar DEFAULT 'approved',
	"moderation_reason" text,
	"moderated_at" timestamp,
	"moderated_by" varchar,
	"content_hash" varchar NOT NULL,
	"audit_hash" varchar,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "social_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"user_avatar" varchar,
	"text" text NOT NULL,
	"parent_comment_id" integer,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"moderation_status" varchar DEFAULT 'approved',
	"moderation_reason" text,
	"moderated_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "social_comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "social_direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"sender_avatar" varchar,
	"recipient_id" varchar NOT NULL,
	"recipient_name" varchar NOT NULL,
	"text" text,
	"media_url" varchar,
	"media_type" varchar,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"moderation_status" varchar DEFAULT 'approved',
	"moderation_reason" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "social_friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" varchar NOT NULL,
	"requester_name" varchar NOT NULL,
	"requester_avatar" varchar,
	"addressee_id" varchar NOT NULL,
	"addressee_name" varchar NOT NULL,
	"addressee_avatar" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "social_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"target_type" varchar NOT NULL,
	"target_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "staff_access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"requested_role" varchar NOT NULL,
	"department_code" varchar,
	"department" varchar,
	"justification" text,
	"manager_name" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approval_scope" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by" varchar,
	"reason" text
);

CREATE TABLE IF NOT EXISTS "staff_background_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"provider" varchar(100) NOT NULL,
	"check_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"report_url" text,
	"report_data" jsonb,
	"submitted_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"expiry_date" date,
	"findings" text,
	"decision" varchar(50),
	"reviewed_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "staff_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"device_model" varchar,
	"os_version" varchar,
	"app_version" varchar,
	"push_token" varchar,
	"last_seen_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "staff_esignatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"document_name" varchar(255) NOT NULL,
	"document_type" varchar(100) NOT NULL,
	"docuseal_submission_id" varchar(255),
	"document_url" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"ip_address" varchar(100),
	"user_agent" text,
	"signature_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "staff_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar NOT NULL,
	"expense_type" varchar(100) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'ILS' NOT NULL,
	"description" text NOT NULL,
	"receipt_url" text,
	"receipt_verification_status" varchar(50) DEFAULT 'pending',
	"receipt_ocr_data" jsonb,
	"gemini_validation" jsonb,
	"fraud_score" numeric(5, 2),
	"fraud_flags" jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"approved_by" varchar,
	"rejection_reason" text,
	"paid_at" timestamp,
	"duplicate_check_hash" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "staff_logbook" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar NOT NULL,
	"log_type" varchar(100) NOT NULL,
	"job_id" varchar,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"duration" integer,
	"start_location" jsonb,
	"end_location" jsonb,
	"gps_verified" boolean DEFAULT false,
	"gps_verification_notes" text,
	"description" text,
	"client_name" varchar(255),
	"pet_names" jsonb,
	"status" varchar(50) DEFAULT 'pending',
	"approved_at" timestamp,
	"approved_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "station_bays" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" varchar NOT NULL,
	"station_code" varchar,
	"side" varchar(5) NOT NULL,
	"bay_label" varchar(50),
	"bay_label_he" varchar(50),
	"nayax_terminal_id" varchar,
	"nayax_qr_reader_id" varchar,
	"status" varchar(20) DEFAULT 'ready' NOT NULL,
	"current_session_id" varchar,
	"last_heartbeat" timestamp,
	"water_temp_c" numeric(5, 2),
	"shampoo_level_pct" integer,
	"conditioner_level_pct" integer,
	"last_fault_code" varchar,
	"last_fault_at" timestamp,
	"total_sessions" integer DEFAULT 0,
	"total_revenue_cents" integer DEFAULT 0,
	"last_session_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "station_downtime" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"reason" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp,
	"reported_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "station_downtime_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "station_downtime_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "station_operators" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'worker' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	CONSTRAINT "station_operators_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "station_operators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "station_profiles" (
	"station_id" integer PRIMARY KEY NOT NULL,
	"trust_score" integer DEFAULT 50 NOT NULL,
	"ranking_score" integer DEFAULT 50 NOT NULL,
	"rating_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"dispute_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 4) DEFAULT '1' NOT NULL,
	"last_computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "station_profiles_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "station_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"station_id" integer NOT NULL,
	"franchise_owner_id" integer,
	"total_amount_cents" integer NOT NULL,
	"platform_fee_pct" numeric(5, 2) NOT NULL,
	"platform_amount_cents" integer NOT NULL,
	"station_revenue_pct" numeric(5, 2) NOT NULL,
	"station_amount_cents" integer NOT NULL,
	"franchise_override_pct" numeric(5, 2),
	"franchise_amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"payout_hold_reason" text,
	"second_release_approval_required" boolean DEFAULT false NOT NULL,
	"payout_release_requested_at" timestamp,
	"payout_release_approved_at" timestamp,
	"payout_release_approved_by" varchar,
	"held_in_reserve" boolean DEFAULT false NOT NULL,
	"reserve_reason" text,
	CONSTRAINT "station_settlements_booking_id_unique" UNIQUE("booking_id"),
	CONSTRAINT "station_settlements_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "station_settlements_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "station_settlements_franchise_owner_id_franchise_owners_id_fk" FOREIGN KEY ("franchise_owner_id") REFERENCES "public"."franchise_owners"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "subcontractor_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subcontractor_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"agreement_version" varchar(50) NOT NULL,
	"signed_at" timestamp NOT NULL,
	"ip_address" varchar(100),
	"user_agent" text,
	"device_info" text,
	"signature_method" varchar(50) NOT NULL,
	"signature_payload" text NOT NULL,
	"agreement_snapshot_json" jsonb NOT NULL,
	"agreed_to_privacy" boolean DEFAULT true NOT NULL,
	"agreed_to_terms" boolean DEFAULT true NOT NULL,
	"audit_trail_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sumit_outbound_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"sumit_document_id" varchar(64),
	"idempotency_key" varchar(80) NOT NULL,
	"request_payload" jsonb,
	"response_status_code" integer,
	"response_body" jsonb,
	"error_message" text,
	"actor" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "super_app_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" varchar NOT NULL,
	"booking_id" varchar,
	"platform_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"content" text NOT NULL,
	"message_type" varchar DEFAULT 'text',
	"attachments" jsonb,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"delivered_at" timestamp,
	"is_system_message" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "super_app_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "super_app_messages_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "super_app_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"platform_id" varchar,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"body" text NOT NULL,
	"body_he" text,
	"channels" text[],
	"push_sent" boolean DEFAULT false,
	"email_sent" boolean DEFAULT false,
	"sms_sent" boolean DEFAULT false,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"action_url" varchar,
	"action_type" varchar,
	"booking_id" varchar,
	"related_id" varchar,
	"metadata" jsonb,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "super_app_notifications_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "super_app_notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "super_app_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"gateway" varchar NOT NULL,
	"gateway_transaction_id" varchar,
	"payment_intent_id" varchar,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"status" varchar DEFAULT 'pending',
	"payment_method" varchar,
	"card_brand" varchar,
	"card_last4" varchar,
	"refund_amount" numeric(12, 2),
	"refund_reason" text,
	"refunded_at" timestamp,
	"metadata" jsonb,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "super_app_payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "super_app_payouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" integer NOT NULL,
	"booking_id" varchar,
	"bank_transfer_reference" varchar,
	"provider_bank_iban" varchar,
	"provider_bank_code" varchar(20),
	"provider_bank_branch_code" varchar(20),
	"provider_bank_account_number" varchar(255),
	"provider_bank_account_holder" varchar(255),
	"destination_source_id" varchar(120),
	"destination_verified_at" timestamp,
	"destination_snapshot_at" timestamp,
	"provider_bank_name" varchar,
	"amount" numeric(12, 2) NOT NULL,
	"platform_fee" numeric(12, 2) NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"status" varchar DEFAULT 'pending',
	"escrow_release_date" timestamp,
	"failure_reason" text,
	"scheduled_for" timestamp,
	"processed_at" timestamp,
	"paid_at" timestamp,
	"ai_verified" boolean,
	"ai_verification_score" integer,
	"ai_verification_id" varchar,
	"ai_verified_at" timestamp,
	"ai_verification_notes" text,
	"ai_risk_level" varchar,
	"idempotency_key" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "super_app_payouts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "super_app_payouts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "super_app_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"platform_id" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"reviewer_type" varchar NOT NULL,
	"reviewee_id" varchar NOT NULL,
	"reviewee_type" varchar NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar,
	"comment" text,
	"comment_he" text,
	"categories" jsonb,
	"photo_urls" text[],
	"video_urls" text[],
	"is_verified_purchase" boolean DEFAULT true,
	"provider_response" text,
	"provider_responded_at" timestamp,
	"is_reported" boolean DEFAULT false,
	"report_reason" text,
	"moderation_status" varchar DEFAULT 'approved',
	"helpful_count" integer DEFAULT 0,
	"not_helpful_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "super_app_reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "super_app_reviews_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "supplier_invoice_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"check_type" varchar(60) NOT NULL,
	"result" varchar(10) NOT NULL,
	"score_impact" integer DEFAULT 0 NOT NULL,
	"details" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supplier_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer,
	"file_url" text,
	"file_hash" varchar(64) NOT NULL,
	"source" varchar(40) DEFAULT 'admin_upload',
	"ocr_invoice_number" varchar(120),
	"ocr_supplier_name" varchar(255),
	"ocr_business_number" varchar(40),
	"ocr_invoice_date" date,
	"ocr_amount_before_vat" numeric(12, 2),
	"ocr_vat_amount" numeric(12, 2),
	"ocr_total_amount" numeric(12, 2),
	"ocr_currency" varchar(8),
	"ocr_raw_text" text,
	"fraud_engine_score" integer,
	"fraud_engine_flags" text[],
	"risk_score" integer DEFAULT 0 NOT NULL,
	"risk_level" varchar(10) DEFAULT 'green' NOT NULL,
	"status" varchar(30) DEFAULT 'uploaded' NOT NULL,
	"uploaded_by" varchar(128),
	"approved_by" varchar(128),
	"approved_at" timestamp with time zone,
	"rejected_by" varchar(128),
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"approval_note" text,
	"shaam_required" boolean DEFAULT false NOT NULL,
	"shaam_allocation_number" varchar(40),
	"sumit_document_id" varchar(64),
	"sumit_status" varchar(20),
	"sumit_sent_at" timestamp with time zone,
	"sumit_confirmed_at" timestamp with time zone,
	"sumit_last_error" text,
	"sumit_idempotency_key" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "system_config_audit_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"checks_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failures_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "system_kill_switches" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tax_rate_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"tax_type" varchar NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"rate_percent" numeric(5, 2) NOT NULL,
	"category" varchar,
	"description" text,
	"description_he" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"regulatory_source" text,
	"regulatory_url" text,
	"is_active" boolean DEFAULT true,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "unified_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"recommendation_score_id" integer,
	"title" varchar(255) NOT NULL,
	"description" text,
	"entity_type" varchar(50),
	"entity_id" varchar(100),
	"source_tab" varchar(50) NOT NULL,
	"visibility_tabs" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar(255),
	"confidence_score" numeric(6, 2) DEFAULT '0',
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "unified_vouchers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"voucher_type" varchar(32) NOT NULL,
	"design_theme" varchar(32) DEFAULT 'pink' NOT NULL,
	"status" varchar(32) DEFAULT 'ISSUED' NOT NULL,
	"currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"value_original" numeric(12, 2),
	"value_remaining" numeric(12, 2),
	"washes_original" integer,
	"washes_remaining" integer,
	"recipient_display_name" varchar(200) NOT NULL,
	"recipient_locale" varchar(8) DEFAULT 'he' NOT NULL,
	"recipient_email" varchar(255),
	"recipient_phone" varchar(30),
	"purchased_by_user_id" varchar,
	"purchased_by_email" varchar(255),
	"owner_user_id" varchar,
	"serial_number" varchar(32) NOT NULL,
	"immutable_hash" text NOT NULL,
	"signed_jws" text NOT NULL,
	"wallet_pass_id" varchar(100),
	"svg_template_key" varchar(64),
	"purchase_order_id" varchar(100),
	"nayax_tx_id" varchar(100),
	"expires_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"fully_redeemed_at" timestamp with time zone,
	"last_redeemed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"personal_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unified_vouchers_serial_number_unique" UNIQUE("serial_number")
);

CREATE TABLE IF NOT EXISTS "unified_voucher_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" varchar NOT NULL,
	"seq_no" integer NOT NULL,
	"prev_entry_hash" text,
	"entry_hash" text NOT NULL,
	"signed_jws" text NOT NULL,
	"event" varchar(32) NOT NULL,
	"delta_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delta_washes" integer DEFAULT 0 NOT NULL,
	"balance_value_after" numeric(12, 2),
	"balance_washes_after" integer,
	"channel" varchar(16) NOT NULL,
	"station_id" varchar(100),
	"location_label" text,
	"external_ref" varchar(200),
	"actor_user_id" varchar(128),
	"actor_role" varchar(32),
	"qr_token_nonce" varchar(64),
	"qr_token_jti" varchar(64),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unified_voucher_ledger_voucher_id_unified_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."unified_vouchers"("id") ON DELETE restrict ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "user_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_uid" varchar NOT NULL,
	"blocked_uid" varchar NOT NULL,
	"reason" varchar,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"consent_version" varchar(50) NOT NULL,
	"consent_text_hash" varchar(128) NOT NULL,
	"accepted" boolean NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"method" varchar(30),
	"ip" varchar(100),
	"user_agent" text,
	"device_id" varchar,
	"locale" varchar(50),
	"source" varchar(20),
	"trace_id" varchar(100),
	"evidence_hash" varchar(128)
);

CREATE TABLE IF NOT EXISTS "user_intelligence_profiles" (
	"user_id" varchar(128) PRIMARY KEY NOT NULL,
	"user_type" varchar(20) DEFAULT 'customer' NOT NULL,
	"trust_score" numeric(5, 2) DEFAULT '50' NOT NULL,
	"behavior_score" numeric(5, 2) DEFAULT '50' NOT NULL,
	"risk_level" numeric(5, 2) DEFAULT '0' NOT NULL,
	"booking_history_count" integer DEFAULT 0 NOT NULL,
	"cancellation_rate" numeric(5, 4) DEFAULT '0' NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"repeat_usage_count" integer DEFAULT 0 NOT NULL,
	"recent_activity_days_ago" integer,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_computed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_pins" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_type" varchar(20) DEFAULT 'customer' NOT NULL,
	"pin_hash" varchar(255) NOT NULL,
	"pin_length" integer DEFAULT 6 NOT NULL,
	"device_id" varchar(255),
	"device_name" varchar(100),
	"device_type" varchar(50),
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"lockout_until" timestamp,
	"last_failed_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"first_name" varchar(100),
	"last_name" varchar(100),
	"registration_type" varchar(30) NOT NULL,
	"registration_method" varchar(30) NOT NULL,
	"platform_source" varchar(50),
	"ip_address" varchar(45),
	"country" varchar(2),
	"city" varchar(100),
	"region" varchar(100),
	"postal_code" varchar(20),
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"timezone" varchar(50),
	"device_id" varchar(255),
	"device_type" varchar(50),
	"device_model" varchar(100),
	"os_name" varchar(50),
	"os_version" varchar(50),
	"browser_name" varchar(50),
	"browser_version" varchar(50),
	"user_agent" text,
	"referral_code" varchar(50),
	"referred_by" varchar(255),
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"utm_content" varchar(100),
	"utm_term" varchar(100),
	"landing_page" text,
	"privacy_consent_at" timestamp,
	"marketing_consent_at" timestamp,
	"terms_accepted_at" timestamp,
	"age_verified_at" timestamp,
	"email_verified" boolean DEFAULT false,
	"phone_verified" boolean DEFAULT false,
	"identity_verified" boolean DEFAULT false,
	"registration_hash" varchar(64),
	"previous_hash" varchar(64),
	"registered_at" timestamp DEFAULT now(),
	"last_login_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role_id" integer NOT NULL,
	"scope_type" varchar,
	"scope_id" varchar,
	"granted_at" timestamp DEFAULT now(),
	"granted_by" varchar,
	CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"make" varchar NOT NULL,
	"model" varchar NOT NULL,
	"year" integer NOT NULL,
	"color" varchar,
	"license_plate" varchar NOT NULL,
	"vin" varchar,
	"type" varchar NOT NULL,
	"capacity" integer,
	"features" text[],
	"size_support" text[],
	"registration_document_url" varchar,
	"insurance_document_url" varchar,
	"inspection_document_url" varchar,
	"verification_status" varchar DEFAULT 'pending',
	"insurance_provider" varchar,
	"insurance_policy_number" varchar,
	"insurance_expiry_date" date,
	"last_inspection_date" date,
	"next_inspection_date" date,
	"total_trips" integer DEFAULT 0,
	"average_rating" numeric(3, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "vehicles_license_plate_unique" UNIQUE("license_plate"),
	CONSTRAINT "vehicles_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(30) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voucher_usage_history_2025" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" varchar NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"station_id" varchar,
	"location_label" text,
	"method" varchar NOT NULL,
	"amount_used" numeric(12, 2),
	"washes_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_usage_history_2025_voucher_id_petwash_vouchers_2025_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."petwash_vouchers_2025"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "voucher_usage_ledger_2025" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" varchar NOT NULL,
	"seq_no" integer NOT NULL,
	"prev_entry_hash" text,
	"delta_value" numeric(12, 2) DEFAULT '0',
	"delta_washes" integer DEFAULT 0,
	"cumulative_value_used" numeric(12, 2) NOT NULL,
	"cumulative_washes_used" integer NOT NULL,
	"station_id" varchar,
	"location_label" text,
	"method" varchar,
	"entry_hash" text NOT NULL,
	"signed_jws" text NOT NULL,
	"entry_type" varchar DEFAULT 'redemption' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_usage_ledger_2025_voucher_id_petwash_vouchers_2025_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."petwash_vouchers_2025"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE IF NOT EXISTS "walk_slot_holds" (
	"id" serial PRIMARY KEY NOT NULL,
	"hold_id" varchar NOT NULL,
	"slot_id" varchar NOT NULL,
	"walker_id" varchar NOT NULL,
	"estimated_amount" numeric(10, 2) DEFAULT '0',
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "walk_slot_holds_hold_id_unique" UNIQUE("hold_id")
);

CREATE TABLE IF NOT EXISTS "wallet_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_id" varchar(50) NOT NULL,
	"user_id" varchar NOT NULL,
	"cash_wallet_balance_cents" integer DEFAULT 0 NOT NULL,
	"egift_balance_cents" integer DEFAULT 0 NOT NULL,
	"wash_package_credits" integer DEFAULT 0 NOT NULL,
	"package_service_units_remaining" integer DEFAULT 0 NOT NULL,
	"loyalty_points_balance" integer DEFAULT 0 NOT NULL,
	"promo_balance_cents" integer DEFAULT 0 NOT NULL,
	"referral_balance_cents" integer DEFAULT 0 NOT NULL,
	"loyalty_tier" varchar(50) DEFAULT 'bronze',
	"tier_points_this_year" integer DEFAULT 0,
	"pending_balance_cents" integer DEFAULT 0 NOT NULL,
	"lifetime_earned_cents" integer DEFAULT 0 NOT NULL,
	"lifetime_redeemed_cents" integer DEFAULT 0 NOT NULL,
	"preferred_currency" varchar(3) DEFAULT 'ILS',
	"auto_apply_credits" boolean DEFAULT true,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wallet_accounts_wallet_id_unique" UNIQUE("wallet_id"),
	CONSTRAINT "wallet_accounts_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "wallet_fraud_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" varchar(80) NOT NULL,
	"actor_type" varchar(30) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"action" varchar(80) NOT NULL,
	"target_wallet_id" varchar(80),
	"target_gift_id" varchar(80),
	"request_id" varchar(80),
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"device_id" varchar(128),
	"risk_score" integer DEFAULT 0,
	"outcome" varchar(20) NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_fraud_log_event_id_unique" UNIQUE("event_id")
);

CREATE TABLE IF NOT EXISTS "wallet_holds" (
	"id" serial PRIMARY KEY NOT NULL,
	"hold_id" varchar(80) NOT NULL,
	"wallet_id" varchar(80) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"hold_type" varchar(30) NOT NULL,
	"service_type" varchar(50),
	"booking_id" varchar(120),
	"provider_id" varchar(128),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"idempotency_key" varchar(128),
	"expires_at" timestamp NOT NULL,
	"captured_at" timestamp,
	"released_at" timestamp,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_holds_hold_id_unique" UNIQUE("hold_id")
);

CREATE TABLE IF NOT EXISTS "wallet_idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"endpoint" varchar(100) NOT NULL,
	"request_hash" varchar(64),
	"response_json" text,
	"status" varchar(20) DEFAULT 'success',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "wallet_idempotency_keys_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "wallet_jti_registry" (
	"jti" varchar(128) PRIMARY KEY NOT NULL,
	"token_type" varchar(50) NOT NULL,
	"wallet_id" varchar(80) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"consumed_at" timestamp,
	"endpoint" varchar(100),
	"status" varchar(20) DEFAULT 'seen' NOT NULL,
	"ip_address" varchar(45)
);

CREATE TABLE IF NOT EXISTS "wallet_ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" varchar(80) NOT NULL,
	"wallet_id" varchar(80) NOT NULL,
	"user_id" varchar(128) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"direction" varchar(10) NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"bucket" varchar(40) NOT NULL,
	"counterparty_type" varchar(50),
	"counterparty_id" varchar(128),
	"division_code" varchar(40),
	"source_type" varchar(40),
	"idempotency_key" varchar(128),
	"jti" varchar(128),
	"session_id" varchar(80),
	"booking_id" varchar(120),
	"kiosk_id" varchar(80),
	"provider_id" varchar(128),
	"created_by" varchar(128) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"previous_hash" varchar(64) NOT NULL,
	"entry_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_ledger_entries_entry_id_unique" UNIQUE("entry_id")
);

CREATE TABLE IF NOT EXISTS "wallet_reconciliation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" varchar(80) NOT NULL,
	"run_type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"verdict" varchar(10),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"drifted" integer DEFAULT 0 NOT NULL,
	"healed" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"triggered_by" varchar(128),
	"summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_reconciliation_runs_run_id_unique" UNIQUE("run_id")
);

CREATE TABLE IF NOT EXISTS "wash_machines" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" varchar(64) NOT NULL,
	"location_id" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"name_he" varchar(128),
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"nayax_terminal_id" varchar(64),
	"nayax_merchant_id" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"is_busy" boolean DEFAULT false NOT NULL,
	"default_program_seconds" integer DEFAULT 900 NOT NULL,
	"price_cents" integer DEFAULT 3500 NOT NULL,
	"currency" varchar(8) DEFAULT 'ILS' NOT NULL,
	"last_heartbeat" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wash_machines_machine_id_unique" UNIQUE("machine_id")
);

CREATE TABLE IF NOT EXISTS "winback_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_booking_at" timestamp,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"converted_at" timestamp,
	"experiment_variant" text,
	"paused_at" timestamp,
	"pause_reason" text,
	"sms_escalation_at" timestamp,
	"sms_sent_at" timestamp,
	"whatsapp_escalation_at" timestamp,
	"whatsapp_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "winback_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

CREATE TABLE "admin_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"resource" varchar,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar,
	"user_agent" varchar,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"role" varchar DEFAULT 'support' NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"description" text,
	"discount_percent" numeric(5, 2),
	"discount_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"lead_id" integer,
	"customer_id" integer,
	"user_id" varchar,
	"opportunity_id" integer,
	"task_id" integer,
	"duration" integer,
	"outcome" varchar,
	"notes" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"performed_by" varchar NOT NULL,
	"activity_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_appointment_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_reference" varchar NOT NULL,
	"customer_id" integer,
	"user_id" varchar,
	"appointment_date" timestamp NOT NULL,
	"appointment_type" varchar NOT NULL,
	"service_details" jsonb DEFAULT '{}'::jsonb,
	"reminder_type" varchar NOT NULL,
	"reminder_timing" varchar NOT NULL,
	"reminder_offset_minutes" integer NOT NULL,
	"email_template_id" integer,
	"sms_template_id" integer,
	"scheduled_send_time" timestamp NOT NULL,
	"is_scheduled" boolean DEFAULT true,
	"status" varchar DEFAULT 'scheduled',
	"email_sent" boolean DEFAULT false,
	"sms_sent" boolean DEFAULT false,
	"email_delivered" boolean DEFAULT false,
	"sms_delivered" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"sms_sent_at" timestamp,
	"email_delivered_at" timestamp,
	"sms_delivered_at" timestamp,
	"last_error" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"is_cancelled" boolean DEFAULT false,
	"cancelled_by" varchar,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_campaign_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"total_targets" integer DEFAULT 0,
	"total_sent" integer DEFAULT 0,
	"total_delivered" integer DEFAULT 0,
	"total_bounced" integer DEFAULT 0,
	"total_unsubscribed" integer DEFAULT 0,
	"total_opened" integer DEFAULT 0,
	"total_clicked" integer DEFAULT 0,
	"unique_opens" integer DEFAULT 0,
	"unique_clicks" integer DEFAULT 0,
	"total_responses" integer DEFAULT 0,
	"total_conversions" integer DEFAULT 0,
	"total_revenue" numeric(10, 2) DEFAULT '0',
	"new_leads" integer DEFAULT 0,
	"new_customers" integer DEFAULT 0,
	"delivery_rate" numeric(5, 2) DEFAULT '0',
	"open_rate" numeric(5, 2) DEFAULT '0',
	"click_rate" numeric(5, 2) DEFAULT '0',
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"response_rate" numeric(5, 2) DEFAULT '0',
	"roi" numeric(10, 2) DEFAULT '0',
	"cost_per_conversion" numeric(10, 2) DEFAULT '0',
	"revenue_per_target" numeric(10, 2) DEFAULT '0',
	"last_calculated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_campaign_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"lead_id" integer,
	"customer_id" integer,
	"user_id" varchar,
	"email" varchar,
	"phone" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"responded" boolean DEFAULT false,
	"converted_to" varchar,
	"conversion_value" numeric(10, 2),
	"delivery_attempts" integer DEFAULT 0,
	"last_error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"campaign_type" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"target_audience" varchar,
	"segment_criteria" jsonb DEFAULT '{}'::jsonb,
	"subject" varchar,
	"content" text,
	"call_to_action" varchar,
	"offer_type" varchar,
	"discount_percent" numeric(5, 2),
	"discount_amount" numeric(10, 2),
	"coupon_code" varchar,
	"budget" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"status" varchar DEFAULT 'draft' NOT NULL,
	"scheduled_start" timestamp,
	"scheduled_end" timestamp,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"goal_type" varchar,
	"goal_value" numeric(10, 2),
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_communication_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"communication_id" integer NOT NULL,
	"email_template_id" integer,
	"sms_template_id" integer,
	"delivery_status" varchar DEFAULT 'pending',
	"delivery_provider" varchar,
	"external_message_id" varchar,
	"opened" boolean DEFAULT false,
	"opened_at" timestamp,
	"open_count" integer DEFAULT 0,
	"clicked" boolean DEFAULT false,
	"clicked_at" timestamp,
	"click_count" integer DEFAULT 0,
	"replied" boolean DEFAULT false,
	"replied_at" timestamp,
	"error_message" text,
	"error_code" varchar,
	"estimated_cost" numeric(10, 4),
	"actual_cost" numeric(10, 4),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_communications" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"customer_id" integer,
	"user_id" varchar,
	"communication_type" varchar NOT NULL,
	"direction" varchar NOT NULL,
	"subject" varchar,
	"content" text,
	"summary" text,
	"outcome" varchar,
	"next_action" varchar,
	"next_action_date" timestamp,
	"duration" integer,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"email_message_id" varchar,
	"phone_number" varchar,
	"created_by" varchar NOT NULL,
	"external_id" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_customer_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"user_id" varchar,
	"total_interactions" integer DEFAULT 0,
	"last_interaction_date" timestamp,
	"preferred_communication_channel" varchar,
	"average_response_time" integer,
	"total_purchases" integer DEFAULT 0,
	"average_order_value" numeric(10, 2) DEFAULT '0',
	"total_lifetime_value" numeric(10, 2) DEFAULT '0',
	"predicted_lifetime_value" numeric(10, 2),
	"last_purchase_date" timestamp,
	"days_since_last_purchase" integer,
	"purchase_frequency" numeric(5, 2),
	"email_open_rate" numeric(5, 2) DEFAULT '0',
	"email_click_rate" numeric(5, 2) DEFAULT '0',
	"campaign_response_rate" numeric(5, 2) DEFAULT '0',
	"churn_risk" varchar DEFAULT 'low',
	"churn_probability" numeric(5, 2) DEFAULT '0',
	"retention_score" integer DEFAULT 50,
	"satisfaction_score" integer,
	"lifecycle_stage" varchar DEFAULT 'new',
	"customer_value" varchar DEFAULT 'medium',
	"preferred_services" text[],
	"interests" text[],
	"demographics" jsonb DEFAULT '{}'::jsonb,
	"lead_score" integer DEFAULT 0,
	"sales_readiness" integer DEFAULT 0,
	"upsell_potential" integer DEFAULT 0,
	"last_calculated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_customer_segment_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"segment_id" integer NOT NULL,
	"customer_id" integer,
	"user_id" varchar,
	"added_at" timestamp DEFAULT now(),
	"removed_at" timestamp,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "crm_customer_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"criteria" jsonb NOT NULL,
	"segment_type" varchar NOT NULL,
	"is_auto_updated" boolean DEFAULT true,
	"last_updated" timestamp DEFAULT now(),
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_deal_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"win_probability" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"subject" varchar NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"times_used" integer DEFAULT 0,
	"last_used" timestamp,
	"description" text,
	"tags" text[],
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"company" varchar,
	"job_title" varchar,
	"lead_source" varchar NOT NULL,
	"source_details" varchar,
	"utm_source" varchar,
	"utm_medium" varchar,
	"utm_campaign" varchar,
	"lead_status" varchar DEFAULT 'new' NOT NULL,
	"lead_score" integer DEFAULT 0,
	"qualification_status" varchar DEFAULT 'unqualified',
	"interested_services" text[],
	"pet_type" varchar,
	"estimated_monthly_value" numeric(10, 2),
	"notes" text,
	"assigned_to" varchar,
	"assigned_at" timestamp,
	"converted_at" timestamp,
	"converted_to_customer_id" integer,
	"converted_to_user_id" varchar,
	"last_contacted_at" timestamp,
	"next_follow_up_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "crm_leads_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"lead_id" integer,
	"customer_id" integer,
	"user_id" varchar,
	"deal_stage_id" integer NOT NULL,
	"estimated_value" numeric(10, 2) NOT NULL,
	"actual_value" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'ILS',
	"win_probability" numeric(5, 2),
	"expected_close_date" date,
	"actual_close_date" date,
	"interested_packages" integer[],
	"service_type" varchar,
	"assigned_to" varchar NOT NULL,
	"team_members" varchar[],
	"status" varchar DEFAULT 'open' NOT NULL,
	"lost_reason" varchar,
	"competitor_name" varchar,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_sms_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"content" text NOT NULL,
	"character_count" integer NOT NULL,
	"estimated_segments" integer DEFAULT 1,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"is_default" boolean DEFAULT false,
	"times_used" integer DEFAULT 0,
	"last_used" timestamp,
	"description" text,
	"tags" text[],
	"is_active" boolean DEFAULT true,
	"created_by" varchar NOT NULL,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"task_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"lead_id" integer,
	"customer_id" integer,
	"user_id" varchar,
	"opportunity_id" integer,
	"assigned_to" varchar NOT NULL,
	"due_date" timestamp,
	"scheduled_start" timestamp,
	"scheduled_end" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"completed_by" varchar,
	"outcome" varchar,
	"notes" text,
	"next_action" varchar,
	"reminder_enabled" boolean DEFAULT true,
	"reminder_time" timestamp,
	"reminder_sent" boolean DEFAULT false,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_touchpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"user_id" varchar,
	"lead_id" integer,
	"touchpoint_type" varchar NOT NULL,
	"channel" varchar NOT NULL,
	"source" varchar,
	"content" text,
	"page_path" varchar,
	"campaign_id" integer,
	"duration" integer,
	"depth" integer,
	"outcome" varchar,
	"session_id" varchar,
	"ip_address" varchar,
	"user_agent" varchar,
	"device" varchar,
	"country" varchar,
	"city" varchar,
	"first_touch" boolean DEFAULT false,
	"last_touch" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"touchpoint_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_pets" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"name" varchar NOT NULL,
	"breed" varchar NOT NULL,
	"age" integer,
	"weight" varchar,
	"special_requirements" text,
	"allergies" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar,
	"password" varchar NOT NULL,
	"date_of_birth" date,
	"country" varchar DEFAULT 'Israel',
	"gender" varchar,
	"pet_type" varchar,
	"profile_picture_url" varchar,
	"loyalty_program" boolean DEFAULT true,
	"reminders" boolean DEFAULT true,
	"marketing" boolean DEFAULT false,
	"terms_accepted" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"loyalty_tier" varchar DEFAULT 'bronze',
	"total_spent" numeric(10, 2) DEFAULT '0',
	"wash_balance" integer DEFAULT 0,
	"last_login" timestamp,
	"auth_provider" varchar DEFAULT 'email',
	"auth_provider_id" varchar,
	"reset_password_token" varchar,
	"reset_password_expires" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "e_voucher_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "e_voucher_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" varchar NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"location_id" text,
	"nayax_session_id" text,
	"kyc_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "e_vouchers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"code_last4" text NOT NULL,
	"type" text NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"initial_amount" numeric(12, 2) NOT NULL,
	"remaining_amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"purchaser_email" text,
	"recipient_email" text,
	"purchaser_uid" text,
	"owner_uid" text,
	"nayax_tx_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "e_vouchers_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "hr_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_name" varchar NOT NULL,
	"employee_type" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"file_path" varchar NOT NULL,
	"file_size" integer,
	"mime_type" varchar,
	"location" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"status" varchar DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar NOT NULL,
	"current_stock" integer DEFAULT 0,
	"min_stock" integer DEFAULT 10,
	"max_stock" integer DEFAULT 100,
	"unit" varchar NOT NULL,
	"cost" numeric(10, 2),
	"supplier" varchar,
	"location" varchar,
	"last_restocked" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_compliance_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" varchar NOT NULL,
	"review_date" timestamp DEFAULT now() NOT NULL,
	"next_review_due" timestamp NOT NULL,
	"review_status" varchar DEFAULT 'pending' NOT NULL,
	"israeli_law_changes" text,
	"action_required" boolean DEFAULT false,
	"action_notes" text,
	"reviewed_by" varchar,
	"reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "legal_document_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_type" varchar NOT NULL,
	"version" varchar NOT NULL,
	"content" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"updated_by" varchar,
	"changes_summary" text,
	"israeli_law_compliant" boolean DEFAULT true,
	"review_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loyalty_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"total_spent" numeric(10, 2) DEFAULT '0',
	"total_washes" integer DEFAULT 0,
	"current_tier" varchar DEFAULT 'bronze',
	"last_activity" timestamp,
	"average_monthly_spend" numeric(10, 2) DEFAULT '0',
	"lifetime_value" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nayax_station_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" varchar NOT NULL,
	"api_key" varchar NOT NULL,
	"description" varchar,
	"is_active" boolean DEFAULT true,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "nayax_station_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "nayax_terminals" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"location" varchar NOT NULL,
	"terminal_id" varchar NOT NULL,
	"merchant_id" varchar,
	"status" varchar DEFAULT 'online' NOT NULL,
	"device_type" varchar NOT NULL,
	"last_heartbeat" timestamp,
	"firmware_version" varchar,
	"api_key" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "nayax_terminals_terminal_id_unique" UNIQUE("terminal_id"),
	CONSTRAINT "nayax_terminals_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "nayax_transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"pending_transaction_id" varchar,
	"terminal_id" varchar,
	"merchant_id" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"status" varchar NOT NULL,
	"payment_method" varchar,
	"card_last_4" varchar,
	"nayax_reference" varchar,
	"voucher_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "nayax_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"transaction_id" varchar,
	"terminal_id" varchar,
	"payload" jsonb NOT NULL,
	"signature" varchar,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "nayax_webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "pending_transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"package_id" integer NOT NULL,
	"customer_email" varchar,
	"customer_name" varchar,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"voucher_code" varchar(16),
	"qr_code_data" text,
	"is_gift_card" boolean DEFAULT false NOT NULL,
	"recipient_email" varchar,
	"personal_message" text,
	"created_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"nayax_transaction_id" varchar,
	"nayax_reference" varchar
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_wash_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar NOT NULL,
	"user_id" varchar,
	"package_id" integer,
	"location_name" varchar DEFAULT 'Pet Wash™ Premium Station' NOT NULL,
	"wash_type" varchar NOT NULL,
	"wash_duration" integer DEFAULT 15,
	"customer_id_masked" varchar NOT NULL,
	"payment_method" varchar NOT NULL,
	"original_amount" numeric(10, 2) NOT NULL,
	"discount_applied" numeric(10, 2) DEFAULT '0',
	"final_total" numeric(10, 2) NOT NULL,
	"loyalty_points_earned" integer DEFAULT 0,
	"current_tier_points" integer DEFAULT 0,
	"next_tier_points" integer DEFAULT 0,
	"current_tier" varchar DEFAULT 'Bronze',
	"next_tier" varchar DEFAULT 'Silver',
	"receipt_qr_code" text NOT NULL,
	"receipt_url" varchar NOT NULL,
	"email_sent" boolean DEFAULT false,
	"wash_date_time" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "smart_wash_receipts_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "tax_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" varchar NOT NULL,
	"transaction_id" varchar,
	"customer_email" varchar NOT NULL,
	"customer_name" varchar,
	"subtotal" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) NOT NULL,
	"processing_fee" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.18',
	"package_name" varchar NOT NULL,
	"package_name_he" varchar NOT NULL,
	"is_gift_card" boolean DEFAULT false,
	"quantity" integer DEFAULT 1,
	"payment_method" varchar DEFAULT 'Nayax',
	"nayax_transaction_id" varchar,
	"nayax_reference" varchar,
	"invoice_generated" boolean DEFAULT false,
	"invoice_sent" boolean DEFAULT false,
	"report_sent" boolean DEFAULT false,
	"tax_reported" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "transaction_records" (
	"id" varchar PRIMARY KEY NOT NULL,
	"invoice_number" varchar,
	"timestamp" timestamp DEFAULT now(),
	"customer_email" varchar NOT NULL,
	"customer_name" varchar,
	"package_id" integer,
	"package_name" varchar NOT NULL,
	"package_name_he" varchar NOT NULL,
	"is_gift_card" boolean DEFAULT false,
	"subtotal" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) NOT NULL,
	"processing_fee" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_method" varchar DEFAULT 'Nayax',
	"nayax_transaction_id" varchar,
	"nayax_reference" varchar,
	"invoice_generated" boolean DEFAULT false,
	"report_sent" boolean DEFAULT false,
	"tax_reported" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"coupon_id" integer NOT NULL,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_interaction_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"session_id" varchar NOT NULL,
	"interaction_type" varchar NOT NULL,
	"element_type" varchar,
	"element_id" varchar,
	"element_path" text,
	"element_text" varchar,
	"page" varchar NOT NULL,
	"input_value" text,
	"keystroke" varchar,
	"click_coordinates" jsonb,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_agent" varchar,
	"ip_address" varchar,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"phone" varchar,
	"date_of_birth" varchar,
	"country" varchar DEFAULT 'IL',
	"gender" varchar,
	"language" varchar DEFAULT 'en',
	"loyalty_tier" varchar DEFAULT 'new',
	"is_club_member" boolean DEFAULT false,
	"is_senior_verified" boolean DEFAULT false,
	"is_disability_verified" boolean DEFAULT false,
	"id_verification_status" varchar DEFAULT 'none',
	"id_document_url" varchar,
	"has_used_new_member_discount" boolean DEFAULT false,
	"current_discount_type" varchar DEFAULT 'none',
	"max_discount_percent" integer DEFAULT 5,
	"total_spent" numeric(10, 2) DEFAULT '0' NOT NULL,
	"wash_balance" integer DEFAULT 0 NOT NULL,
	"gift_card_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wash_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"package_id" integer,
	"wash_count" integer DEFAULT 1,
	"original_price" numeric(10, 2) NOT NULL,
	"discount_applied" numeric(5, 2) DEFAULT '0',
	"final_price" numeric(10, 2) NOT NULL,
	"payment_method" varchar,
	"status" varchar DEFAULT 'completed',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wash_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar NOT NULL,
	"description" text,
	"description_he" text,
	"price" numeric(10, 2) NOT NULL,
	"wash_count" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(2) NOT NULL,
	"name" varchar NOT NULL,
	"name_local" varchar,
	"currency" varchar(3) NOT NULL,
	"currency_symbol" varchar(5),
	"timezone" varchar NOT NULL,
	"language" varchar(2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.17',
	"is_active" boolean DEFAULT true,
	"launch_date" date,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "countries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customer_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"achievement_type" varchar NOT NULL,
	"achievement_name" varchar NOT NULL,
	"achievement_name_he" varchar NOT NULL,
	"description" text,
	"description_he" text,
	"badge_url" varchar,
	"tier" varchar,
	"reward_type" varchar,
	"reward_value" numeric(10, 2),
	"unlocked_at" timestamp DEFAULT now() NOT NULL,
	"is_displayed" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "franchise_territories" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_id" integer NOT NULL,
	"name" varchar NOT NULL,
	"territory_code" varchar NOT NULL,
	"boundary_geojson" jsonb,
	"center_lat" numeric(10, 7),
	"center_lng" numeric(10, 7),
	"population" integer,
	"pet_ownership_rate" numeric(5, 2),
	"estimated_market_size" numeric(12, 2),
	"competition_level" varchar,
	"status" varchar DEFAULT 'planning' NOT NULL,
	"launched_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "franchise_territories_territory_code_unique" UNIQUE("territory_code")
);
--> statement-breakpoint
CREATE TABLE "franchisees" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" varchar NOT NULL,
	"registration_number" varchar,
	"tax_id" varchar,
	"contact_first_name" varchar NOT NULL,
	"contact_last_name" varchar NOT NULL,
	"contact_email" varchar NOT NULL,
	"contact_phone" varchar NOT NULL,
	"address" text NOT NULL,
	"city" varchar NOT NULL,
	"state" varchar,
	"postal_code" varchar NOT NULL,
	"country_id" integer NOT NULL,
	"territory_id" integer,
	"agreement_type" varchar NOT NULL,
	"agreement_start_date" date NOT NULL,
	"agreement_end_date" date,
	"initial_fee" numeric(12, 2),
	"royalty_rate" numeric(5, 2),
	"marketing_fee_rate" numeric(5, 2),
	"minimum_monthly_royalty" numeric(10, 2),
	"total_stations" integer DEFAULT 0,
	"total_revenue" numeric(15, 2) DEFAULT '0',
	"status" varchar DEFAULT 'active' NOT NULL,
	"account_manager_id" varchar,
	"last_audit_date" date,
	"next_audit_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "franchisees_registration_number_unique" UNIQUE("registration_number"),
	CONSTRAINT "franchisees_tax_id_unique" UNIQUE("tax_id"),
	CONSTRAINT "franchisees_contact_email_unique" UNIQUE("contact_email")
);
--> statement-breakpoint
CREATE TABLE "maintenance_work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_order_number" varchar NOT NULL,
	"station_id" integer NOT NULL,
	"work_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"asset_id" integer,
	"requested_date" timestamp DEFAULT now(),
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"estimated_duration" integer,
	"actual_duration" integer,
	"assigned_to_technician_id" varchar,
	"technician_notes" text,
	"parts_used" jsonb,
	"labor_cost" numeric(10, 2) DEFAULT '0',
	"parts_cost" numeric(10, 2) DEFAULT '0',
	"total_cost" numeric(10, 2) DEFAULT '0',
	"status" varchar DEFAULT 'pending' NOT NULL,
	"follow_up_required" boolean DEFAULT false,
	"follow_up_notes" text,
	"follow_up_date" timestamp,
	"before_photos" jsonb,
	"after_photos" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "maintenance_work_orders_work_order_number_unique" UNIQUE("work_order_number")
);
--> statement-breakpoint
CREATE TABLE "pet_wash_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_code" varchar NOT NULL,
	"station_name" varchar NOT NULL,
	"identity_number" varchar NOT NULL,
	"qr_code" varchar NOT NULL,
	"franchisee_id" integer,
	"ownership_type" varchar NOT NULL,
	"territory_id" integer NOT NULL,
	"address" text NOT NULL,
	"city" varchar NOT NULL,
	"state" varchar,
	"postal_code" varchar NOT NULL,
	"country_id" integer NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"location_type" varchar,
	"parking_available" boolean DEFAULT true,
	"wheelchair_accessible" boolean DEFAULT true,
	"outdoor_type" varchar,
	"hardware_version" varchar,
	"firmware_version" varchar,
	"installation_date" date,
	"last_maintenance_date" date,
	"next_maintenance_date" date,
	"warranty_expiry_date" date,
	"operational_status" varchar DEFAULT 'active' NOT NULL,
	"health_status" varchar DEFAULT 'healthy',
	"last_heartbeat" timestamp,
	"daily_capacity" integer DEFAULT 50,
	"average_daily_usage" integer DEFAULT 0,
	"total_washes_completed" integer DEFAULT 0,
	"operating_hours" jsonb,
	"accepts_cash" boolean DEFAULT false,
	"accepts_card" boolean DEFAULT true,
	"accepts_mobile" boolean DEFAULT true,
	"nayax_terminal_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pet_wash_stations_station_code_unique" UNIQUE("station_code"),
	CONSTRAINT "pet_wash_stations_identity_number_unique" UNIQUE("identity_number"),
	CONSTRAINT "pet_wash_stations_qr_code_unique" UNIQUE("qr_code")
);
--> statement-breakpoint
CREATE TABLE "spare_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"part_number" varchar NOT NULL,
	"part_name" varchar NOT NULL,
	"description" text,
	"category" varchar NOT NULL,
	"compatible_assets" jsonb,
	"manufacturer" varchar,
	"supplier" varchar NOT NULL,
	"supplier_part_number" varchar,
	"unit_cost" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS',
	"minimum_order_quantity" integer DEFAULT 1,
	"lead_time_days" integer,
	"quantity_in_stock" integer DEFAULT 0,
	"minimum_stock_level" integer DEFAULT 5,
	"reorder_point" integer DEFAULT 10,
	"maximum_stock_level" integer DEFAULT 50,
	"average_monthly_usage" numeric(8, 2) DEFAULT '0',
	"total_used" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_critical" boolean DEFAULT false,
	"technical_specs_url" varchar,
	"installation_guide_url" varchar,
	"image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "spare_parts_part_number_unique" UNIQUE("part_number")
);
--> statement-breakpoint
CREATE TABLE "station_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"alert_type" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"trigger_value" varchar,
	"threshold_value" varchar,
	"status" varchar DEFAULT 'open' NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar,
	"resolved_at" timestamp,
	"resolved_by" varchar,
	"work_order_id" integer,
	"resolution_notes" text,
	"notifications_sent" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"asset_type" varchar NOT NULL,
	"asset_name" varchar NOT NULL,
	"manufacturer" varchar,
	"model" varchar,
	"serial_number" varchar,
	"purchase_date" date,
	"purchase_price" numeric(10, 2),
	"supplier" varchar,
	"invoice_number" varchar,
	"warranty_months" integer,
	"warranty_expiry_date" date,
	"depreciation_method" varchar,
	"depreciation_years" integer DEFAULT 5,
	"current_value" numeric(10, 2),
	"status" varchar DEFAULT 'active' NOT NULL,
	"installation_date" date,
	"last_inspection_date" date,
	"next_inspection_date" date,
	"total_maintenance_events" integer DEFAULT 0,
	"last_maintenance_date" date,
	"location_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "station_assets_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "station_bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"bill_type" varchar NOT NULL,
	"vendor" varchar NOT NULL,
	"account_number" varchar,
	"billing_period" varchar NOT NULL,
	"due_date" date NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS',
	"vat" numeric(10, 2) DEFAULT '0',
	"total_amount" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'unpaid' NOT NULL,
	"paid_date" date,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"payment_method" varchar,
	"payment_reference" varchar,
	"usage_amount" numeric(12, 3),
	"usage_unit" varchar,
	"unit_price" numeric(10, 4),
	"invoice_url" varchar,
	"receipt_url" varchar,
	"notes" text,
	"auto_pay_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"date" date NOT NULL,
	"total_washes" integer DEFAULT 0,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"average_wash_duration" integer,
	"peak_hour_start" integer,
	"peak_hour_end" integer,
	"unique_customers" integer DEFAULT 0,
	"new_customers" integer DEFAULT 0,
	"returning_customers" integer DEFAULT 0,
	"subscription_usage" integer DEFAULT 0,
	"water_used" numeric(10, 2),
	"soap_used" numeric(8, 2),
	"electricity_used" numeric(10, 2),
	"uptime" integer,
	"downtime" integer,
	"maintenance_time" integer,
	"error_count" integer DEFAULT 0,
	"operating_cost" numeric(10, 2) DEFAULT '0',
	"profit_margin" numeric(5, 2),
	"average_rating" numeric(3, 2),
	"total_ratings" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_spare_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"spare_part_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"minimum_quantity" integer DEFAULT 1,
	"storage_location" varchar,
	"last_restocked_date" date,
	"last_restocked_quantity" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "station_telemetry" (
	"id" serial PRIMARY KEY NOT NULL,
	"station_id" integer NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"water_pressure" numeric(6, 2),
	"water_temperature" numeric(5, 2),
	"water_flow_rate" numeric(7, 2),
	"water_tank_level" integer,
	"soap_level" integer,
	"conditioner_level" integer,
	"sanitizer_level" integer,
	"power_consumption" numeric(8, 2),
	"voltage" numeric(6, 2),
	"current" numeric(6, 2),
	"ambient_temperature" numeric(5, 2),
	"humidity" integer,
	"active_washes" integer DEFAULT 0,
	"washes_completed_today" integer DEFAULT 0,
	"system_load" integer,
	"error_count" integer DEFAULT 0,
	"warning_count" integer DEFAULT 0,
	"signal_strength" integer,
	"network_latency" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar NOT NULL,
	"description" text,
	"description_he" text,
	"price" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'ILS',
	"billing_interval" varchar NOT NULL,
	"trial_days" integer DEFAULT 0,
	"wash_credits_per_month" integer NOT NULL,
	"discount_percent" numeric(5, 2),
	"priority_support" boolean DEFAULT false,
	"early_access_features" boolean DEFAULT false,
	"free_delivery" boolean DEFAULT false,
	"max_pets" integer,
	"max_family_members" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"country_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscription_plans_plan_code_unique" UNIQUE("plan_code")
);
--> statement-breakpoint
CREATE TABLE "subscription_usage_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"usage_date" timestamp DEFAULT now() NOT NULL,
	"station_id" integer,
	"wash_type" varchar,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"original_price" numeric(10, 2),
	"discounted_price" numeric(10, 2),
	"savings_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"status" varchar DEFAULT 'active' NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"cancelled_at" timestamp,
	"cancellation_reason" varchar,
	"wash_credits_remaining" integer DEFAULT 0,
	"wash_credits_used" integer DEFAULT 0,
	"total_washes_completed" integer DEFAULT 0,
	"last_payment_date" timestamp,
	"last_payment_amount" numeric(10, 2),
	"next_payment_date" timestamp,
	"payment_method_id" varchar,
	"total_paid" numeric(12, 2) DEFAULT '0',
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_admin_id_admin_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_task_id_crm_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."crm_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_performed_by_admin_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_appointment_reminders" ADD CONSTRAINT "crm_appointment_reminders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_appointment_reminders" ADD CONSTRAINT "crm_appointment_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_appointment_reminders" ADD CONSTRAINT "crm_appointment_reminders_email_template_id_crm_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."crm_email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_appointment_reminders" ADD CONSTRAINT "crm_appointment_reminders_sms_template_id_crm_sms_templates_id_fk" FOREIGN KEY ("sms_template_id") REFERENCES "public"."crm_sms_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_appointment_reminders" ADD CONSTRAINT "crm_appointment_reminders_cancelled_by_admin_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_appointment_reminders" ADD CONSTRAINT "crm_appointment_reminders_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_metrics" ADD CONSTRAINT "crm_campaign_metrics_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_targets" ADD CONSTRAINT "crm_campaign_targets_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_targets" ADD CONSTRAINT "crm_campaign_targets_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_targets" ADD CONSTRAINT "crm_campaign_targets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaign_targets" ADD CONSTRAINT "crm_campaign_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communication_logs" ADD CONSTRAINT "crm_communication_logs_communication_id_crm_communications_id_fk" FOREIGN KEY ("communication_id") REFERENCES "public"."crm_communications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communication_logs" ADD CONSTRAINT "crm_communication_logs_email_template_id_crm_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."crm_email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communication_logs" ADD CONSTRAINT "crm_communication_logs_sms_template_id_crm_sms_templates_id_fk" FOREIGN KEY ("sms_template_id") REFERENCES "public"."crm_sms_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communications" ADD CONSTRAINT "crm_communications_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communications" ADD CONSTRAINT "crm_communications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communications" ADD CONSTRAINT "crm_communications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_communications" ADD CONSTRAINT "crm_communications_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_insights" ADD CONSTRAINT "crm_customer_insights_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_insights" ADD CONSTRAINT "crm_customer_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_segment_members" ADD CONSTRAINT "crm_customer_segment_members_segment_id_crm_customer_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."crm_customer_segments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_segment_members" ADD CONSTRAINT "crm_customer_segment_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_segment_members" ADD CONSTRAINT "crm_customer_segment_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_customer_segments" ADD CONSTRAINT "crm_customer_segments_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_email_templates" ADD CONSTRAINT "crm_email_templates_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_to_customer_id_customers_id_fk" FOREIGN KEY ("converted_to_customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_converted_to_user_id_users_id_fk" FOREIGN KEY ("converted_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_deal_stage_id_crm_deal_stages_id_fk" FOREIGN KEY ("deal_stage_id") REFERENCES "public"."crm_deal_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_sms_templates" ADD CONSTRAINT "crm_sms_templates_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_completed_by_admin_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_touchpoints" ADD CONSTRAINT "crm_touchpoints_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_touchpoints" ADD CONSTRAINT "crm_touchpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_touchpoints" ADD CONSTRAINT "crm_touchpoints_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_touchpoints" ADD CONSTRAINT "crm_touchpoints_campaign_id_crm_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crm_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD CONSTRAINT "customer_pets_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_voucher_events" ADD CONSTRAINT "e_voucher_events_voucher_id_e_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."e_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "e_voucher_redemptions" ADD CONSTRAINT "e_voucher_redemptions_voucher_id_e_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."e_vouchers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_admin_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_analytics" ADD CONSTRAINT "loyalty_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD CONSTRAINT "nayax_transactions_pending_transaction_id_pending_transactions_id_fk" FOREIGN KEY ("pending_transaction_id") REFERENCES "public"."pending_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_transactions" ADD CONSTRAINT "pending_transactions_package_id_wash_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."wash_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_wash_receipts" ADD CONSTRAINT "smart_wash_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_wash_receipts" ADD CONSTRAINT "smart_wash_receipts_package_id_wash_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."wash_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_transaction_id_pending_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."pending_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_invoice_number_tax_invoices_invoice_number_fk" FOREIGN KEY ("invoice_number") REFERENCES "public"."tax_invoices"("invoice_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_package_id_wash_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."wash_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_coupons" ADD CONSTRAINT "user_coupons_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wash_history" ADD CONSTRAINT "wash_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wash_history" ADD CONSTRAINT "wash_history_package_id_wash_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."wash_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchise_territories" ADD CONSTRAINT "franchise_territories_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchisees" ADD CONSTRAINT "franchisees_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchisees" ADD CONSTRAINT "franchisees_territory_id_franchise_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."franchise_territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_asset_id_station_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."station_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_wash_stations" ADD CONSTRAINT "pet_wash_stations_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_wash_stations" ADD CONSTRAINT "pet_wash_stations_territory_id_franchise_territories_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."franchise_territories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_wash_stations" ADD CONSTRAINT "pet_wash_stations_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_alerts" ADD CONSTRAINT "station_alerts_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_alerts" ADD CONSTRAINT "station_alerts_work_order_id_maintenance_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."maintenance_work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_assets" ADD CONSTRAINT "station_assets_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_bills" ADD CONSTRAINT "station_bills_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_performance_metrics" ADD CONSTRAINT "station_performance_metrics_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_spare_parts" ADD CONSTRAINT "station_spare_parts_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_spare_parts" ADD CONSTRAINT "station_spare_parts_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "station_telemetry" ADD CONSTRAINT "station_telemetry_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_usage_history" ADD CONSTRAINT "subscription_usage_history_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_usage_history" ADD CONSTRAINT "subscription_usage_history_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crm_activities_type" ON "crm_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_lead" ON "crm_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_customer" ON "crm_activities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_opportunity" ON "crm_activities" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_performed_by" ON "crm_activities" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "idx_crm_activities_date" ON "crm_activities" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_customer" ON "crm_appointment_reminders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_user" ON "crm_appointment_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_appointment_date" ON "crm_appointment_reminders" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_scheduled_send" ON "crm_appointment_reminders" USING btree ("scheduled_send_time");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_status" ON "crm_appointment_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_appointment_reminders_booking_ref" ON "crm_appointment_reminders" USING btree ("booking_reference");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_metrics_campaign" ON "crm_campaign_metrics" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_targets_campaign" ON "crm_campaign_targets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_targets_lead" ON "crm_campaign_targets" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_targets_customer" ON "crm_campaign_targets" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_targets_status" ON "crm_campaign_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_campaign_targets_sent" ON "crm_campaign_targets" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_status" ON "crm_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_type" ON "crm_campaigns" USING btree ("campaign_type");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_channel" ON "crm_campaigns" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_start" ON "crm_campaigns" USING btree ("scheduled_start");--> statement-breakpoint
CREATE INDEX "idx_crm_campaigns_created_by" ON "crm_campaigns" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_communication_logs_communication" ON "crm_communication_logs" USING btree ("communication_id");--> statement-breakpoint
CREATE INDEX "idx_communication_logs_delivery_status" ON "crm_communication_logs" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "idx_communication_logs_opened" ON "crm_communication_logs" USING btree ("opened");--> statement-breakpoint
CREATE INDEX "idx_communication_logs_clicked" ON "crm_communication_logs" USING btree ("clicked");--> statement-breakpoint
CREATE INDEX "idx_crm_communications_lead" ON "crm_communications" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_communications_customer" ON "crm_communications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_crm_communications_user" ON "crm_communications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_crm_communications_type" ON "crm_communications" USING btree ("communication_type");--> statement-breakpoint
CREATE INDEX "idx_crm_communications_created_by" ON "crm_communications" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_crm_communications_created_at" ON "crm_communications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_insights_customer" ON "crm_customer_insights" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_insights_user" ON "crm_customer_insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_insights_churn_risk" ON "crm_customer_insights" USING btree ("churn_risk");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_insights_lifecycle" ON "crm_customer_insights" USING btree ("lifecycle_stage");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_insights_value" ON "crm_customer_insights" USING btree ("customer_value");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_insights_ltv" ON "crm_customer_insights" USING btree ("total_lifetime_value");--> statement-breakpoint
CREATE INDEX "idx_crm_segment_members_segment" ON "crm_customer_segment_members" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "idx_crm_segment_members_customer" ON "crm_customer_segment_members" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_crm_segment_members_user" ON "crm_customer_segment_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_crm_segment_members_active" ON "crm_customer_segment_members" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_segments_type" ON "crm_customer_segments" USING btree ("segment_type");--> statement-breakpoint
CREATE INDEX "idx_crm_customer_segments_auto" ON "crm_customer_segments" USING btree ("is_auto_updated");--> statement-breakpoint
CREATE INDEX "idx_crm_deal_stages_sort" ON "crm_deal_stages" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "idx_email_templates_category" ON "crm_email_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_email_templates_active" ON "crm_email_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_email_templates_created_by" ON "crm_email_templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_email" ON "crm_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_status" ON "crm_leads" USING btree ("lead_status");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_assigned_to" ON "crm_leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_source" ON "crm_leads" USING btree ("lead_source");--> statement-breakpoint
CREATE INDEX "idx_crm_leads_next_followup" ON "crm_leads" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_stage" ON "crm_opportunities" USING btree ("deal_stage_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_assigned_to" ON "crm_opportunities" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_status" ON "crm_opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_close_date" ON "crm_opportunities" USING btree ("expected_close_date");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_lead" ON "crm_opportunities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_opportunities_customer" ON "crm_opportunities" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sms_templates_category" ON "crm_sms_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_sms_templates_active" ON "crm_sms_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_sms_templates_created_by" ON "crm_sms_templates" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_assigned_to" ON "crm_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_due_date" ON "crm_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_status" ON "crm_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_priority" ON "crm_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_lead" ON "crm_tasks" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_opportunity" ON "crm_tasks" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "idx_crm_tasks_reminder" ON "crm_tasks" USING btree ("reminder_time");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_customer" ON "crm_touchpoints" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_user" ON "crm_touchpoints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_lead" ON "crm_touchpoints" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_type" ON "crm_touchpoints" USING btree ("touchpoint_type");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_channel" ON "crm_touchpoints" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_date" ON "crm_touchpoints" USING btree ("touchpoint_date");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_campaign" ON "crm_touchpoints" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_crm_touchpoints_session" ON "crm_touchpoints" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_achievements_user" ON "customer_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_achievements_type" ON "customer_achievements" USING btree ("achievement_type");--> statement-breakpoint
CREATE INDEX "idx_territories_country" ON "franchise_territories" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_territories_status" ON "franchise_territories" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_franchisees_country" ON "franchisees" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_franchisees_territory" ON "franchisees" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "idx_franchisees_status" ON "franchisees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_work_orders_station" ON "maintenance_work_orders" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_work_orders_status" ON "maintenance_work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_work_orders_priority" ON "maintenance_work_orders" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_work_orders_technician" ON "maintenance_work_orders" USING btree ("assigned_to_technician_id");--> statement-breakpoint
CREATE INDEX "idx_work_orders_scheduled" ON "maintenance_work_orders" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_stations_code" ON "pet_wash_stations" USING btree ("station_code");--> statement-breakpoint
CREATE INDEX "idx_stations_franchisee" ON "pet_wash_stations" USING btree ("franchisee_id");--> statement-breakpoint
CREATE INDEX "idx_stations_territory" ON "pet_wash_stations" USING btree ("territory_id");--> statement-breakpoint
CREATE INDEX "idx_stations_country" ON "pet_wash_stations" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_stations_status" ON "pet_wash_stations" USING btree ("operational_status");--> statement-breakpoint
CREATE INDEX "idx_stations_health" ON "pet_wash_stations" USING btree ("health_status");--> statement-breakpoint
CREATE INDEX "idx_spare_parts_category" ON "spare_parts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_spare_parts_stock" ON "spare_parts" USING btree ("quantity_in_stock");--> statement-breakpoint
CREATE INDEX "idx_station_alerts_station" ON "station_alerts" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_station_alerts_severity" ON "station_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_station_alerts_status" ON "station_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_station_alerts_triggered" ON "station_alerts" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_station_assets_station" ON "station_assets" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_station_assets_type" ON "station_assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_station_assets_status" ON "station_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_station_bills_station" ON "station_bills" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_station_bills_type" ON "station_bills" USING btree ("bill_type");--> statement-breakpoint
CREATE INDEX "idx_station_bills_due_date" ON "station_bills" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_station_bills_status" ON "station_bills" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_station_metrics_station" ON "station_performance_metrics" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_station_metrics_date" ON "station_performance_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_station_parts_station" ON "station_spare_parts" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_station_parts_part" ON "station_spare_parts" USING btree ("spare_part_id");--> statement-breakpoint
CREATE INDEX "idx_telemetry_station" ON "station_telemetry" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_telemetry_recorded_at" ON "station_telemetry" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_active" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_subscription_plans_country" ON "subscription_plans" USING btree ("country_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_usage_subscription" ON "subscription_usage_history" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_usage_date" ON "subscription_usage_history" USING btree ("usage_date");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_user" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_status" ON "user_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_plan" ON "user_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "idx_user_subscriptions_next_payment" ON "user_subscriptions" USING btree ("next_payment_date");
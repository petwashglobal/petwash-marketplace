CREATE TABLE "approved_countries" (
	"id" serial PRIMARY KEY NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"country_name" varchar NOT NULL,
	"country_name_he" varchar,
	"accepts_national_id" boolean DEFAULT true,
	"accepts_drivers_license" boolean DEFAULT true,
	"accepts_passport" boolean DEFAULT true,
	"requires_biometric_match" boolean DEFAULT true,
	"requires_manual_review" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "approved_countries_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE "audit_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"previous_hash" text,
	"current_hash" text NOT NULL,
	"block_number" integer NOT NULL,
	"event_type" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar,
	"user_agent" text,
	"device_id" varchar,
	"fraud_score" integer DEFAULT 0,
	"fraud_signals" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT true,
	"verified_at" timestamp,
	CONSTRAINT "audit_ledger_current_hash_unique" UNIQUE("current_hash"),
	CONSTRAINT "audit_ledger_block_number_unique" UNIQUE("block_number")
);
--> statement-breakpoint
CREATE TABLE "biometric_certificate_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"document_type" varchar NOT NULL,
	"document_country" varchar NOT NULL,
	"document_number" varchar,
	"document_front_url" varchar NOT NULL,
	"document_back_url" varchar,
	"selfie_photo_url" varchar NOT NULL,
	"ocr_text_extracted" text,
	"ocr_confidence" numeric(5, 2),
	"detected_fields" jsonb,
	"biometric_match_status" varchar DEFAULT 'pending',
	"biometric_match_score" numeric(5, 2),
	"face_detection_data" jsonb,
	"verification_status" varchar DEFAULT 'pending',
	"verification_method" varchar DEFAULT 'automatic',
	"verified_at" timestamp,
	"verified_by" varchar,
	"rejection_reason" text,
	"is_disability_verified" boolean DEFAULT false,
	"is_retirement_verified" boolean DEFAULT false,
	"is_club_member_verified" boolean DEFAULT false,
	"ip_address" varchar,
	"user_agent" text,
	"device_fingerprint" varchar,
	"document_expiry_date" date,
	"is_expired" boolean DEFAULT false,
	"expiry_check_date" timestamp,
	"audit_log" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "biometric_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"verification_id" integer,
	"consent_document_processing" boolean DEFAULT false,
	"consent_biometric_processing" boolean DEFAULT false,
	"document_consent_timestamp" timestamp,
	"biometric_consent_timestamp" timestamp,
	"consent_version" varchar DEFAULT '1.0',
	"ip_address" varchar,
	"user_agent" text,
	"device_fingerprint" varchar,
	"is_revoked" boolean DEFAULT false,
	"revoked_at" timestamp,
	"revocation_reason" text,
	"audit_hash" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_consents" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"owner_consented" boolean DEFAULT false,
	"owner_consented_at" timestamp,
	"owner_accepted_terms" boolean DEFAULT false,
	"owner_signature" text,
	"sitter_consented" boolean DEFAULT false,
	"sitter_consented_at" timestamp,
	"sitter_accepted_house_rules" boolean DEFAULT false,
	"sitter_signature" text,
	"both_parties_agreed" boolean DEFAULT false,
	"agreement_completed_at" timestamp,
	"owner_instructions" text,
	"owner_medical_instructions" text,
	"sitter_notes" text,
	"sitter_acceptance_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_extensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"requested_by" varchar NOT NULL,
	"original_end_date" timestamp NOT NULL,
	"new_end_date" timestamp NOT NULL,
	"additional_days" integer NOT NULL,
	"original_total_cents" integer NOT NULL,
	"extension_base_cents" integer NOT NULL,
	"extension_platform_fee_cents" integer NOT NULL,
	"extension_broker_cut_cents" integer NOT NULL,
	"new_total_cents" integer NOT NULL,
	"status" varchar DEFAULT 'pending',
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_payment_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_uid" varchar NOT NULL,
	"nayax_token" text NOT NULL,
	"last_four_digits" varchar(4),
	"card_type" varchar,
	"card_brand" varchar,
	"expiry_month" varchar(2),
	"expiry_year" varchar(4),
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "customer_payment_tokens_nayax_token_unique" UNIQUE("nayax_token"),
	CONSTRAINT "customer_payment_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "discount_usage_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"discount_code" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"usage_token" text NOT NULL,
	"audit_ledger_id" integer,
	"discount_amount" numeric(10, 2) NOT NULL,
	"original_price" numeric(10, 2) NOT NULL,
	"final_price" numeric(10, 2) NOT NULL,
	"station_id" varchar,
	"usage_hash" text NOT NULL,
	"verified" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_usage_log_usage_token_unique" UNIQUE("usage_token"),
	CONSTRAINT "discount_usage_log_usage_hash_unique" UNIQUE("usage_hash")
);
--> statement-breakpoint
CREATE TABLE "electronic_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" varchar NOT NULL,
	"service_type" varchar NOT NULL,
	"transaction_id" varchar,
	"invoice_number" varchar NOT NULL,
	"invoice_date" timestamp DEFAULT now(),
	"invoice_type" varchar NOT NULL,
	"customer_tax_id" varchar,
	"customer_name" varchar NOT NULL,
	"customer_email" varchar,
	"customer_phone" varchar,
	"customer_address" text,
	"amount_before_vat" numeric(12, 2) NOT NULL,
	"vat_amount" numeric(12, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.17',
	"currency" varchar DEFAULT 'ILS',
	"line_items" jsonb NOT NULL,
	"payment_method" varchar,
	"payment_status" varchar DEFAULT 'paid',
	"ita_submission_status" varchar DEFAULT 'pending',
	"ita_reference_number" varchar,
	"ita_submitted_at" timestamp,
	"ita_response" jsonb,
	"ita_error_message" text,
	"requires_electronic_invoicing" boolean DEFAULT false,
	"compliance_status" varchar DEFAULT 'compliant',
	"compliance_notes" text,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "electronic_invoices_invoice_id_unique" UNIQUE("invoice_id"),
	CONSTRAINT "electronic_invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "loyalty_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"target_group" varchar NOT NULL,
	"custom_condition" text,
	"message_en" text NOT NULL,
	"message_he" text NOT NULL,
	"special_discount_percent" integer,
	"is_active" boolean DEFAULT true,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "merkle_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"start_block_number" integer NOT NULL,
	"end_block_number" integer NOT NULL,
	"merkle_root" text NOT NULL,
	"record_count" integer NOT NULL,
	"verified" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "merkle_snapshots_snapshot_date_unique" UNIQUE("snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "nayax_qr_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"qr_code" varchar NOT NULL,
	"qr_type" varchar NOT NULL,
	"voucher_id" varchar,
	"loyalty_token_id" varchar,
	"customer_uid" varchar NOT NULL,
	"station_id" varchar NOT NULL,
	"terminal_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"discount_amount" numeric(10, 2),
	"discount_percent" integer,
	"nayax_transaction_id" varchar,
	"redemption_hash" text NOT NULL,
	"audit_ledger_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "nayax_qr_redemptions_redemption_hash_unique" UNIQUE("redemption_hash")
);
--> statement-breakpoint
CREATE TABLE "nayax_telemetry" (
	"id" serial PRIMARY KEY NOT NULL,
	"terminal_id" varchar NOT NULL,
	"station_id" varchar NOT NULL,
	"state" varchar NOT NULL,
	"water_temp" numeric(5, 2),
	"water_pressure" numeric(5, 2),
	"shampoo_level" integer,
	"conditioner_level" integer,
	"is_online" boolean DEFAULT true,
	"last_ping_at" timestamp NOT NULL,
	"error_code" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_avatars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"pet_name" varchar NOT NULL,
	"photo_url" text NOT NULL,
	"thumbnail_url" text,
	"landmark_config" jsonb,
	"animation_profile" jsonb DEFAULT '{"style":"playful","intensity":"medium","blinkRate":3}',
	"tts_voice" varchar DEFAULT 'en-US-Neural2-A',
	"character_type" varchar DEFAULT 'pet',
	"outfit_id" varchar,
	"accessories" jsonb DEFAULT '[]',
	"customization" jsonb DEFAULT '{"colors":{},"patterns":{},"layering":[]}',
	"status" varchar DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_profiles_for_sitting" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"breed" varchar NOT NULL,
	"age" integer,
	"weight" varchar,
	"photo_url" varchar,
	"special_needs" text,
	"allergies" jsonb,
	"medications" text,
	"vet_contact_name" varchar,
	"vet_contact_phone" varchar,
	"emergency_contact_name" varchar,
	"emergency_contact_phone" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pettrek_dispatch_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"dispatched_at" timestamp DEFAULT now(),
	"notification_sent" boolean DEFAULT false,
	"notification_method" varchar,
	"response_status" varchar DEFAULT 'pending',
	"responded_at" timestamp,
	"decline_reason" varchar,
	"decline_notes" text,
	"expires_at" timestamp,
	"is_expired" boolean DEFAULT false,
	"distance_from_pickup" numeric(10, 2),
	"estimated_arrival_time" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pettrek_gps_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(10, 2),
	"altitude" numeric(10, 2),
	"heading" numeric(5, 2),
	"speed" numeric(5, 2),
	"recorded_at" timestamp DEFAULT now(),
	"distance_to_destination" numeric(10, 2),
	"estimated_arrival" integer,
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pettrek_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"email" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"selfie_photo_url" varchar,
	"government_id_url" varchar,
	"biometric_match_score" numeric(5, 2),
	"biometric_status" varchar DEFAULT 'pending',
	"biometric_verified_at" timestamp,
	"vehicle_type" varchar NOT NULL,
	"vehicle_make" varchar,
	"vehicle_model" varchar,
	"vehicle_year" integer,
	"vehicle_color" varchar,
	"license_plate" varchar NOT NULL,
	"vehicle_capacity" varchar NOT NULL,
	"has_carrier" boolean DEFAULT false,
	"has_seatbelt" boolean DEFAULT false,
	"drivers_license_url" varchar,
	"insurance_cert_url" varchar,
	"vehicle_registration_url" varchar,
	"pet_first_aid_cert" boolean DEFAULT false,
	"certification_urls" text[],
	"offers_transport" boolean DEFAULT true,
	"offers_sitting" boolean DEFAULT false,
	"offers_walking" boolean DEFAULT false,
	"is_online" boolean DEFAULT false,
	"is_available" boolean DEFAULT true,
	"is_vetted" boolean DEFAULT false,
	"vetted_at" timestamp,
	"vetted_by" varchar,
	"last_known_latitude" numeric(10, 7),
	"last_known_longitude" numeric(10, 7),
	"last_location_update" timestamp,
	"service_radius" integer DEFAULT 10,
	"total_trips" integer DEFAULT 0,
	"completed_trips" integer DEFAULT 0,
	"canceled_trips" integer DEFAULT 0,
	"average_rating" numeric(3, 2),
	"total_earnings" numeric(10, 2) DEFAULT '0',
	"bank_account_number" varchar,
	"bank_name" varchar,
	"bank_branch" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pettrek_providers_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "pettrek_trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" varchar NOT NULL,
	"customer_id" varchar NOT NULL,
	"provider_id" integer,
	"pet_name" varchar NOT NULL,
	"pet_type" varchar NOT NULL,
	"pet_size" varchar NOT NULL,
	"pet_weight" numeric(5, 2),
	"special_instructions" text,
	"service_type" varchar NOT NULL,
	"pickup_latitude" numeric(10, 7) NOT NULL,
	"pickup_longitude" numeric(10, 7) NOT NULL,
	"pickup_address" text NOT NULL,
	"dropoff_latitude" numeric(10, 7) NOT NULL,
	"dropoff_longitude" numeric(10, 7) NOT NULL,
	"dropoff_address" text NOT NULL,
	"scheduled_pickup_time" timestamp NOT NULL,
	"scheduled_dropoff_time" timestamp,
	"actual_pickup_time" timestamp,
	"actual_dropoff_time" timestamp,
	"status" varchar DEFAULT 'requested' NOT NULL,
	"canceled_by" varchar,
	"cancel_reason" text,
	"estimated_fare" numeric(10, 2),
	"final_fare" numeric(10, 2),
	"base_fare" numeric(10, 2),
	"distance_fare" numeric(10, 2),
	"time_fare" numeric(10, 2),
	"surge_fare" numeric(10, 2),
	"platform_commission" numeric(10, 2),
	"driver_payout" numeric(10, 2),
	"payment_status" varchar DEFAULT 'pending',
	"nayax_transaction_id" varchar,
	"estimated_distance" numeric(10, 2),
	"estimated_duration" integer,
	"actual_distance" numeric(10, 2),
	"actual_duration" integer,
	"is_peak_time" boolean DEFAULT false,
	"surge_multiplier" numeric(3, 2) DEFAULT '1.0',
	"is_live_tracking_active" boolean DEFAULT false,
	"last_known_latitude" numeric(10, 7),
	"last_known_longitude" numeric(10, 7),
	"last_gps_update" timestamp,
	"photo_uploaded_at_pickup" boolean DEFAULT false,
	"photo_uploaded_at_dropoff" boolean DEFAULT false,
	"pickup_photo_url" varchar,
	"dropoff_photo_url" varchar,
	"customer_rating" integer,
	"customer_review" text,
	"driver_rating" integer,
	"driver_review" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pettrek_trips_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "provider_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"invite_code" varchar,
	"city" varchar NOT NULL,
	"country" varchar DEFAULT 'IL' NOT NULL,
	"selfie_photo_url" varchar,
	"government_id_url" varchar,
	"biometric_match_score" numeric(5, 2),
	"biometric_status" varchar DEFAULT 'pending',
	"biometric_verified_at" timestamp,
	"biometric_failure_reason" text,
	"background_check_status" varchar DEFAULT 'pending',
	"background_check_date" timestamp,
	"background_check_notes" text,
	"insurance_cert_url" varchar,
	"business_license_url" varchar,
	"certification_urls" text[],
	"status" varchar DEFAULT 'pending',
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"internal_notes" text,
	"approved_as_provider_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_applications_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "provider_invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_code" varchar NOT NULL,
	"provider_type" varchar NOT NULL,
	"created_by_admin_id" varchar NOT NULL,
	"max_uses" integer DEFAULT 1,
	"current_uses" integer DEFAULT 0,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"campaign_name" varchar,
	"referral_bonus" numeric(10, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_invite_codes_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "sitter_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"sitter_id" integer NOT NULL,
	"pet_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_days" integer NOT NULL,
	"base_price_cents" integer NOT NULL,
	"platform_service_fee_cents" integer NOT NULL,
	"broker_cut_cents" integer NOT NULL,
	"sitter_payout_cents" integer NOT NULL,
	"total_charge_cents" integer NOT NULL,
	"nayax_transaction_id" varchar,
	"nayax_split_payment_id" varchar,
	"payment_status" varchar DEFAULT 'pending',
	"payout_status" varchar DEFAULT 'pending',
	"escrow_held_at" timestamp,
	"escrow_release_eligible_at" timestamp,
	"payout_released_at" timestamp,
	"status" varchar DEFAULT 'pending',
	"urgency_score" integer DEFAULT 1,
	"ai_triage_notes" text,
	"cancellation_reason" text,
	"special_instructions" text,
	"created_at" timestamp DEFAULT now(),
	"confirmed_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sitter_bookings_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "sitter_complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" varchar NOT NULL,
	"reported_by" varchar NOT NULL,
	"reporter_type" varchar NOT NULL,
	"reported_user" varchar NOT NULL,
	"reported_user_type" varchar NOT NULL,
	"booking_id" integer,
	"category" varchar NOT NULL,
	"severity" varchar NOT NULL,
	"description" text NOT NULL,
	"evidence_urls" text[],
	"status" varchar DEFAULT 'pending',
	"assigned_to" varchar,
	"admin_notes" text,
	"action_taken" text,
	"resolved_at" timestamp,
	"is_silent" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sitter_complaints_complaint_id_unique" UNIQUE("complaint_id")
);
--> statement-breakpoint
CREATE TABLE "sitter_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" varchar NOT NULL,
	"booking_id" integer,
	"sender_id" varchar NOT NULL,
	"sender_type" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"receiver_type" varchar NOT NULL,
	"message_text" text NOT NULL,
	"attachment_urls" text[],
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"is_deleted" boolean DEFAULT false,
	"deleted_by" varchar,
	"is_flagged" boolean DEFAULT false,
	"flagged_reason" varchar,
	"moderated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sitter_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "sitter_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"date_of_birth" date NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"street_address" varchar NOT NULL,
	"apartment" varchar,
	"city" varchar NOT NULL,
	"state_province" varchar NOT NULL,
	"postal_code" varchar NOT NULL,
	"country" varchar DEFAULT 'Israel' NOT NULL,
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"profile_picture_url" varchar,
	"bio" text,
	"years_of_experience" integer NOT NULL,
	"detailed_experience" text,
	"specializations" text[],
	"languages_spoken" text[],
	"personal_allergies" text,
	"smoking_status" varchar,
	"has_other_pets" boolean DEFAULT false,
	"other_pets_details" text,
	"home_type" varchar,
	"yard_size" varchar,
	"home_photos" text[],
	"price_per_day_cents" integer NOT NULL,
	"service_types" text[],
	"availability_calendar" jsonb,
	"recurring_availability" jsonb,
	"house_policies" jsonb,
	"property_amenities" jsonb,
	"entry_instructions" jsonb,
	"house_manual" jsonb,
	"emergency_contact_name" varchar,
	"emergency_contact_phone" varchar,
	"emergency_contact_relationship" varchar,
	"verification_status" varchar DEFAULT 'pending_id',
	"verification_document_url" varchar,
	"background_check_status" varchar,
	"background_check_completed_at" timestamp,
	"training_completed_at" timestamp,
	"activated_at" timestamp,
	"selfie_photo_url" varchar NOT NULL,
	"id_photo_url" varchar NOT NULL,
	"biometric_match_status" varchar DEFAULT 'pending',
	"biometric_match_score" numeric(5, 2),
	"biometric_verified_at" timestamp,
	"biometric_rejection_reason" text,
	"terms_accepted_at" timestamp,
	"privacy_policy_accepted_at" timestamp,
	"insurance_cert_url" varchar,
	"is_active" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"rating" numeric(3, 2) DEFAULT '0.00',
	"total_bookings" integer DEFAULT 0,
	"total_earnings_cents" integer DEFAULT 0,
	"response_time_minutes" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sitter_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"sitter_id" integer NOT NULL,
	"owner_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"is_verified_stay" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_device_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"audit_ledger_id" integer,
	"event_type" varchar NOT NULL,
	"action" varchar NOT NULL,
	"ip_address" varchar,
	"location" jsonb,
	"fraud_score" integer DEFAULT 0,
	"fraud_signals" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"device_label" varchar,
	"device_fingerprint" text NOT NULL,
	"platform" varchar NOT NULL,
	"browser" varchar,
	"os_version" varchar,
	"browser_version" varchar,
	"webauthn_credential_id" text,
	"ip_address" varchar,
	"ip_location" jsonb,
	"wifi_ssid_encrypted" text,
	"wifi_bssid_hash" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ip_change_at" timestamp with time zone,
	"last_geo_change_at" timestamp with time zone,
	"session_count" integer DEFAULT 1 NOT NULL,
	"trust_score" integer DEFAULT 50 NOT NULL,
	"fraud_flags" jsonb DEFAULT '[]'::jsonb,
	"is_current_device" boolean DEFAULT false,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_devices_device_fingerprint_unique" UNIQUE("device_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "voucher_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"redemption_code" text NOT NULL,
	"audit_ledger_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"station_id" varchar,
	"franchise_id" varchar,
	"redemption_hash" text NOT NULL,
	"verified" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "voucher_redemptions_voucher_id_unique" UNIQUE("voucher_id"),
	CONSTRAINT "voucher_redemptions_redemption_code_unique" UNIQUE("redemption_code"),
	CONSTRAINT "voucher_redemptions_redemption_hash_unique" UNIQUE("redemption_hash")
);
--> statement-breakpoint
CREATE TABLE "walk_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"alert_id" varchar NOT NULL,
	"booking_id" varchar NOT NULL,
	"alert_type" varchar NOT NULL,
	"severity" varchar DEFAULT 'info',
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"action_required" boolean DEFAULT false,
	"sent_to_owner" boolean DEFAULT false,
	"sent_to_walker" boolean DEFAULT false,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"action_taken" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "walk_alerts_alert_id_unique" UNIQUE("alert_id")
);
--> statement-breakpoint
CREATE TABLE "walk_blockchain_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"block_hash" varchar NOT NULL,
	"previous_block_hash" varchar,
	"walk_start_timestamp" timestamp NOT NULL,
	"walk_end_timestamp" timestamp NOT NULL,
	"total_duration_seconds" integer NOT NULL,
	"total_distance_meters" integer NOT NULL,
	"gps_data_points_count" integer NOT NULL,
	"geofence_violations" integer DEFAULT 0,
	"geofence_compliance_percent" numeric(5, 2),
	"amount_paid_by_owner" numeric(10, 2) NOT NULL,
	"amount_paid_to_walker" numeric(10, 2) NOT NULL,
	"platform_commission" numeric(10, 2) NOT NULL,
	"walker_signature" varchar,
	"owner_signature" varchar,
	"merkle_root" varchar,
	"verification_status" varchar DEFAULT 'verified',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "walk_blockchain_audit_block_hash_unique" UNIQUE("block_hash")
);
--> statement-breakpoint
CREATE TABLE "walk_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"walker_id" varchar NOT NULL,
	"pet_id" varchar,
	"scheduled_date" date NOT NULL,
	"scheduled_start_time" varchar NOT NULL,
	"duration_minutes" integer NOT NULL,
	"pickup_latitude" numeric(10, 7) NOT NULL,
	"pickup_longitude" numeric(10, 7) NOT NULL,
	"pickup_address" text NOT NULL,
	"geofence_radius_meters" integer DEFAULT 500,
	"geofence_center_lat" numeric(10, 7),
	"geofence_center_lon" numeric(10, 7),
	"pet_name" varchar,
	"pet_breed" varchar,
	"pet_weight" varchar,
	"pet_special_needs" text,
	"pet_medications" text,
	"pet_behavior_notes" text,
	"walker_rate" numeric(10, 2) NOT NULL,
	"platform_fee_owner" numeric(10, 2) NOT NULL,
	"platform_fee_sitter" numeric(10, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"walker_payout" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"status" varchar DEFAULT 'pending',
	"confirmation_code" varchar,
	"actual_start_time" timestamp,
	"actual_end_time" timestamp,
	"actual_duration_minutes" integer,
	"check_in_location" jsonb,
	"check_out_location" jsonb,
	"last_known_location" jsonb,
	"route_polyline" text,
	"total_distance_meters" integer,
	"last_gps_update" timestamp,
	"vital_data_summary" jsonb,
	"is_live_tracking_active" boolean DEFAULT false,
	"is_video_stream_active" boolean DEFAULT false,
	"is_drone_monitoring_active" boolean DEFAULT false,
	"geofence_violation_count" integer DEFAULT 0,
	"emergency_stop_triggered" boolean DEFAULT false,
	"emergency_stop_reason" text,
	"walk_completed_successfully" boolean,
	"completion_notes" text,
	"owner_notified" boolean DEFAULT false,
	"cancelled_by" varchar,
	"cancellation_reason" text,
	"cancelled_at" timestamp,
	"refund_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "walk_bookings_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "walk_gps_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(5, 2),
	"altitude" numeric(7, 2),
	"heading" numeric(5, 2),
	"speed" numeric(5, 2),
	"is_inside_geofence" boolean DEFAULT true,
	"distance_from_center_meters" numeric(7, 2),
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"device_type" varchar,
	"battery_level" integer
);
--> statement-breakpoint
CREATE TABLE "walk_health_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" varchar NOT NULL,
	"average_heart_rate" integer,
	"max_heart_rate" integer,
	"calories_burned" integer,
	"distance_km" numeric(5, 2),
	"average_pace_min_per_km" numeric(5, 2),
	"walking_minutes" integer,
	"running_minutes" integer,
	"resting_minutes" integer,
	"stress_level" varchar,
	"fatigue_level" varchar,
	"interaction_count" integer,
	"excessive_pulling_detected" boolean DEFAULT false,
	"excessive_barking_detected" boolean DEFAULT false,
	"weather_condition" varchar,
	"temperature_celsius" numeric(4, 1),
	"humidity_percent" integer,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "walk_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" varchar NOT NULL,
	"booking_id" varchar NOT NULL,
	"video_type" varchar NOT NULL,
	"video_url" varchar NOT NULL,
	"thumbnail_url" varchar,
	"duration_seconds" integer,
	"file_size_mb" numeric(7, 2),
	"recorded_at" timestamp NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"ai_tags" text[],
	"ai_confidence" numeric(5, 2),
	"is_public" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "walk_videos_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
CREATE TABLE "walker_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"walker_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"display_name" varchar,
	"profile_photo_url" varchar,
	"bio" text,
	"city" varchar NOT NULL,
	"country" varchar DEFAULT 'IL' NOT NULL,
	"current_latitude" numeric(10, 7),
	"current_longitude" numeric(10, 7),
	"service_radius_km" integer DEFAULT 5,
	"verification_status" varchar DEFAULT 'pending',
	"kyc_completed" boolean DEFAULT false,
	"background_check_status" varchar DEFAULT 'pending',
	"background_check_date" timestamp,
	"selfie_photo_url" varchar,
	"government_id_url" varchar,
	"biometric_match_score" numeric(5, 2),
	"biometric_verified_at" timestamp,
	"years_of_experience" integer,
	"specializations" text[],
	"certifications" text[],
	"average_rating" numeric(3, 2) DEFAULT '0',
	"total_walks" integer DEFAULT 0,
	"total_reviews" integer DEFAULT 0,
	"response_time_minutes" integer,
	"acceptance_rate" numeric(5, 2) DEFAULT '0',
	"has_body_camera" boolean DEFAULT false,
	"has_drone_access" boolean DEFAULT false,
	"has_first_aid_kit" boolean DEFAULT false,
	"has_car_transport" boolean DEFAULT false,
	"base_hourly_rate" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'ILS',
	"is_available" boolean DEFAULT true,
	"max_daily_walks" integer DEFAULT 5,
	"bank_account_verified" boolean DEFAULT false,
	"stripe_account_id" varchar,
	"commission_rate" numeric(5, 2) DEFAULT '18.00',
	"is_active" boolean DEFAULT true,
	"suspension_reason" text,
	"suspended_until" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "walker_profiles_walker_id_unique" UNIQUE("walker_id")
);
--> statement-breakpoint
CREATE TABLE "walker_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" varchar NOT NULL,
	"booking_id" varchar NOT NULL,
	"walker_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"overall_rating" integer NOT NULL,
	"punctuality_rating" integer,
	"communication_rating" integer,
	"pet_care_rating" integer,
	"safety_rating" integer,
	"review_text" text,
	"review_photos" text[],
	"highlights" text[],
	"walker_response" text,
	"walker_responded_at" timestamp,
	"is_verified_walk" boolean DEFAULT true,
	"is_flagged" boolean DEFAULT false,
	"flagged_reason" varchar,
	"moderated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "walker_reviews_review_id_unique" UNIQUE("review_id")
);
--> statement-breakpoint
CREATE TABLE "walker_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"walker_id" varchar NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" varchar NOT NULL,
	"end_time" varchar NOT NULL,
	"is_available" boolean DEFAULT true,
	"specific_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "nayax_transactions" ALTER COLUMN "status" SET DEFAULT 'initiated';--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "wash_frequency" varchar DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "last_wash_date" timestamp;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "next_wash_due" timestamp;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "next_vaccination_date" timestamp;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "vaccination_notes" text;--> statement-breakpoint
ALTER TABLE "customer_pets" ADD COLUMN "reminder_enabled" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "external_transaction_id" varchar;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "nayax_transaction_id" varchar;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "wash_type" varchar;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "product_code" varchar;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "station_id" varchar;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "customer_uid" varchar;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "customer_token" text;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "authorized_at" timestamp;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "vend_attempted_at" timestamp;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "vend_success_at" timestamp;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "settled_at" timestamp;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "voided_at" timestamp;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "failed_at" timestamp;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "decline_reason" text;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "vend_error_message" text;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD COLUMN "last_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "selfie_photo_url" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "id_photo_url" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "biometric_match_status" varchar DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "biometric_match_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "biometric_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "biometric_verified_by" varchar;--> statement-breakpoint
ALTER TABLE "booking_consents" ADD CONSTRAINT "booking_consents_booking_id_sitter_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."sitter_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_extensions" ADD CONSTRAINT "booking_extensions_booking_id_sitter_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."sitter_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage_log" ADD CONSTRAINT "discount_usage_log_audit_ledger_id_audit_ledger_id_fk" FOREIGN KEY ("audit_ledger_id") REFERENCES "public"."audit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nayax_qr_redemptions" ADD CONSTRAINT "nayax_qr_redemptions_nayax_transaction_id_nayax_transactions_id_fk" FOREIGN KEY ("nayax_transaction_id") REFERENCES "public"."nayax_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nayax_qr_redemptions" ADD CONSTRAINT "nayax_qr_redemptions_audit_ledger_id_audit_ledger_id_fk" FOREIGN KEY ("audit_ledger_id") REFERENCES "public"."audit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_avatars" ADD CONSTRAINT "pet_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pettrek_dispatch_records" ADD CONSTRAINT "pettrek_dispatch_records_trip_id_pettrek_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."pettrek_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pettrek_dispatch_records" ADD CONSTRAINT "pettrek_dispatch_records_provider_id_pettrek_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."pettrek_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pettrek_gps_tracking" ADD CONSTRAINT "pettrek_gps_tracking_trip_id_pettrek_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."pettrek_trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pettrek_trips" ADD CONSTRAINT "pettrek_trips_provider_id_pettrek_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."pettrek_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_invite_code_provider_invite_codes_invite_code_fk" FOREIGN KEY ("invite_code") REFERENCES "public"."provider_invite_codes"("invite_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_bookings" ADD CONSTRAINT "sitter_bookings_sitter_id_sitter_profiles_id_fk" FOREIGN KEY ("sitter_id") REFERENCES "public"."sitter_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_bookings" ADD CONSTRAINT "sitter_bookings_pet_id_pet_profiles_for_sitting_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pet_profiles_for_sitting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_complaints" ADD CONSTRAINT "sitter_complaints_booking_id_sitter_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."sitter_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_complaints" ADD CONSTRAINT "sitter_complaints_assigned_to_admin_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_messages" ADD CONSTRAINT "sitter_messages_booking_id_sitter_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."sitter_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_messages" ADD CONSTRAINT "sitter_messages_moderated_by_admin_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."admin_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_reviews" ADD CONSTRAINT "sitter_reviews_booking_id_sitter_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."sitter_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sitter_reviews" ADD CONSTRAINT "sitter_reviews_sitter_id_sitter_profiles_id_fk" FOREIGN KEY ("sitter_id") REFERENCES "public"."sitter_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device_events" ADD CONSTRAINT "user_device_events_device_id_user_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device_events" ADD CONSTRAINT "user_device_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_device_events" ADD CONSTRAINT "user_device_events_audit_ledger_id_audit_ledger_id_fk" FOREIGN KEY ("audit_ledger_id") REFERENCES "public"."audit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voucher_redemptions" ADD CONSTRAINT "voucher_redemptions_audit_ledger_id_audit_ledger_id_fk" FOREIGN KEY ("audit_ledger_id") REFERENCES "public"."audit_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_alerts" ADD CONSTRAINT "walk_alerts_booking_id_walk_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."walk_bookings"("booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_blockchain_audit" ADD CONSTRAINT "walk_blockchain_audit_booking_id_walk_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."walk_bookings"("booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_bookings" ADD CONSTRAINT "walk_bookings_walker_id_walker_profiles_walker_id_fk" FOREIGN KEY ("walker_id") REFERENCES "public"."walker_profiles"("walker_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_gps_tracking" ADD CONSTRAINT "walk_gps_tracking_booking_id_walk_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."walk_bookings"("booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_health_data" ADD CONSTRAINT "walk_health_data_booking_id_walk_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."walk_bookings"("booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walk_videos" ADD CONSTRAINT "walk_videos_booking_id_walk_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."walk_bookings"("booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walker_reviews" ADD CONSTRAINT "walker_reviews_booking_id_walk_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."walk_bookings"("booking_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walker_reviews" ADD CONSTRAINT "walker_reviews_walker_id_walker_profiles_walker_id_fk" FOREIGN KEY ("walker_id") REFERENCES "public"."walker_profiles"("walker_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walker_schedule" ADD CONSTRAINT "walker_schedule_walker_id_walker_profiles_walker_id_fk" FOREIGN KEY ("walker_id") REFERENCES "public"."walker_profiles"("walker_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_user" ON "audit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_ledger" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_event" ON "audit_ledger" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_block" ON "audit_ledger" USING btree ("block_number");--> statement-breakpoint
CREATE INDEX "idx_biometric_cert_user" ON "biometric_certificate_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_biometric_cert_status" ON "biometric_certificate_verifications" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "idx_biometric_cert_type" ON "biometric_certificate_verifications" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_payment_token_customer" ON "customer_payment_tokens" USING btree ("customer_uid");--> statement-breakpoint
CREATE INDEX "idx_payment_token_hash" ON "customer_payment_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_discount_usage_unique" ON "discount_usage_log" USING btree ("discount_code","user_id");--> statement-breakpoint
CREATE INDEX "idx_discount_usage_token" ON "discount_usage_log" USING btree ("usage_token");--> statement-breakpoint
CREATE INDEX "idx_merkle_date" ON "merkle_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_qr_redemption_code" ON "nayax_qr_redemptions" USING btree ("qr_code");--> statement-breakpoint
CREATE INDEX "idx_qr_redemption_customer" ON "nayax_qr_redemptions" USING btree ("customer_uid");--> statement-breakpoint
CREATE INDEX "idx_qr_redemption_station" ON "nayax_qr_redemptions" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_qr_redemption_hash" ON "nayax_qr_redemptions" USING btree ("redemption_hash");--> statement-breakpoint
CREATE INDEX "idx_nayax_telemetry_terminal" ON "nayax_telemetry" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "idx_nayax_telemetry_station" ON "nayax_telemetry" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_nayax_telemetry_state" ON "nayax_telemetry" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_nayax_telemetry_ping" ON "nayax_telemetry" USING btree ("last_ping_at");--> statement-breakpoint
CREATE INDEX "idx_pet_avatar_user" ON "pet_avatars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pet_avatar_status" ON "pet_avatars" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pettrek_dispatch_unique" ON "pettrek_dispatch_records" USING btree ("trip_id","provider_id");--> statement-breakpoint
CREATE INDEX "idx_pettrek_dispatch_provider" ON "pettrek_dispatch_records" USING btree ("provider_id","response_status");--> statement-breakpoint
CREATE INDEX "idx_pettrek_gps_trip" ON "pettrek_gps_tracking" USING btree ("trip_id","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_pettrek_providers_transport_lookup" ON "pettrek_providers" USING btree ("is_online","offers_transport","is_available","is_vetted");--> statement-breakpoint
CREATE INDEX "idx_pettrek_trips_customer_status" ON "pettrek_trips" USING btree ("customer_id","status");--> statement-breakpoint
CREATE INDEX "idx_device_events_device" ON "user_device_events" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_events_user" ON "user_device_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_device_events_type" ON "user_device_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_device_events_created" ON "user_device_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_device_events_audit" ON "user_device_events" USING btree ("audit_ledger_id");--> statement-breakpoint
CREATE INDEX "idx_user_devices_user" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_devices_revoked" ON "user_devices" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "idx_user_devices_last_seen" ON "user_devices" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_user_devices_fingerprint" ON "user_devices" USING btree ("device_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_user_devices_trust_score" ON "user_devices" USING btree ("trust_score");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemption_user" ON "voucher_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_voucher_redemption_code" ON "voucher_redemptions" USING btree ("redemption_code");--> statement-breakpoint
CREATE INDEX "idx_nayax_tx_status" ON "nayax_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_nayax_tx_customer" ON "nayax_transactions" USING btree ("customer_uid");--> statement-breakpoint
CREATE INDEX "idx_nayax_tx_station" ON "nayax_transactions" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_nayax_tx_terminal" ON "nayax_transactions" USING btree ("terminal_id");--> statement-breakpoint
CREATE INDEX "idx_nayax_tx_created" ON "nayax_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_nayax_tx_nayax_id" ON "nayax_transactions" USING btree ("nayax_transaction_id");--> statement-breakpoint
ALTER TABLE "nayax_transactions" ADD CONSTRAINT "nayax_transactions_external_transaction_id_unique" UNIQUE("external_transaction_id");
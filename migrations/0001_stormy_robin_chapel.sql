CREATE TABLE "ai_product_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" integer,
	"shipment_id" integer,
	"pet_profile" jsonb NOT NULL,
	"recommended_products" jsonb NOT NULL,
	"ai_reasoning" text,
	"ai_model" varchar DEFAULT 'gemini-2.5-flash',
	"accepted" boolean,
	"feedback" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"box_type_id" integer NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"frequency" varchar DEFAULT 'monthly' NOT NULL,
	"start_date" timestamp DEFAULT now() NOT NULL,
	"next_shipment_date" timestamp,
	"last_shipment_date" timestamp,
	"cancelled_at" timestamp,
	"paused_at" timestamp,
	"pause_reason" text,
	"cancel_reason" text,
	"pet_profile" jsonb,
	"delivery_address" jsonb,
	"total_shipments" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_box_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar NOT NULL,
	"description" text,
	"description_he" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"item_count" integer NOT NULL,
	"estimated_value" numeric(10, 2),
	"features" jsonb,
	"features_he" jsonb,
	"is_active" boolean DEFAULT true,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"name_he" varchar NOT NULL,
	"description" text,
	"description_he" text,
	"category" varchar NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"image_url" varchar,
	"brand" varchar,
	"pet_type" varchar,
	"age_group" varchar,
	"size_group" varchar,
	"tags" jsonb,
	"is_active" boolean DEFAULT true,
	"stock_quantity" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"box_type_id" integer NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"shipment_date" timestamp,
	"delivery_date" timestamp,
	"tracking_number" varchar,
	"products" jsonb NOT NULL,
	"total_value" numeric(10, 2),
	"ai_generated" boolean DEFAULT false,
	"customer_rating" integer,
	"customer_feedback" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"user_name" varchar,
	"access_type" varchar NOT NULL,
	"access_granted" boolean NOT NULL,
	"denial_reason" varchar,
	"ip_address" varchar,
	"user_agent" varchar,
	"accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_code" varchar NOT NULL,
	"category_name" varchar NOT NULL,
	"category_name_he" varchar,
	"department" varchar NOT NULL,
	"required_access_level" integer DEFAULT 5,
	"is_confidential" boolean DEFAULT false,
	"storage_path" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "document_categories_category_code_unique" UNIQUE("category_code")
);
--> statement-breakpoint
CREATE TABLE "franchise_order_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar NOT NULL,
	"franchisee_id" integer NOT NULL,
	"station_id" integer,
	"requested_by" varchar NOT NULL,
	"requested_by_email" varchar NOT NULL,
	"requested_by_phone" varchar,
	"order_type" varchar NOT NULL,
	"priority" varchar DEFAULT 'normal' NOT NULL,
	"requested_items" jsonb NOT NULL,
	"estimated_total" numeric(12, 2),
	"actual_total" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'ILS',
	"delivery_address" text,
	"delivery_city" varchar,
	"delivery_postal_code" varchar,
	"requested_delivery_date" date,
	"actual_delivery_date" date,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"tracking_number" varchar,
	"shipping_carrier" varchar,
	"estimated_arrival" timestamp,
	"payment_status" varchar DEFAULT 'pending',
	"invoice_number" varchar,
	"invoice_url" varchar,
	"payment_due_date" date,
	"paid_date" date,
	"request_notes" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "franchise_order_requests_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "secure_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_number" varchar NOT NULL,
	"category_id" integer NOT NULL,
	"document_type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"title_he" varchar,
	"description" text,
	"file_name" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_size" integer,
	"file_mime_type" varchar,
	"gcs_url" varchar NOT NULL,
	"backup_gcs_url" varchar,
	"local_path" varchar,
	"franchisee_id" integer,
	"station_id" integer,
	"supplier_id" varchar,
	"invoice_number" varchar,
	"invoice_date" date,
	"invoice_amount" numeric(12, 2),
	"invoice_currency" varchar(3),
	"payment_status" varchar,
	"tags" jsonb,
	"related_document_ids" jsonb,
	"is_confidential" boolean DEFAULT false,
	"access_level" integer DEFAULT 5,
	"allowed_roles" jsonb,
	"allowed_user_ids" jsonb,
	"uploaded_by" varchar NOT NULL,
	"uploaded_by_email" varchar NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"version" integer DEFAULT 1,
	"previous_version_id" integer,
	"status" varchar DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "secure_documents_document_number_unique" UNIQUE("document_number")
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_number" varchar NOT NULL,
	"spare_part_id" integer NOT NULL,
	"transaction_type" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"from_location" varchar,
	"to_location" varchar,
	"from_station_id" integer,
	"to_station_id" integer,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(12, 2),
	"currency" varchar(3) DEFAULT 'ILS',
	"order_request_id" integer,
	"work_order_id" integer,
	"performed_by" varchar NOT NULL,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "stock_transactions_transaction_number_unique" UNIQUE("transaction_number")
);
--> statement-breakpoint
CREATE TABLE "supplier_notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_type" varchar NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"recipient_name" varchar NOT NULL,
	"recipient_role" varchar NOT NULL,
	"recipient_email" varchar,
	"recipient_phone" varchar,
	"recipient_whatsapp" varchar,
	"notify_email" boolean DEFAULT true,
	"notify_sms" boolean DEFAULT false,
	"notify_whatsapp" boolean DEFAULT true,
	"stock_threshold_percent" integer,
	"critical_threshold_percent" integer,
	"max_alerts_per_day" integer DEFAULT 10,
	"last_notified_at" timestamp,
	"notification_count" integer DEFAULT 0,
	"monitored_part_ids" jsonb,
	"monitored_categories" jsonb,
	"notify_between_hours" jsonb,
	"notify_on_weekends" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_code" varchar NOT NULL,
	"role_name" varchar NOT NULL,
	"role_name_he" varchar,
	"department" varchar NOT NULL,
	"access_level" integer NOT NULL,
	"permissions" jsonb NOT NULL,
	"can_access_all_stations" boolean DEFAULT false,
	"can_access_financials" boolean DEFAULT false,
	"can_access_legal" boolean DEFAULT false,
	"can_access_k9000_supplier" boolean DEFAULT false,
	"can_manage_franchises" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_roles_role_code_unique" UNIQUE("role_code")
);
--> statement-breakpoint
CREATE TABLE "user_role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"role_id" integer NOT NULL,
	"franchisee_id" integer,
	"station_ids" jsonb,
	"is_active" boolean DEFAULT true,
	"assigned_by" varchar NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_product_recommendations" ADD CONSTRAINT "ai_product_recommendations_subscription_id_customer_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_product_recommendations" ADD CONSTRAINT "ai_product_recommendations_shipment_id_subscription_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."subscription_shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_box_type_id_subscription_box_types_id_fk" FOREIGN KEY ("box_type_id") REFERENCES "public"."subscription_box_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_shipments" ADD CONSTRAINT "subscription_shipments_subscription_id_customer_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_shipments" ADD CONSTRAINT "subscription_shipments_box_type_id_subscription_box_types_id_fk" FOREIGN KEY ("box_type_id") REFERENCES "public"."subscription_box_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_log" ADD CONSTRAINT "document_access_log_document_id_secure_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."secure_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchise_order_requests" ADD CONSTRAINT "franchise_order_requests_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchise_order_requests" ADD CONSTRAINT "franchise_order_requests_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_documents" ADD CONSTRAINT "secure_documents_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_documents" ADD CONSTRAINT "secure_documents_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_documents" ADD CONSTRAINT "secure_documents_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_spare_part_id_spare_parts_id_fk" FOREIGN KEY ("spare_part_id") REFERENCES "public"."spare_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_from_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_to_station_id_pet_wash_stations_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."pet_wash_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_order_request_id_franchise_order_requests_id_fk" FOREIGN KEY ("order_request_id") REFERENCES "public"."franchise_order_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_work_order_id_maintenance_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."maintenance_work_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_system_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."system_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_franchisee_id_franchisees_id_fk" FOREIGN KEY ("franchisee_id") REFERENCES "public"."franchisees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_access_log_document" ON "document_access_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_user" ON "document_access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_access_log_date" ON "document_access_log" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "idx_order_requests_franchisee" ON "franchise_order_requests" USING btree ("franchisee_id");--> statement-breakpoint
CREATE INDEX "idx_order_requests_station" ON "franchise_order_requests" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_order_requests_status" ON "franchise_order_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_order_requests_priority" ON "franchise_order_requests" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_documents_category" ON "secure_documents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_documents_type" ON "secure_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_documents_franchisee" ON "secure_documents" USING btree ("franchisee_id");--> statement-breakpoint
CREATE INDEX "idx_documents_station" ON "secure_documents" USING btree ("station_id");--> statement-breakpoint
CREATE INDEX "idx_documents_status" ON "secure_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_documents_uploaded" ON "secure_documents" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_part" ON "stock_transactions" USING btree ("spare_part_id");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_type" ON "stock_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_from_station" ON "stock_transactions" USING btree ("from_station_id");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_to_station" ON "stock_transactions" USING btree ("to_station_id");--> statement-breakpoint
CREATE INDEX "idx_stock_tx_date" ON "stock_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notif_settings_type" ON "supplier_notification_settings" USING btree ("notification_type");--> statement-breakpoint
CREATE INDEX "idx_notif_settings_enabled" ON "supplier_notification_settings" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_user_roles_user" ON "user_role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_roles_email" ON "user_role_assignments" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_user_roles_role" ON "user_role_assignments" USING btree ("role_id");
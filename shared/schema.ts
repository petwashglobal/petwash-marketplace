import {
  pgTable,
  pgEnum,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
  decimal,
  boolean,
  serial,
  date,
  real,
  unique
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"), // For mobile app email/password authentication
  roles: jsonb("roles").default(sql`'[]'::jsonb`), // ["admin","dispatcher","contractor","driver"]
  permissions: jsonb("permissions").default(sql`'[]'::jsonb`), // Additional permissions array
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  dateOfBirth: varchar("date_of_birth"),
  country: varchar("country").default("IL"),
  gender: varchar("gender"),
  language: varchar("language").default("en"),
  loyaltyTier: varchar("loyalty_tier").default("bronze"), // 7-tier luxury system: bronze(5%), silver(10%), gold(15%), platinum(20%), diamond(30%), emerald(40%), royal(50%)
  isClubMember: boolean("is_club_member").default(false),
  isSeniorVerified: boolean("is_senior_verified").default(false), // תעודת גימלאים verified
  isDisabilityVerified: boolean("is_disability_verified").default(false), // תעודת נכה verified
  idVerificationStatus: varchar("id_verification_status").default("none"), // none, pending, approved, rejected
  idDocumentUrl: varchar("id_document_url"), // תעודת זהות upload
  
  // BIOMETRIC KYC (Banking-Level Security)
  selfiePhotoUrl: varchar("selfie_photo_url"), // Current selfie with clear face
  idPhotoUrl: varchar("id_photo_url"), // Government ID photo (passport, driver's license, national ID)
  biometricMatchStatus: varchar("biometric_match_status").default("pending"), // pending | matched | failed | not_required
  biometricMatchScore: decimal("biometric_match_score", { precision: 5, scale: 2 }), // 0-100 confidence score from Google Vision
  biometricVerifiedAt: timestamp("biometric_verified_at"), // When verification passed
  biometricVerifiedBy: varchar("biometric_verified_by"), // Admin who approved (if manual review)
  
  hasUsedNewMemberDiscount: boolean("has_used_new_member_discount").default(false),
  currentDiscountType: varchar("current_discount_type").default("none"), // none, general_member, verified_senior, verified_disability
  maxDiscountPercent: integer("max_discount_percent").default(5), // 5% general, 10% verified only
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0").notNull(),
  washBalance: integer("wash_balance").default(0).notNull(),
  giftCardBalance: decimal("gift_card_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  loyaltyPoints: integer("loyalty_points").default(0).notNull(), // Points earned from purchases (1 point per ILS spent)
  
  // PRIVACY CONTROLS (OPT-IN by default = false)
  analyticsConsent: boolean("analytics_consent").default(false), // GA4 tracking
  ipTrackingConsent: boolean("ip_tracking_consent").default(false), // IP geolocation
  emailTrackingConsent: boolean("email_tracking_consent").default(false), // SendGrid tracking pixels
  marketingConsent: boolean("marketing_consent").default(false), // Marketing emails/SMS
  privacyConsentUpdatedAt: timestamp("privacy_consent_updated_at"), // Last consent change
  
  // COMMUNICATION PREFERENCES (Granular channel control)
  communicationPreferences: jsonb("communication_preferences").default(sql`'{
    "email": {"marketing": false, "transactional": true, "reminders": true},
    "sms": {"marketing": false, "transactional": true, "reminders": true},
    "whatsapp": {"marketing": false, "transactional": true, "reminders": true},
    "push": {"marketing": false, "transactional": true, "reminders": true}
  }'::jsonb`),
  suppressionList: jsonb("suppression_list").default(sql`'{"email": false, "sms": false, "whatsapp": false, "push": false, "all": false}'::jsonb`), // Master suppression flags
  unsubscribedAt: timestamp("unsubscribed_at"), // When user unsubscribed from all marketing
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Domain Events (Event Store for Event-Driven Architecture)
export const domainEvents = pgTable("domain_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").unique().notNull(), // UUID
  eventType: varchar("event_type").notNull(), // "station.created", "wash.completed", etc.
  aggregateType: varchar("aggregate_type"), // "station", "transaction", "booking"
  aggregateId: varchar("aggregate_id"),
  payload: jsonb("payload").notNull(),
  metadata: jsonb("metadata"), // IP, user agent, user ID
  version: integer("version").default(1),
  occurredAt: timestamp("occurred_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  isPublished: boolean("is_published").default(false),
}, (table) => [
  index("idx_domain_events_type").on(table.eventType),
  index("idx_domain_events_aggregate").on(table.aggregateType, table.aggregateId),
  index("idx_domain_events_occurred_at").on(table.occurredAt),
]);

// Notification Templates (Multi-Channel Template Management)
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(), // "incident_reported", "inventory_low", "settlement_generated"
  name: varchar("name").notNull(),
  description: text("description"),
  channels: jsonb("channels").notNull(), // ["email", "sms", "whatsapp", "push", "in_app"]
  emailSubject: varchar("email_subject"),
  emailBody: text("email_body"), // HTML template with {{variables}}
  smsBody: text("sms_body"), // Plain text with {{variables}}
  whatsappBody: text("whatsapp_body"),
  pushTitle: varchar("push_title"),
  pushBody: text("push_body"),
  inAppTitle: varchar("in_app_title"),
  inAppBody: text("in_app_body"),
  defaultRecipients: jsonb("default_recipients"), // ["role:health_safety_manager", "department:operations"]
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_notification_templates_key").on(table.key),
  index("idx_notification_templates_active").on(table.isActive),
]);

// Notification Logs (Delivery Tracking)
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  templateKey: varchar("template_key").notNull(),
  channel: varchar("channel").notNull(), // "email", "sms", "whatsapp", "push", "in_app"
  recipientUserId: varchar("recipient_user_id"),
  recipientEmail: varchar("recipient_email"),
  recipientPhone: varchar("recipient_phone"),
  status: varchar("status").default("pending"), // "pending", "sent", "delivered", "failed", "bounced"
  payload: jsonb("payload"), // Variables used in template
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_notification_logs_template").on(table.templateKey),
  index("idx_notification_logs_user").on(table.recipientUserId),
  index("idx_notification_logs_status").on(table.status),
  index("idx_notification_logs_channel").on(table.channel),
  index("idx_notification_logs_created").on(table.createdAt),
]);

// Customer table (for custom authentication system)
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  password: varchar("password").notNull(), // hashed password
  dateOfBirth: date("date_of_birth"),
  country: varchar("country").default("Israel"),
  gender: varchar("gender"),
  petType: varchar("pet_type"),
  profilePictureUrl: varchar("profile_picture_url"),
  loyaltyProgram: boolean("loyalty_program").default(true),
  reminders: boolean("reminders").default(true),
  marketing: boolean("marketing").default(false),
  termsAccepted: boolean("terms_accepted").default(false),
  isVerified: boolean("is_verified").default(false),
  loyaltyTier: varchar("loyalty_tier").default("bronze"), // 7-tier luxury system: bronze(5%), silver(10%), gold(15%), platinum(20%), diamond(30%), emerald(40%), royal(50%)
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  washBalance: integer("wash_balance").default(0),
  giftCardBalance: decimal("gift_card_balance", { precision: 10, scale: 2 }).default("0"), // Gift card monetary balance
  loyaltyPoints: integer("loyalty_points").default(0), // Points earned from purchases (1 point per ILS spent)
  
  // COMMUNICATION PREFERENCES (Granular channel control)
  communicationPreferences: jsonb("communication_preferences").default(sql`'{
    "email": {"marketing": false, "transactional": true, "reminders": true},
    "sms": {"marketing": false, "transactional": true, "reminders": true},
    "whatsapp": {"marketing": false, "transactional": true, "reminders": true},
    "push": {"marketing": false, "transactional": true, "reminders": true}
  }'::jsonb`),
  suppressionList: jsonb("suppression_list").default(sql`'{"email": false, "sms": false, "whatsapp": false, "push": false, "all": false}'::jsonb`), // Master suppression flags
  unsubscribedAt: timestamp("unsubscribed_at"), // When user unsubscribed from all marketing
  
  lastLogin: timestamp("last_login"),
  authProvider: varchar("auth_provider").default("email"), // email, google, apple, facebook
  authProviderId: varchar("auth_provider_id"), // for OAuth providers
  resetPasswordToken: varchar("reset_password_token"),
  resetPasswordExpires: timestamp("reset_password_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer pet information
export const customerPets = pgTable("customer_pets", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  name: varchar("name").notNull(),
  breed: varchar("breed").notNull(),
  age: integer("age"),
  dateOfBirth: date("date_of_birth"), // Pet birthday for birthday discount (10% off)
  weight: varchar("weight"),
  specialRequirements: text("special_requirements"),
  allergies: text("allergies"),
  notes: text("notes"),
  washFrequency: varchar("wash_frequency").default("monthly"), // weekly, biweekly, monthly, custom
  lastWashDate: timestamp("last_wash_date"),
  nextWashDue: timestamp("next_wash_due"),
  nextVaccinationDate: timestamp("next_vaccination_date"),
  vaccinationNotes: text("vaccination_notes"),
  reminderEnabled: boolean("reminder_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Wash packages
export const washPackages = pgTable("wash_packages", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  nameHe: varchar("name_he").notNull(),
  description: text("description"),
  descriptionHe: text("description_he"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  washCount: integer("wash_count").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// E-Vouchers (modern 2025-2026 secure voucher system)
export const eVouchers = pgTable("e_vouchers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  codeHash: text("code_hash").notNull().unique(), // SHA256 hash of code (never store plaintext)
  codeLast4: text("code_last4").notNull(), // For UI display only
  type: text("type").notNull(), // FIXED or STORED_VALUE
  currency: text("currency").notNull().default("ILS"),
  initialAmount: decimal("initial_amount", { precision: 12, scale: 2 }).notNull(),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("ISSUED"), // ISSUED, CLAIMED, ACTIVE, REDEEMED, EXPIRED, CANCELLED
  purchaserEmail: text("purchaser_email"),
  recipientEmail: text("recipient_email"),
  purchaserUid: text("purchaser_uid"), // Firebase UID (optional)
  ownerUid: text("owner_uid"), // Bound user after claim; NULL until claimed
  nayaxTxId: text("nayax_tx_id"), // Origin purchase reference
  eligibleServices: jsonb("eligible_services").default(['all']), // Services this voucher can be used for: wash, sitter, walk, trek, all
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
});

// E-Voucher redemptions ledger (append-only)
export const eVoucherRedemptions = pgTable("e_voucher_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull().references(() => eVouchers.id, { onDelete: 'cascade' }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  locationId: text("location_id"), // Station ID
  nayaxSessionId: text("nayax_session_id"), // Redemption/payment session
  kycType: text("kyc_type"), // If discount stack checks are needed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// E-Voucher events/audit trail
export const eVoucherEvents = pgTable("e_voucher_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull().references(() => eVouchers.id, { onDelete: 'cascade' }),
  eventType: text("event_type").notNull(), // ISSUED, CLAIMED, ACTIVATED, REDEEMED, PARTIAL_REDEEM, EXPIRED, CANCELLED
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// PetWash Vouchers 2025 - 7-Star Luxury System
export const petWashVouchers2025 = pgTable("petwash_vouchers_2025", {
  // Core IDs
  id: varchar("id").primaryKey(), // voucher_id (PWV-2025-XXX)
  publicCode: varchar("public_code").notNull().unique(), // PW-XXXX-XXXX-XXXX
  
  // Type & Classification
  type: varchar("type").notNull(), // egift, package_single, package_multi
  valueType: varchar("value_type").notNull(), // currency, washes
  
  // Visual Theme (7-Star Metal)
  tier: varchar("tier").notNull().default("7star_metal"),
  cardTheme: varchar("card_theme").notNull().default("neo_black_platinum"), // neo_black_platinum, neo_emerald, neo_silver
  animatedHighlight: boolean("animated_highlight").default(true),
  highresSvgUrl: text("highres_svg_url"),
  
  // Value Rules
  valueOriginal: decimal("value_original", { precision: 12, scale: 2 }),
  valueRemaining: decimal("value_remaining", { precision: 12, scale: 2 }),
  washesOriginal: integer("washes_original"),
  washesRemaining: integer("washes_remaining"),
  currency: varchar("currency").default("ILS"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  transferable: boolean("transferable").default(true),
  
  // Owner Information
  ownerId: varchar("owner_id").notNull(), // User ID
  ownerName: varchar("owner_name").notNull(),
  ownerEmail: varchar("owner_email").notNull(),
  createdInApp: varchar("created_in_app").default("PetWash Hub 1.0.0"),
  
  // Security (SHA256 + JWS)
  qrUrl: text("qr_url"),
  sha256Hash: text("sha256_hash").notNull(),
  signedJws: text("signed_jws"),
  
  // Usage Tracking
  lastUsed: timestamp("last_used", { withTimezone: true }),
  redeemMethod: varchar("redeem_method").default("app"), // app, station, qr
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Voucher 2025 Usage History (Redemption Ledger)
export const voucherUsageHistory = pgTable("voucher_usage_history_2025", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull().references(() => petWashVouchers2025.id, { onDelete: 'cascade' }),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  stationId: varchar("station_id"),
  locationLabel: text("location_label"),
  method: varchar("method").notNull(), // app, station, qr
  amountUsed: decimal("amount_used", { precision: 12, scale: 2 }),
  washesUsed: integer("washes_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Voucher 2025 Tamper-Evident Ledger (CRITICAL SECURITY)
// Append-only ledger with ES256 signatures preventing balance replay attacks
export const voucherUsageLedger = pgTable("voucher_usage_ledger_2025", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull().references(() => petWashVouchers2025.id, { onDelete: 'cascade' }),
  
  // Sequence & Chain
  seqNo: integer("seq_no").notNull(), // Monotonic sequence number starting from 0 (genesis)
  prevEntryHash: text("prev_entry_hash"), // SHA256 of previous entry (null for genesis)
  
  // Delta Values (this transaction)
  deltaValue: decimal("delta_value", { precision: 12, scale: 2 }).default("0"), // Amount used in this redemption
  deltaWashes: integer("delta_washes").default(0), // Washes used in this redemption
  
  // Cumulative Totals (after this transaction)
  cumulativeValueUsed: decimal("cumulative_value_used", { precision: 12, scale: 2 }).notNull(),
  cumulativeWashesUsed: integer("cumulative_washes_used").notNull(),
  
  // Transaction Details
  stationId: varchar("station_id"),
  locationLabel: text("location_label"),
  method: varchar("method"), // app, station, qr (null for genesis)
  
  // Cryptographic Security
  entryHash: text("entry_hash").notNull(), // SHA256 of this entry's canonical data
  signedJws: text("signed_jws").notNull(), // ES256 signature of entryHash
  
  // Metadata
  entryType: varchar("entry_type").notNull().default("redemption"), // genesis, redemption, refund
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("voucher_ledger_seq_idx").on(table.voucherId, table.seqNo)
]);

// Wash history
export const washHistory = pgTable("wash_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  packageId: integer("package_id").references(() => washPackages.id),
  washCount: integer("wash_count").default(1),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  discountApplied: decimal("discount_applied", { precision: 5, scale: 2 }).default("0"),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method"),
  status: varchar("status").default("completed"), // pending, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});

// Coupons/Discounts
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code").unique().notNull(),
  description: text("description"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User coupon usage
export const userCoupons = pgTable("user_coupons", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  couponId: integer("coupon_id").references(() => coupons.id).notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

// Nayax pending transactions table
export const pendingTransactions = pgTable("pending_transactions", {
  id: varchar("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => washPackages.id),
  customerEmail: varchar("customer_email"),
  customerName: varchar("customer_name"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("ILS"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  voucherCode: varchar("voucher_code", { length: 16 }),
  qrCodeData: text("qr_code_data"),
  isGiftCard: boolean("is_gift_card").notNull().default(false),
  recipientEmail: varchar("recipient_email"),
  recipientName: varchar("recipient_name"),
  recipientPhone: varchar("recipient_phone"),
  personalMessage: text("personal_message"),
  deliveryMethod: varchar("delivery_method").default("email"), // email, whatsapp, both
  createdAt: timestamp("created_at").defaultNow(),
  paidAt: timestamp("paid_at"),
  nayaxTransactionId: varchar("nayax_transaction_id"),
  nayaxReference: varchar("nayax_reference"),
});

// Nayax Spark API transactions (complete payment lifecycle)
export const nayaxTransactions = pgTable("nayax_transactions", {
  id: varchar("id").primaryKey(),
  
  // Legacy fields (maintain backward compatibility)
  pendingTransactionId: varchar("pending_transaction_id").references(() => pendingTransactions.id),
  merchantId: varchar("merchant_id"),
  voucherId: varchar("voucher_id"), // Store voucher ID without foreign key constraint
  paymentMethod: varchar("payment_method"), // card, apple_pay, google_pay
  cardLast4: varchar("card_last_4"),
  nayaxReference: varchar("nayax_reference"),
  completedAt: timestamp("completed_at"),
  
  // Spark API integration fields (production-ready payment flow)
  externalTransactionId: varchar("external_transaction_id").unique(), // Our unique ID
  nayaxTransactionId: varchar("nayax_transaction_id"), // Nayax's transaction ID (after authorize)
  status: varchar("status").notNull().default("initiated"), // initiated → authorized → vend_pending → vend_success → settled | voided | failed
  washType: varchar("wash_type"), // DOGWASH_PREMIUM, DOGWASH_BASIC, etc.
  productCode: varchar("product_code"), // Nayax product code for vending
  
  // Station & terminal info
  stationId: varchar("station_id"),
  terminalId: varchar("terminal_id"),
  
  // Customer info
  customerUid: varchar("customer_uid"),
  customerToken: text("customer_token"), // Encrypted Nayax payment token
  
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("ILS"),
  
  // Lifecycle timestamps
  createdAt: timestamp("created_at").defaultNow(),
  authorizedAt: timestamp("authorized_at"),
  vendAttemptedAt: timestamp("vend_attempted_at"),
  vendSuccessAt: timestamp("vend_success_at"),
  settledAt: timestamp("settled_at"),
  voidedAt: timestamp("voided_at"),
  failedAt: timestamp("failed_at"),
  
  // Error handling
  declineReason: text("decline_reason"), // Payment declined reason
  vendErrorMessage: text("vend_error_message"), // Machine vend failure reason
  errorMessage: text("error_message"), // General error
  
  // Retry tracking
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
}, (table) => [
  index("idx_nayax_tx_status").on(table.status),
  index("idx_nayax_tx_customer").on(table.customerUid),
  index("idx_nayax_tx_station").on(table.stationId),
  index("idx_nayax_tx_terminal").on(table.terminalId),
  index("idx_nayax_tx_created").on(table.createdAt),
  index("idx_nayax_tx_nayax_id").on(table.nayaxTransactionId),
]);

// Nayax terminals (Pet Wash™ station hardware)
export const nayaxTerminals = pgTable("nayax_terminals", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  location: varchar("location").notNull(),
  terminalId: varchar("terminal_id").unique().notNull(), // Nayax device ID
  merchantId: varchar("merchant_id"),
  status: varchar("status").notNull().default("online"), // online, offline, maintenance
  deviceType: varchar("device_type").notNull(), // card_reader, qr_scanner
  lastHeartbeat: timestamp("last_heartbeat"),
  firmwareVersion: varchar("firmware_version"),
  apiKey: varchar("api_key").unique().notNull(), // X-Station-Key for authentication
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Nayax webhook events log
export const nayaxWebhookEvents = pgTable("nayax_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: varchar("event_type").notNull(), // payment.approved, payment.declined, session.started, session.ended, qr.scanned
  eventId: varchar("event_id").unique().notNull(), // Idempotency key from Nayax
  transactionId: varchar("transaction_id"),
  terminalId: varchar("terminal_id"),
  payload: jsonb("payload").notNull(),
  signature: varchar("signature"), // Webhook signature for verification
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Nayax station API keys
export const nayaxStationKeys = pgTable("nayax_station_keys", {
  id: serial("id").primaryKey(),
  stationId: varchar("station_id").notNull(),
  apiKey: varchar("api_key").unique().notNull(),
  description: varchar("description"),
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type CustomerPet = typeof customerPets.$inferSelect;
export type InsertCustomerPet = typeof customerPets.$inferInsert;
export type WashPackage = typeof washPackages.$inferSelect;
export type InsertWashPackage = typeof washPackages.$inferInsert;
export type EVoucher = typeof eVouchers.$inferSelect;
export type InsertEVoucher = typeof eVouchers.$inferInsert;
export type EVoucherRedemption = typeof eVoucherRedemptions.$inferSelect;
export type InsertEVoucherRedemption = typeof eVoucherRedemptions.$inferInsert;
export type WashHistory = typeof washHistory.$inferSelect;
export type InsertWashHistory = typeof washHistory.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// Nayax types
export type PendingTransaction = typeof pendingTransactions.$inferSelect;
export type InsertPendingTransaction = typeof pendingTransactions.$inferInsert;
export type NayaxTransaction = typeof nayaxTransactions.$inferSelect;
export type InsertNayaxTransaction = typeof nayaxTransactions.$inferInsert;
export type NayaxTerminal = typeof nayaxTerminals.$inferSelect;
export type InsertNayaxTerminal = typeof nayaxTerminals.$inferInsert;
export type NayaxWebhookEvent = typeof nayaxWebhookEvents.$inferSelect;
export type InsertNayaxWebhookEvent = typeof nayaxWebhookEvents.$inferInsert;
export type NayaxStationKey = typeof nayaxStationKeys.$inferSelect;
export type InsertNayaxStationKey = typeof nayaxStationKeys.$inferInsert;

// Legacy types for backward compatibility
export type GiftCard = EVoucher;
export type InsertGiftCard = InsertEVoucher;

// Notification types
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

// Zod schemas
export const insertCustomerSchema = createInsertSchema(customers);
export const insertCustomerPetSchema = createInsertSchema(customerPets);
export const insertWashPackageSchema = createInsertSchema(washPackages);
export const insertEVoucherSchema = createInsertSchema(eVouchers);
export const insertEVoucherRedemptionSchema = createInsertSchema(eVoucherRedemptions);
export const insertWashHistorySchema = createInsertSchema(washHistory);
export const insertPendingTransactionSchema = createInsertSchema(pendingTransactions);
export const insertNayaxTransactionSchema = createInsertSchema(nayaxTransactions, {
  status: z.enum(['initiated', 'authorized', 'vend_pending', 'vend_success', 'settled', 'voided', 'failed', 'approved', 'declined', 'refunded']), // Include legacy statuses
  currency: z.enum(['ILS', 'USD', 'EUR']),
});
export const insertNayaxTerminalSchema = createInsertSchema(nayaxTerminals);
export const insertNayaxWebhookEventSchema = createInsertSchema(nayaxWebhookEvents);
export const insertNayaxStationKeySchema = createInsertSchema(nayaxStationKeys);

// Legacy schema for backward compatibility
export const insertGiftCardSchema = insertEVoucherSchema;

// Notification schemas
export const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertNotificationLogSchema = createInsertSchema(notificationLogs).omit({
  id: true,
  createdAt: true,
});

// Admin system tables
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  role: varchar("role").notNull().default("support"), // super_admin, regional_admin, support, employee
  employeeLabelNumber: varchar("employee_label_number").unique(), // Unique employee badge/ID number (e.g., EMP-001, EMP-002)
  regions: jsonb("regions").default([]), // Array of regions/cities they manage
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: serial("id").primaryKey(),
  adminId: varchar("admin_id").references(() => adminUsers.id).notNull(),
  action: varchar("action").notNull(), // login, logout, view_user, update_inventory, etc.
  resource: varchar("resource"), // user_id, inventory_item_id, etc.
  details: jsonb("details").default({}),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// ============================================================================
// RBAC (Role-Based Access Control) - Unified Control Panel
// ============================================================================

// Departments table - organizational units
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(), // "executive", "operations", "logistics", etc.
  label: varchar("label").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
});

// Roles table - user roles mapped to departments
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(), // "super_admin", "city_manager", etc.
  label: varchar("label").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  description: text("description"),
  isActive: boolean("is_active").default(true),
});

// Control Panel Platforms - different from service platforms (walk_my_pet, etc.)
export const controlPanelPlatforms = pgTable("control_panel_platforms", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(), // "petwash_hub", "petwash_manager", etc.
  label: varchar("label").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
});

// User Roles mapping - assigns roles to users with optional scope
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  roleId: integer("role_id").references(() => roles.id).notNull(),
  scopeType: varchar("scope_type"), // "global", "country", "city", "station", "partner"
  scopeId: varchar("scope_id"), // Entity ID for scope
  grantedAt: timestamp("granted_at").defaultNow(),
  grantedBy: varchar("granted_by"), // Admin who granted this
});

// Employee Hierarchy - Tree model for approval workflows
export const employeeHierarchy = pgTable("employee_hierarchy", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").references(() => adminUsers.id).notNull().unique(),
  supervisorId: varchar("supervisor_id").references(() => adminUsers.id), // NULL for CEO/top level
  department: varchar("department"), // K9000_Stations, Care_Services, Transport, Executive
  position: varchar("position").notNull(), // CEO, National_Operations_Director, Field_Technician, etc.
  level: integer("level").notNull().default(0), // 0=CEO, 1=Directors, 2=Managers, 3=Staff
  canApproveBudget: decimal("can_approve_budget", { precision: 12, scale: 2 }).default("0"), // Max expense amount they can approve
  autoApprove: boolean("auto_approve").default(false), // true for CEO only
  whatsappPhone: varchar("whatsapp_phone"), // E.164 format: +972XXXXXXXXX (preferred contact method)
  preferredLanguage: varchar("preferred_language").default("he"), // 'he' or 'en' for notifications
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_employee_hierarchy_supervisor").on(table.supervisorId),
  index("idx_employee_hierarchy_department").on(table.department),
]);

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // shampoo, conditioner, disinfectant, etc.
  currentStock: integer("current_stock").default(0),
  minStock: integer("min_stock").default(10),
  maxStock: integer("max_stock").default(100),
  unit: varchar("unit").notNull(), // bottles, liters, etc.
  cost: decimal("cost", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"),
  location: varchar("location"), // which city/region
  lastRestocked: timestamp("last_restocked"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hrDocuments = pgTable("hr_documents", {
  id: serial("id").primaryKey(),
  employeeName: varchar("employee_name").notNull(),
  employeeType: varchar("employee_type").notNull(), // employee, subcontractor
  documentType: varchar("document_type").notNull(), // work_log, invoice, contract, etc.
  title: varchar("title").notNull(),
  description: text("description"),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  location: varchar("location").notNull(), // city/region
  uploadedBy: varchar("uploaded_by").references(() => adminUsers.id).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  status: varchar("status").default("pending"), // pending, approved, rejected
});

export const loyaltyAnalytics = pgTable("loyalty_analytics", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  totalWashes: integer("total_washes").default(0),
  currentTier: varchar("current_tier").default("bronze"),
  lastActivity: timestamp("last_activity"),
  averageMonthlySpend: decimal("average_monthly_spend", { precision: 10, scale: 2 }).default("0"),
  lifetimeValue: decimal("lifetime_value", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Israeli Tax Invoices table
export const taxInvoices = pgTable("tax_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number").unique().notNull(),
  transactionId: varchar("transaction_id").references(() => pendingTransactions.id),
  customerEmail: varchar("customer_email").notNull(),
  customerName: varchar("customer_name"),
  
  // Financial details
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default("0.18"), // Israeli VAT (18% as of Jan 2025)
  
  // Product details
  packageName: varchar("package_name").notNull(),
  packageNameHe: varchar("package_name_he").notNull(),
  isGiftCard: boolean("is_gift_card").default(false),
  quantity: integer("quantity").default(1),
  
  // Payment details
  paymentMethod: varchar("payment_method").default("Nayax"),
  nayaxTransactionId: varchar("nayax_transaction_id"),
  nayaxReference: varchar("nayax_reference"),
  
  // Tax compliance
  invoiceGenerated: boolean("invoice_generated").default(false),
  invoiceSent: boolean("invoice_sent").default(false),
  reportSent: boolean("report_sent").default(false),
  taxReported: boolean("tax_reported").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction records for Israeli tax compliance
export const transactionRecords = pgTable("transaction_records", {
  id: varchar("id").primaryKey(),
  invoiceNumber: varchar("invoice_number").references(() => taxInvoices.invoiceNumber),
  timestamp: timestamp("timestamp").defaultNow(),
  customerEmail: varchar("customer_email").notNull(),
  customerName: varchar("customer_name"),
  
  // Product details
  packageId: integer("package_id").references(() => washPackages.id),
  packageName: varchar("package_name").notNull(),
  packageNameHe: varchar("package_name_he").notNull(),
  isGiftCard: boolean("is_gift_card").default(false),
  
  // Financial details
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).notNull(),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  
  // Payment details
  paymentMethod: varchar("payment_method").default("Nayax"),
  nayaxTransactionId: varchar("nayax_transaction_id"),
  nayaxReference: varchar("nayax_reference"),
  
  // Compliance status
  invoiceGenerated: boolean("invoice_generated").default(false),
  reportSent: boolean("report_sent").default(false),
  taxReported: boolean("tax_reported").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = typeof adminUsers.$inferInsert;
export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
export type InsertAdminActivityLog = typeof adminActivityLogs.$inferInsert;
export type EmployeeHierarchy = typeof employeeHierarchy.$inferSelect;
export type InsertEmployeeHierarchy = typeof employeeHierarchy.$inferInsert;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type HRDocument = typeof hrDocuments.$inferSelect;
export type InsertHRDocument = typeof hrDocuments.$inferInsert;
export type LoyaltyAnalytics = typeof loyaltyAnalytics.$inferSelect;
export type InsertLoyaltyAnalytics = typeof loyaltyAnalytics.$inferInsert;
export type TaxInvoice = typeof taxInvoices.$inferSelect;
export type InsertTaxInvoice = typeof taxInvoices.$inferInsert;
export type TransactionRecord = typeof transactionRecords.$inferSelect;
export type InsertTransactionRecord = typeof transactionRecords.$inferInsert;

// Smart Wash Receipts table
export const smartWashReceipts = pgTable("smart_wash_receipts", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id").unique().notNull(), // TX-XXXXXXX format
  userId: varchar("user_id").references(() => users.id),
  packageId: integer("package_id").references(() => washPackages.id),
  
  // Receipt details
  locationName: varchar("location_name").notNull().default("Pet Wash™ Premium Station"),
  washType: varchar("wash_type").notNull(), // from package name
  washDuration: integer("wash_duration").default(15), // minutes
  customerIdMasked: varchar("customer_id_masked").notNull(), // masked phone/email
  
  // Payment details
  paymentMethod: varchar("payment_method").notNull(), // "Nayax Card Payment", "E-Voucher Redemption", etc.
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }).notNull(),
  discountApplied: decimal("discount_applied", { precision: 10, scale: 2 }).default("0"),
  finalTotal: decimal("final_total", { precision: 10, scale: 2 }).notNull(),
  
  // Loyalty program details
  loyaltyPointsEarned: integer("loyalty_points_earned").default(0),
  currentTierPoints: integer("current_tier_points").default(0),
  nextTierPoints: integer("next_tier_points").default(0),
  currentTier: varchar("current_tier").default("Bronze"),
  nextTier: varchar("next_tier").default("Silver"),
  
  // Receipt metadata
  receiptQrCode: text("receipt_qr_code").notNull(), // QR code data
  receiptUrl: varchar("receipt_url").notNull(), // https://petwash.co.il/receipt/TX-XXXXXXX
  emailSent: boolean("email_sent").default(false),
  
  // Timestamps
  washDateTime: timestamp("wash_date_time").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SmartWashReceipt = typeof smartWashReceipts.$inferSelect;
export type InsertSmartWashReceipt = typeof smartWashReceipts.$inferInsert;

// =================== CRM SYSTEM TABLES ===================

// Lead Management
export const crmLeads = pgTable("crm_leads", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  company: varchar("company"),
  jobTitle: varchar("job_title"),
  
  // Lead source and attribution
  leadSource: varchar("lead_source").notNull(), // website, referral, social_media, google_ads, facebook_ads, trade_show, cold_call, etc.
  sourceDetails: varchar("source_details"), // specific campaign, referrer name, etc.
  utmSource: varchar("utm_source"),
  utmMedium: varchar("utm_medium"),
  utmCampaign: varchar("utm_campaign"),
  
  // Lead qualification
  leadStatus: varchar("lead_status").notNull().default("new"), // new, contacted, qualified, nurturing, converted, lost
  leadScore: integer("lead_score").default(0), // 0-100 scoring system
  qualificationStatus: varchar("qualification_status").default("unqualified"), // unqualified, marketing_qualified, sales_qualified
  
  // Interest and needs
  interestedServices: text("interested_services").array(), // wash_packages, gift_cards, loyalty_program, corporate_accounts
  petType: varchar("pet_type"), // dog, cat, other
  estimatedMonthlyValue: decimal("estimated_monthly_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  
  // Assignment and ownership
  assignedTo: varchar("assigned_to").references(() => adminUsers.id),
  assignedAt: timestamp("assigned_at"),
  
  // Conversion tracking
  convertedAt: timestamp("converted_at"),
  convertedToCustomerId: integer("converted_to_customer_id").references(() => customers.id),
  convertedToUserId: varchar("converted_to_user_id").references(() => users.id),
  
  // Follow-up tracking
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_leads_email").on(table.email),
  index("idx_crm_leads_status").on(table.leadStatus),
  index("idx_crm_leads_assigned_to").on(table.assignedTo),
  index("idx_crm_leads_source").on(table.leadSource),
  index("idx_crm_leads_next_followup").on(table.nextFollowUpAt),
]);

// Communication History
export const crmCommunications = pgTable("crm_communications", {
  id: serial("id").primaryKey(),
  
  // Target: could be lead, customer, or user
  leadId: integer("lead_id").references(() => crmLeads.id),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Communication details
  communicationType: varchar("communication_type").notNull(), // email, phone_call, sms, in_person, whatsapp, chat, video_call
  direction: varchar("direction").notNull(), // inbound, outbound
  subject: varchar("subject"),
  content: text("content"),
  summary: text("summary"), // Brief summary of the communication
  
  // Outcome and next steps
  outcome: varchar("outcome"), // no_answer, voicemail, callback_requested, meeting_scheduled, interested, not_interested, etc.
  nextAction: varchar("next_action"), // follow_up_call, send_proposal, schedule_demo, etc.
  nextActionDate: timestamp("next_action_date"),
  
  // Technical details
  duration: integer("duration"), // in minutes for calls/meetings
  attachments: jsonb("attachments").default([]), // file paths or URLs
  emailMessageId: varchar("email_message_id"), // for email threading
  phoneNumber: varchar("phone_number"), // specific number used
  
  // Staff assignment
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  
  // Integration fields
  externalId: varchar("external_id"), // for integration with email/phone systems
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_communications_lead").on(table.leadId),
  index("idx_crm_communications_customer").on(table.customerId),
  index("idx_crm_communications_user").on(table.userId),
  index("idx_crm_communications_type").on(table.communicationType),
  index("idx_crm_communications_created_by").on(table.createdBy),
  index("idx_crm_communications_created_at").on(table.createdAt),
]);

// Deal Stages Configuration
export const crmDealStages = pgTable("crm_deal_stages", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull(),
  winProbability: decimal("win_probability", { precision: 5, scale: 2 }), // 0-100%
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_crm_deal_stages_sort").on(table.sortOrder),
]);

// Sales Pipeline/Opportunities
export const crmOpportunities = pgTable("crm_opportunities", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  
  // Associated lead/customer
  leadId: integer("lead_id").references(() => crmLeads.id),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Deal details
  dealStageId: integer("deal_stage_id").references(() => crmDealStages.id).notNull(),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }).notNull(),
  actualValue: decimal("actual_value", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  
  // Probability and forecasting
  winProbability: decimal("win_probability", { precision: 5, scale: 2 }), // 0-100%
  expectedCloseDate: date("expected_close_date"),
  actualCloseDate: date("actual_close_date"),
  
  // Products/services
  interestedPackages: integer("interested_packages").array(), // washPackages.id references
  serviceType: varchar("service_type"), // individual, corporate, franchise
  
  // Assignment
  assignedTo: varchar("assigned_to").references(() => adminUsers.id).notNull(),
  teamMembers: varchar("team_members").array(), // additional team member IDs
  
  // Status and outcome
  status: varchar("status").notNull().default("open"), // open, won, lost, on_hold
  lostReason: varchar("lost_reason"), // price, competition, timing, no_budget, etc.
  competitorName: varchar("competitor_name"),
  
  // Tracking
  lastActivityAt: timestamp("last_activity_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_opportunities_stage").on(table.dealStageId),
  index("idx_crm_opportunities_assigned_to").on(table.assignedTo),
  index("idx_crm_opportunities_status").on(table.status),
  index("idx_crm_opportunities_close_date").on(table.expectedCloseDate),
  index("idx_crm_opportunities_lead").on(table.leadId),
  index("idx_crm_opportunities_customer").on(table.customerId),
]);

// Tasks & Activities
export const crmTasks = pgTable("crm_tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  
  // Task type and priority
  taskType: varchar("task_type").notNull(), // call, email, meeting, demo, follow_up, research, proposal, contract
  priority: varchar("priority").notNull().default("medium"), // low, medium, high, urgent
  
  // Related entities
  leadId: integer("lead_id").references(() => crmLeads.id),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  opportunityId: integer("opportunity_id").references(() => crmOpportunities.id),
  
  // Assignment and scheduling
  assignedTo: varchar("assigned_to").references(() => adminUsers.id).notNull(),
  dueDate: timestamp("due_date"),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  
  // Status and completion
  status: varchar("status").notNull().default("pending"), // pending, in_progress, completed, cancelled, overdue
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => adminUsers.id),
  
  // Results
  outcome: varchar("outcome"), // completed, partial, rescheduled, no_show, cancelled
  notes: text("notes"),
  nextAction: varchar("next_action"),
  
  // Reminders
  reminderEnabled: boolean("reminder_enabled").default(true),
  reminderTime: timestamp("reminder_time"),
  reminderSent: boolean("reminder_sent").default(false),
  
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_tasks_assigned_to").on(table.assignedTo),
  index("idx_crm_tasks_due_date").on(table.dueDate),
  index("idx_crm_tasks_status").on(table.status),
  index("idx_crm_tasks_priority").on(table.priority),
  index("idx_crm_tasks_lead").on(table.leadId),
  index("idx_crm_tasks_opportunity").on(table.opportunityId),
  index("idx_crm_tasks_reminder").on(table.reminderTime),
]);

// Activities Log (completed activities)
export const crmActivities = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  activityType: varchar("activity_type").notNull(), // call, email, meeting, demo, proposal_sent, contract_signed, etc.
  title: varchar("title").notNull(),
  description: text("description"),
  
  // Related entities
  leadId: integer("lead_id").references(() => crmLeads.id),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  opportunityId: integer("opportunity_id").references(() => crmOpportunities.id),
  taskId: integer("task_id").references(() => crmTasks.id),
  
  // Activity details
  duration: integer("duration"), // in minutes
  outcome: varchar("outcome"),
  notes: text("notes"),
  
  // Attachments and metadata
  attachments: jsonb("attachments").default([]),
  metadata: jsonb("metadata").default({}),
  
  // Staff
  performedBy: varchar("performed_by").references(() => adminUsers.id).notNull(),
  
  activityDate: timestamp("activity_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_crm_activities_type").on(table.activityType),
  index("idx_crm_activities_lead").on(table.leadId),
  index("idx_crm_activities_customer").on(table.customerId),
  index("idx_crm_activities_opportunity").on(table.opportunityId),
  index("idx_crm_activities_performed_by").on(table.performedBy),
  index("idx_crm_activities_date").on(table.activityDate),
]);

// Meeting Attendees (Junction table for multi-attendee meetings)
export const crmMeetingAttendees = pgTable("crm_meeting_attendees", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => crmTasks.id, { onDelete: "cascade" }).notNull(),
  
  // Attendee can be either admin user, customer, or external contact
  attendeeType: varchar("attendee_type").notNull(), // 'admin', 'customer', 'external'
  
  // Reference fields (only one should be set based on attendeeType)
  adminUserId: varchar("admin_user_id").references(() => adminUsers.id),
  customerId: integer("customer_id").references(() => customers.id),
  
  // External contact details (when attendeeType = 'external')
  externalName: varchar("external_name"),
  externalEmail: varchar("external_email"),
  externalPhone: varchar("external_phone"),
  
  // Attendance status
  responseStatus: varchar("response_status").default("pending"), // pending, accepted, declined, tentative, no_response
  respondedAt: timestamp("responded_at"),
  
  // Notification tracking
  invitationSent: boolean("invitation_sent").default(false),
  invitationSentAt: timestamp("invitation_sent_at"),
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  
  // Optional attendee role
  role: varchar("role"), // organizer, presenter, participant, optional
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_meeting_attendees_meeting").on(table.meetingId),
  index("idx_crm_meeting_attendees_admin").on(table.adminUserId),
  index("idx_crm_meeting_attendees_customer").on(table.customerId),
  index("idx_crm_meeting_attendees_response").on(table.responseStatus),
  index("idx_crm_meeting_attendees_type").on(table.attendeeType),
]);

// Marketing Campaigns
export const crmCampaigns = pgTable("crm_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  
  // Campaign details
  campaignType: varchar("campaign_type").notNull(), // email, sms, social_media, google_ads, facebook_ads, direct_mail, event
  channel: varchar("channel").notNull(), // email, sms, whatsapp, facebook, instagram, google, website
  
  // Targeting
  targetAudience: varchar("target_audience"), // new_customers, existing_customers, leads, loyalty_members, etc.
  segmentCriteria: jsonb("segment_criteria").default({}), // filtering criteria
  
  // Campaign content
  subject: varchar("subject"),
  content: text("content"),
  callToAction: varchar("call_to_action"),
  
  // Offers and promotions
  offerType: varchar("offer_type"), // discount, free_wash, gift_card_bonus, loyalty_points
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  couponCode: varchar("coupon_code"),
  
  // Budget and costs
  budget: decimal("budget", { precision: 10, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  
  // Scheduling
  status: varchar("status").notNull().default("draft"), // draft, scheduled, active, paused, completed, cancelled
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  
  // Goals and metrics
  goalType: varchar("goal_type"), // awareness, leads, conversions, revenue, retention
  goalValue: decimal("goal_value", { precision: 10, scale: 2 }),
  
  // Assignment
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  assignedTo: varchar("assigned_to").references(() => adminUsers.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_campaigns_status").on(table.status),
  index("idx_crm_campaigns_type").on(table.campaignType),
  index("idx_crm_campaigns_channel").on(table.channel),
  index("idx_crm_campaigns_start").on(table.scheduledStart),
  index("idx_crm_campaigns_created_by").on(table.createdBy),
]);

// Campaign Targets (who received the campaign)
export const crmCampaignTargets = pgTable("crm_campaign_targets", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => crmCampaigns.id).notNull(),
  
  // Target person
  leadId: integer("lead_id").references(() => crmLeads.id),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Contact details used
  email: varchar("email"),
  phone: varchar("phone"),
  
  // Delivery status
  status: varchar("status").notNull().default("pending"), // pending, sent, delivered, opened, clicked, bounced, unsubscribed, failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  // Response tracking
  responded: boolean("responded").default(false),
  convertedTo: varchar("converted_to"), // lead, customer, purchase
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  
  // Technical details
  deliveryAttempts: integer("delivery_attempts").default(0),
  lastError: text("last_error"),
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_campaign_targets_campaign").on(table.campaignId),
  index("idx_crm_campaign_targets_lead").on(table.leadId),
  index("idx_crm_campaign_targets_customer").on(table.customerId),
  index("idx_crm_campaign_targets_status").on(table.status),
  index("idx_crm_campaign_targets_sent").on(table.sentAt),
]);

// Campaign Metrics (aggregated performance data)
export const crmCampaignMetrics = pgTable("crm_campaign_metrics", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => crmCampaigns.id).notNull(),
  
  // Audience metrics
  totalTargets: integer("total_targets").default(0),
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalBounced: integer("total_bounced").default(0),
  totalUnsubscribed: integer("total_unsubscribed").default(0),
  
  // Engagement metrics
  totalOpened: integer("total_opened").default(0),
  totalClicked: integer("total_clicked").default(0),
  uniqueOpens: integer("unique_opens").default(0),
  uniqueClicks: integer("unique_clicks").default(0),
  
  // Conversion metrics
  totalResponses: integer("total_responses").default(0),
  totalConversions: integer("total_conversions").default(0),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  newLeads: integer("new_leads").default(0),
  newCustomers: integer("new_customers").default(0),
  
  // Calculated rates
  deliveryRate: decimal("delivery_rate", { precision: 5, scale: 2 }).default("0"), // delivered/sent
  openRate: decimal("open_rate", { precision: 5, scale: 2 }).default("0"), // opened/delivered
  clickRate: decimal("click_rate", { precision: 5, scale: 2 }).default("0"), // clicked/delivered
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"), // conversions/delivered
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }).default("0"), // responses/delivered
  
  // ROI calculations
  roi: decimal("roi", { precision: 10, scale: 2 }).default("0"), // (revenue - cost) / cost * 100
  costPerConversion: decimal("cost_per_conversion", { precision: 10, scale: 2 }).default("0"),
  revenuePerTarget: decimal("revenue_per_target", { precision: 10, scale: 2 }).default("0"),
  
  lastCalculated: timestamp("last_calculated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_campaign_metrics_campaign").on(table.campaignId),
]);

// Customer Segments
export const crmCustomerSegments = pgTable("crm_customer_segments", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  
  // Segment criteria
  criteria: jsonb("criteria").notNull(), // JSON defining the segmentation rules
  segmentType: varchar("segment_type").notNull(), // behavioral, demographic, geographic, value, lifecycle
  
  // Automation
  isAutoUpdated: boolean("is_auto_updated").default(true),
  lastUpdated: timestamp("last_updated").defaultNow(),
  
  // Assignment
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_customer_segments_type").on(table.segmentType),
  index("idx_crm_customer_segments_auto").on(table.isAutoUpdated),
]);

// Customer Segment Membership
export const crmCustomerSegmentMembers = pgTable("crm_customer_segment_members", {
  id: serial("id").primaryKey(),
  segmentId: integer("segment_id").references(() => crmCustomerSegments.id).notNull(),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  
  addedAt: timestamp("added_at").defaultNow(),
  removedAt: timestamp("removed_at"),
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_crm_segment_members_segment").on(table.segmentId),
  index("idx_crm_segment_members_customer").on(table.customerId),
  index("idx_crm_segment_members_user").on(table.userId),
  index("idx_crm_segment_members_active").on(table.isActive),
]);

// Enhanced Customer Insights
export const crmCustomerInsights = pgTable("crm_customer_insights", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Behavioral insights
  totalInteractions: integer("total_interactions").default(0),
  lastInteractionDate: timestamp("last_interaction_date"),
  preferredCommunicationChannel: varchar("preferred_communication_channel"), // email, phone, sms, whatsapp
  averageResponseTime: integer("average_response_time"), // hours
  
  // Purchase behavior
  totalPurchases: integer("total_purchases").default(0),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }).default("0"),
  totalLifetimeValue: decimal("total_lifetime_value", { precision: 10, scale: 2 }).default("0"),
  predictedLifetimeValue: decimal("predicted_lifetime_value", { precision: 10, scale: 2 }),
  lastPurchaseDate: timestamp("last_purchase_date"),
  daysSinceLastPurchase: integer("days_since_last_purchase"),
  purchaseFrequency: decimal("purchase_frequency", { precision: 5, scale: 2 }), // purchases per month
  
  // Engagement metrics
  emailOpenRate: decimal("email_open_rate", { precision: 5, scale: 2 }).default("0"),
  emailClickRate: decimal("email_click_rate", { precision: 5, scale: 2 }).default("0"),
  campaignResponseRate: decimal("campaign_response_rate", { precision: 5, scale: 2 }).default("0"),
  
  // Risk and retention
  churnRisk: varchar("churn_risk").default("low"), // low, medium, high
  churnProbability: decimal("churn_probability", { precision: 5, scale: 2 }).default("0"), // 0-100%
  retentionScore: integer("retention_score").default(50), // 0-100
  satisfactionScore: integer("satisfaction_score"), // 1-10 rating
  
  // Customer journey stage
  lifecycleStage: varchar("lifecycle_stage").default("new"), // new, active, at_risk, dormant, churned, win_back
  customerValue: varchar("customer_value").default("medium"), // low, medium, high, vip
  
  // Preferences and interests
  preferredServices: text("preferred_services").array(),
  interests: text("interests").array(),
  demographics: jsonb("demographics").default({}),
  
  // AI/ML scores
  leadScore: integer("lead_score").default(0), // 0-100
  salesReadiness: integer("sales_readiness").default(0), // 0-100
  upsellPotential: integer("upsell_potential").default(0), // 0-100
  
  lastCalculated: timestamp("last_calculated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_customer_insights_customer").on(table.customerId),
  index("idx_crm_customer_insights_user").on(table.userId),
  index("idx_crm_customer_insights_churn_risk").on(table.churnRisk),
  index("idx_crm_customer_insights_lifecycle").on(table.lifecycleStage),
  index("idx_crm_customer_insights_value").on(table.customerValue),
  index("idx_crm_customer_insights_ltv").on(table.totalLifetimeValue),
]);

// Customer Touchpoints (Journey tracking)
export const crmTouchpoints = pgTable("crm_touchpoints", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  leadId: integer("lead_id").references(() => crmLeads.id),
  
  // Touchpoint details
  touchpointType: varchar("touchpoint_type").notNull(), // website_visit, email_open, phone_call, store_visit, purchase, support_ticket, etc.
  channel: varchar("channel").notNull(), // website, email, phone, sms, social_media, in_person, mobile_app
  source: varchar("source"), // specific page, campaign, etc.
  
  // Content and context
  content: text("content"), // what they interacted with
  pagePath: varchar("page_path"), // for website visits
  campaignId: integer("campaign_id").references(() => crmCampaigns.id),
  
  // Engagement metrics
  duration: integer("duration"), // time spent in seconds
  depth: integer("depth"), // pages visited, emails opened, etc.
  outcome: varchar("outcome"), // conversion, bounce, inquiry, etc.
  
  // Technical tracking
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  device: varchar("device"), // mobile, desktop, tablet
  
  // Geographic
  country: varchar("country"),
  city: varchar("city"),
  
  // Attribution
  firstTouch: boolean("first_touch").default(false),
  lastTouch: boolean("last_touch").default(false),
  
  metadata: jsonb("metadata").default({}),
  
  touchpointDate: timestamp("touchpoint_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_crm_touchpoints_customer").on(table.customerId),
  index("idx_crm_touchpoints_user").on(table.userId),
  index("idx_crm_touchpoints_lead").on(table.leadId),
  index("idx_crm_touchpoints_type").on(table.touchpointType),
  index("idx_crm_touchpoints_channel").on(table.channel),
  index("idx_crm_touchpoints_date").on(table.touchpointDate),
  index("idx_crm_touchpoints_campaign").on(table.campaignId),
  index("idx_crm_touchpoints_session").on(table.sessionId),
]);

// =================== CRM TYPES ===================

// CRM Lead types
export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = typeof crmLeads.$inferInsert;

// CRM Communication types
export type CrmCommunication = typeof crmCommunications.$inferSelect;
export type InsertCrmCommunication = typeof crmCommunications.$inferInsert;

// CRM Deal Stage types
export type CrmDealStage = typeof crmDealStages.$inferSelect;
export type InsertCrmDealStage = typeof crmDealStages.$inferInsert;

// CRM Opportunity types
export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type InsertCrmOpportunity = typeof crmOpportunities.$inferInsert;

// CRM Task types
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = typeof crmTasks.$inferInsert;

// CRM Activity types
export type CrmActivity = typeof crmActivities.$inferSelect;
export type InsertCrmActivity = typeof crmActivities.$inferInsert;

// CRM Meeting Attendee types
export type CrmMeetingAttendee = typeof crmMeetingAttendees.$inferSelect;
export type InsertCrmMeetingAttendee = typeof crmMeetingAttendees.$inferInsert;

// CRM Campaign types
export type CrmCampaign = typeof crmCampaigns.$inferSelect;
export type InsertCrmCampaign = typeof crmCampaigns.$inferInsert;

// CRM Campaign Target types
export type CrmCampaignTarget = typeof crmCampaignTargets.$inferSelect;
export type InsertCrmCampaignTarget = typeof crmCampaignTargets.$inferInsert;

// CRM Campaign Metrics types
export type CrmCampaignMetrics = typeof crmCampaignMetrics.$inferSelect;
export type InsertCrmCampaignMetrics = typeof crmCampaignMetrics.$inferInsert;

// CRM Customer Segment types
export type CrmCustomerSegment = typeof crmCustomerSegments.$inferSelect;
export type InsertCrmCustomerSegment = typeof crmCustomerSegments.$inferInsert;

// CRM Customer Segment Member types
export type CrmCustomerSegmentMember = typeof crmCustomerSegmentMembers.$inferSelect;
export type InsertCrmCustomerSegmentMember = typeof crmCustomerSegmentMembers.$inferInsert;

// CRM Customer Insights types
export type CrmCustomerInsights = typeof crmCustomerInsights.$inferSelect;
export type InsertCrmCustomerInsights = typeof crmCustomerInsights.$inferInsert;

// CRM Touchpoint types
export type CrmTouchpoint = typeof crmTouchpoints.$inferSelect;
export type InsertCrmTouchpoint = typeof crmTouchpoints.$inferInsert;

// =================== CRM ZOD SCHEMAS ===================

// CRM Lead schemas
export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmLeadSchema = insertCrmLeadSchema.partial();

// CRM Communication schemas
export const insertCrmCommunicationSchema = createInsertSchema(crmCommunications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCommunicationSchema = insertCrmCommunicationSchema.partial();

// CRM Deal Stage schemas
export const insertCrmDealStageSchema = createInsertSchema(crmDealStages).omit({
  id: true,
  createdAt: true,
});

export const updateCrmDealStageSchema = insertCrmDealStageSchema.partial();

// CRM Opportunity schemas
export const insertCrmOpportunitySchema = createInsertSchema(crmOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmOpportunitySchema = insertCrmOpportunitySchema.partial();

// CRM Task schemas
export const insertCrmTaskSchema = createInsertSchema(crmTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmTaskSchema = insertCrmTaskSchema.partial();

// CRM Activity schemas
export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({
  id: true,
  createdAt: true,
});

// CRM Meeting Attendee schemas
export const insertCrmMeetingAttendeeSchema = createInsertSchema(crmMeetingAttendees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmMeetingAttendeeSchema = insertCrmMeetingAttendeeSchema.partial();

// CRM Campaign schemas
export const insertCrmCampaignSchema = createInsertSchema(crmCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCampaignSchema = insertCrmCampaignSchema.partial();

// CRM Campaign Target schemas
export const insertCrmCampaignTargetSchema = createInsertSchema(crmCampaignTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCampaignTargetSchema = insertCrmCampaignTargetSchema.partial();

// CRM Campaign Metrics schemas
export const insertCrmCampaignMetricsSchema = createInsertSchema(crmCampaignMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCampaignMetricsSchema = insertCrmCampaignMetricsSchema.partial();

// CRM Customer Segment schemas
export const insertCrmCustomerSegmentSchema = createInsertSchema(crmCustomerSegments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCustomerSegmentSchema = insertCrmCustomerSegmentSchema.partial();

// CRM Customer Segment Member schemas
export const insertCrmCustomerSegmentMemberSchema = createInsertSchema(crmCustomerSegmentMembers).omit({
  id: true,
  addedAt: true,
});

// CRM Customer Insights schemas
export const insertCrmCustomerInsightsSchema = createInsertSchema(crmCustomerInsights).omit({
  id: true,
  lastCalculated: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCustomerInsightsSchema = insertCrmCustomerInsightsSchema.partial();

// CRM Touchpoint schemas
export const insertCrmTouchpointSchema = createInsertSchema(crmTouchpoints).omit({
  id: true,
  touchpointDate: true,
  createdAt: true,
});

// Enhanced validation schemas with custom business rules
export const crmLeadCreationSchema = insertCrmLeadSchema.extend({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
  leadSource: z.enum(["website", "referral", "social_media", "google_ads", "facebook_ads", "trade_show", "cold_call", "other"]),
  leadStatus: z.enum(["new", "contacted", "qualified", "nurturing", "converted", "lost"]).default("new"),
});

export const crmOpportunityCreationSchema = insertCrmOpportunitySchema.extend({
  name: z.string().min(1, "Opportunity name is required").max(100, "Name must be less than 100 characters"),
  estimatedValue: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Estimated value must be a positive number"),
  expectedCloseDate: z.string().optional(),
  status: z.enum(["open", "won", "lost", "on_hold"]).default("open"),
});

export const crmTaskCreationSchema = insertCrmTaskSchema.extend({
  title: z.string().min(1, "Task title is required").max(200, "Title must be less than 200 characters"),
  taskType: z.enum(["call", "email", "meeting", "demo", "follow_up", "research", "proposal", "contract"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "overdue"]).default("pending"),
});

export const crmCampaignCreationSchema = insertCrmCampaignSchema.extend({
  name: z.string().min(1, "Campaign name is required").max(100, "Name must be less than 100 characters"),
  campaignType: z.enum(["email", "sms", "social_media", "google_ads", "facebook_ads", "direct_mail", "event"]),
  channel: z.enum(["email", "sms", "whatsapp", "facebook", "instagram", "google", "website"]),
  status: z.enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"]).default("draft"),
});

// =================== COMMUNICATION CENTER TABLES ===================

// Email Templates for Communications
export const crmEmailTemplates = pgTable("crm_email_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // welcome, appointment_confirmation, follow_up, promotion, reminder, newsletter
  subject: varchar("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"), // Optional plain text version
  
  // Template variables/placeholders
  variables: jsonb("variables").default([]), // Array of variable names used in template
  isDefault: boolean("is_default").default(false), // Is this the default template for this category
  
  // Usage tracking
  timesUsed: integer("times_used").default(0),
  lastUsed: timestamp("last_used"),
  
  // Metadata
  description: text("description"),
  tags: text("tags").array(), // For categorization and search
  isActive: boolean("is_active").default(true),
  
  // Ownership
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_email_templates_category").on(table.category),
  index("idx_email_templates_active").on(table.isActive),
  index("idx_email_templates_created_by").on(table.createdBy),
]);

// SMS Templates for Communications
export const crmSmsTemplates = pgTable("crm_sms_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(), // appointment_reminder, promotion, follow_up, confirmation, alert
  content: text("content").notNull(),
  
  // SMS specific fields
  characterCount: integer("character_count").notNull(),
  estimatedSegments: integer("estimated_segments").default(1), // SMS segments for pricing
  
  // Template variables/placeholders  
  variables: jsonb("variables").default([]), // Array of variable names used in template
  isDefault: boolean("is_default").default(false),
  
  // Usage tracking
  timesUsed: integer("times_used").default(0),
  lastUsed: timestamp("last_used"),
  
  // Metadata
  description: text("description"),
  tags: text("tags").array(),
  isActive: boolean("is_active").default(true),
  
  // Ownership
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  updatedBy: varchar("updated_by").references(() => adminUsers.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sms_templates_category").on(table.category),
  index("idx_sms_templates_active").on(table.isActive),
  index("idx_sms_templates_created_by").on(table.createdBy),
]);

// Appointment Reminders System
export const crmAppointmentReminders = pgTable("crm_appointment_reminders", {
  id: serial("id").primaryKey(),
  
  // Target appointment/booking reference
  bookingReference: varchar("booking_reference").notNull(), // External booking system reference
  customerId: integer("customer_id").references(() => customers.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Appointment details
  appointmentDate: timestamp("appointment_date").notNull(),
  appointmentType: varchar("appointment_type").notNull(), // wash_appointment, consultation, follow_up
  serviceDetails: jsonb("service_details").default({}), // Package info, location, etc.
  
  // Reminder configuration
  reminderType: varchar("reminder_type").notNull(), // email, sms, both
  reminderTiming: varchar("reminder_timing").notNull(), // 24h, 2h, 1h, 30m
  reminderOffsetMinutes: integer("reminder_offset_minutes").notNull(), // Minutes before appointment
  
  // Template references
  emailTemplateId: integer("email_template_id").references(() => crmEmailTemplates.id),
  smsTemplateId: integer("sms_template_id").references(() => crmSmsTemplates.id),
  
  // Scheduling
  scheduledSendTime: timestamp("scheduled_send_time").notNull(),
  isScheduled: boolean("is_scheduled").default(true),
  
  // Delivery tracking
  status: varchar("status").default("scheduled"), // scheduled, sent, delivered, failed, cancelled
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  emailDelivered: boolean("email_delivered").default(false),
  smsDelivered: boolean("sms_delivered").default(false),
  
  // Delivery details
  emailSentAt: timestamp("email_sent_at"),
  smsSentAt: timestamp("sms_sent_at"),
  emailDeliveredAt: timestamp("email_delivered_at"),
  smsDeliveredAt: timestamp("sms_delivered_at"),
  
  // Error tracking
  lastError: text("last_error"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Cancellation
  isCancelled: boolean("is_cancelled").default(false),
  cancelledBy: varchar("cancelled_by").references(() => adminUsers.id),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_appointment_reminders_customer").on(table.customerId),
  index("idx_appointment_reminders_user").on(table.userId),
  index("idx_appointment_reminders_appointment_date").on(table.appointmentDate),
  index("idx_appointment_reminders_scheduled_send").on(table.scheduledSendTime),
  index("idx_appointment_reminders_status").on(table.status),
  index("idx_appointment_reminders_booking_ref").on(table.bookingReference),
]);

// Enhanced Communication Logs (extends existing crmCommunications)
export const crmCommunicationLogs = pgTable("crm_communication_logs", {
  id: serial("id").primaryKey(),
  
  // Reference to original communication
  communicationId: integer("communication_id").references(() => crmCommunications.id).notNull(),
  
  // Template references (if communication used templates)
  emailTemplateId: integer("email_template_id").references(() => crmEmailTemplates.id),
  smsTemplateId: integer("sms_template_id").references(() => crmSmsTemplates.id),
  
  // Delivery tracking
  deliveryStatus: varchar("delivery_status").default("pending"), // pending, sent, delivered, failed, bounced
  deliveryProvider: varchar("delivery_provider"), // sendgrid, twilio, etc.
  externalMessageId: varchar("external_message_id"), // Provider's message ID
  
  // Engagement tracking (for emails)
  opened: boolean("opened").default(false),
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").default(0),
  clicked: boolean("clicked").default(false),
  clickedAt: timestamp("clicked_at"),
  clickCount: integer("click_count").default(0),
  
  // Response tracking
  replied: boolean("replied").default(false),
  repliedAt: timestamp("replied_at"),
  
  // Error details
  errorMessage: text("error_message"),
  errorCode: varchar("error_code"),
  
  // Cost tracking (for SMS)
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_communication_logs_communication").on(table.communicationId),
  index("idx_communication_logs_delivery_status").on(table.deliveryStatus),
  index("idx_communication_logs_opened").on(table.opened),
  index("idx_communication_logs_clicked").on(table.clicked),
]);

// =================== COMMUNICATION CENTER TYPES ===================

// Email Template types
export type CrmEmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type InsertCrmEmailTemplate = typeof crmEmailTemplates.$inferInsert;

// SMS Template types
export type CrmSmsTemplate = typeof crmSmsTemplates.$inferSelect;
export type InsertCrmSmsTemplate = typeof crmSmsTemplates.$inferInsert;

// Appointment Reminder types
export type CrmAppointmentReminder = typeof crmAppointmentReminders.$inferSelect;
export type InsertCrmAppointmentReminder = typeof crmAppointmentReminders.$inferInsert;

// Communication Log types
export type CrmCommunicationLog = typeof crmCommunicationLogs.$inferSelect;
export type InsertCrmCommunicationLog = typeof crmCommunicationLogs.$inferInsert;

// =================== COMMUNICATION CENTER ZOD SCHEMAS ===================

// Email Template schemas
export const insertCrmEmailTemplateSchema = createInsertSchema(crmEmailTemplates).omit({
  id: true,
  timesUsed: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmEmailTemplateSchema = insertCrmEmailTemplateSchema.partial();

// SMS Template schemas
export const insertCrmSmsTemplateSchema = createInsertSchema(crmSmsTemplates).omit({
  id: true,
  timesUsed: true,
  lastUsed: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmSmsTemplateSchema = insertCrmSmsTemplateSchema.partial();

// Appointment Reminder schemas
export const insertCrmAppointmentReminderSchema = createInsertSchema(crmAppointmentReminders).omit({
  id: true,
  emailSent: true,
  smsSent: true,
  emailDelivered: true,
  smsDelivered: true,
  emailSentAt: true,
  smsSentAt: true,
  emailDeliveredAt: true,
  smsDeliveredAt: true,
  lastError: true,
  retryCount: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmAppointmentReminderSchema = insertCrmAppointmentReminderSchema.partial();

// Communication Log schemas
export const insertCrmCommunicationLogSchema = createInsertSchema(crmCommunicationLogs).omit({
  id: true,
  opened: true,
  openedAt: true,
  openCount: true,
  clicked: true,
  clickedAt: true,
  clickCount: true,
  replied: true,
  repliedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCrmCommunicationLogSchema = insertCrmCommunicationLogSchema.partial();

// Enhanced validation schemas for communication center
export const emailTemplateCreationSchema = insertCrmEmailTemplateSchema.extend({
  name: z.string().min(1, "Template name is required").max(100, "Name must be less than 100 characters"),
  category: z.enum(["welcome", "appointment_confirmation", "follow_up", "promotion", "reminder", "newsletter"]),
  subject: z.string().min(1, "Email subject is required").max(200, "Subject must be less than 200 characters"),
  htmlContent: z.string().min(1, "Email content is required"),
});

export const smsTemplateCreationSchema = insertCrmSmsTemplateSchema.extend({
  name: z.string().min(1, "Template name is required").max(100, "Name must be less than 100 characters"),
  category: z.enum(["appointment_reminder", "promotion", "follow_up", "confirmation", "alert"]),
  content: z.string().min(1, "SMS content is required").max(160, "SMS content must be 160 characters or less"),
  characterCount: z.number().min(1).max(160),
});

export const appointmentReminderCreationSchema = insertCrmAppointmentReminderSchema.extend({
  bookingReference: z.string().min(1, "Booking reference is required"),
  appointmentDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid appointment date"),
  appointmentType: z.enum(["wash_appointment", "consultation", "follow_up"]),
  reminderType: z.enum(["email", "sms", "both"]),
  reminderTiming: z.enum(["24h", "2h", "1h", "30m"]),
  reminderOffsetMinutes: z.number().min(1).max(1440), // 1 minute to 24 hours
});

// Legal Compliance Tracking (Annual Israeli Law Review)
export const legalDocumentVersions = pgTable("legal_document_versions", {
  id: serial("id").primaryKey(),
  documentType: varchar("document_type").notNull(), // terms_conditions, privacy_policy
  version: varchar("version").notNull(), // e.g., "2025-10-19", "2026-01-15"
  content: text("content"), // Optional: store full document snapshot
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // admin user ID
  changesSummary: text("changes_summary"), // Summary of what changed
  israeliLawCompliant: boolean("israeli_law_compliant").default(true),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const legalComplianceReviews = pgTable("legal_compliance_reviews", {
  id: serial("id").primaryKey(),
  documentType: varchar("document_type").notNull(), // terms_conditions, privacy_policy
  reviewDate: timestamp("review_date").notNull().defaultNow(),
  nextReviewDue: timestamp("next_review_due").notNull(), // Auto-set to +1 year
  reviewStatus: varchar("review_status").notNull().default("pending"), // pending, in_progress, completed, overdue
  israeliLawChanges: text("israeli_law_changes"), // Notes on any Israeli law updates
  actionRequired: boolean("action_required").default(false),
  actionNotes: text("action_notes"),
  reviewedBy: varchar("reviewed_by"), // admin user ID
  reminderSentAt: timestamp("reminder_sent_at"), // Track when reminder emails were sent
  reminderCount: integer("reminder_count").default(0),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Interaction Tracking (All Clicks, Inputs, Typing)
export const userInteractionLogs = pgTable("user_interaction_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"), // NULL for anonymous/pre-auth interactions
  sessionId: varchar("session_id").notNull(), // Track across sessions
  interactionType: varchar("interaction_type").notNull(), // click, input, submit, keystroke, scroll, focus, blur
  elementType: varchar("element_type"), // button, input, link, select, textarea, etc.
  elementId: varchar("element_id"), // HTML element ID or data-testid
  elementPath: text("element_path"), // DOM path (e.g., "header > nav > button")
  elementText: varchar("element_text"), // Button text or label
  page: varchar("page").notNull(), // Current page/route
  inputValue: text("input_value"), // For input fields (PII-safe, encrypted if needed)
  keystroke: varchar("keystroke"), // Individual keystroke (for typing analysis)
  clickCoordinates: jsonb("click_coordinates"), // {x: number, y: number}
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  userAgent: varchar("user_agent"),
  ipAddress: varchar("ip_address"),
  metadata: jsonb("metadata"), // Additional context
});

// Schemas for legal compliance tracking
export const insertLegalDocumentVersionSchema = createInsertSchema(legalDocumentVersions).omit({
  id: true,
  createdAt: true,
});

export const insertLegalComplianceReviewSchema = createInsertSchema(legalComplianceReviews).omit({
  id: true,
  createdAt: true,
});

export const insertUserInteractionLogSchema = createInsertSchema(userInteractionLogs).omit({
  id: true,
  timestamp: true,
});

export type LegalDocumentVersion = typeof legalDocumentVersions.$inferSelect;
export type LegalComplianceReview = typeof legalComplianceReviews.$inferSelect;
export type UserInteractionLog = typeof userInteractionLogs.$inferSelect;


// =================== SUBSCRIPTION BOX SERVICE ===================

// Product catalog for subscription boxes
export const subscriptionProducts = pgTable("subscription_products", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  nameHe: varchar("name_he").notNull(),
  description: text("description"),
  descriptionHe: text("description_he"),
  category: varchar("category").notNull(), // food, treats, toys, grooming, health, accessories
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: varchar("image_url"),
  brand: varchar("brand"),
  petType: varchar("pet_type"), // dog, cat, both
  ageGroup: varchar("age_group"), // puppy, adult, senior, all
  sizeGroup: varchar("size_group"), // small, medium, large, all
  tags: jsonb("tags"), // Array of tags for AI matching: ["organic", "grain-free", "dental", etc]
  isActive: boolean("is_active").default(true),
  stockQuantity: integer("stock_quantity").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription box tiers (Basic, Premium, Deluxe)
export const subscriptionBoxTypes = pgTable("subscription_box_types", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(), // Basic, Premium, Deluxe
  nameHe: varchar("name_he").notNull(),
  description: text("description"),
  descriptionHe: text("description_he"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  itemCount: integer("item_count").notNull(), // Number of items per box
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  features: jsonb("features"), // Array of feature strings
  featuresHe: jsonb("features_he"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer active subscriptions
export const customerSubscriptions = pgTable("customer_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  boxTypeId: integer("box_type_id").references(() => subscriptionBoxTypes.id).notNull(),
  status: varchar("status").notNull().default("active"), // active, paused, cancelled, expired
  frequency: varchar("frequency").notNull().default("monthly"), // monthly, bimonthly, quarterly
  startDate: timestamp("start_date").notNull().defaultNow(),
  nextShipmentDate: timestamp("next_shipment_date"),
  lastShipmentDate: timestamp("last_shipment_date"),
  cancelledAt: timestamp("cancelled_at"),
  pausedAt: timestamp("paused_at"),
  pauseReason: text("pause_reason"),
  cancelReason: text("cancel_reason"),
  petProfile: jsonb("pet_profile"), // {petType, age, size, breed, preferences, allergies}
  deliveryAddress: jsonb("delivery_address"),
  totalShipments: integer("total_shipments").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shipment history - what was sent each month
export const subscriptionShipments = pgTable("subscription_shipments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => customerSubscriptions.id).notNull(),
  boxTypeId: integer("box_type_id").references(() => subscriptionBoxTypes.id).notNull(),
  status: varchar("status").notNull().default("pending"), // pending, packed, shipped, delivered, returned
  shipmentDate: timestamp("shipment_date"),
  deliveryDate: timestamp("delivery_date"),
  trackingNumber: varchar("tracking_number"),
  products: jsonb("products").notNull(), // Array of {productId, quantity, price}
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  aiGenerated: boolean("ai_generated").default(false), // Was this curated by AI?
  customerRating: integer("customer_rating"), // 1-5 stars
  customerFeedback: text("customer_feedback"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI product recommendation history
export const aiProductRecommendations = pgTable("ai_product_recommendations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  subscriptionId: integer("subscription_id").references(() => customerSubscriptions.id),
  shipmentId: integer("shipment_id").references(() => subscriptionShipments.id),
  petProfile: jsonb("pet_profile").notNull(), // Pet details used for recommendation
  recommendedProducts: jsonb("recommended_products").notNull(), // Array of product IDs with scores
  aiReasoning: text("ai_reasoning"), // Why these products were suggested
  aiModel: varchar("ai_model").default("gemini-2.5-flash"), // Which AI model was used
  accepted: boolean("accepted"), // Did customer accept the suggestions?
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas for subscription products
export const insertSubscriptionProductSchema = createInsertSchema(subscriptionProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSubscriptionProductSchema = insertSubscriptionProductSchema.partial();

// Schemas for subscription box types
export const insertSubscriptionBoxTypeSchema = createInsertSchema(subscriptionBoxTypes).omit({
  id: true,
  createdAt: true,
});

export const updateSubscriptionBoxTypeSchema = insertSubscriptionBoxTypeSchema.partial();

// Schemas for customer subscriptions
export const insertCustomerSubscriptionSchema = createInsertSchema(customerSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomerSubscriptionSchema = insertCustomerSubscriptionSchema.partial();

// Schemas for subscription shipments
export const insertSubscriptionShipmentSchema = createInsertSchema(subscriptionShipments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSubscriptionShipmentSchema = insertSubscriptionShipmentSchema.partial();

// Schemas for AI recommendations
export const insertAiProductRecommendationSchema = createInsertSchema(aiProductRecommendations).omit({
  id: true,
  createdAt: true,
});

export const updateAiProductRecommendationSchema = insertAiProductRecommendationSchema.partial();

// TypeScript types
export type SubscriptionProduct = typeof subscriptionProducts.$inferSelect;
export type SubscriptionBoxType = typeof subscriptionBoxTypes.$inferSelect;
export type CustomerSubscription = typeof customerSubscriptions.$inferSelect;
export type SubscriptionShipment = typeof subscriptionShipments.$inferSelect;
export type AiProductRecommendation = typeof aiProductRecommendations.$inferSelect;

// =================== ISRAELI ACCOUNTING & TAX COMPLIANCE ===================

// Business expenses tracking for tax deductions
export const israeliExpenses = pgTable("israeli_expenses", {
  id: serial("id").primaryKey(),
  expenseId: varchar("expense_id").unique().notNull(), // EXP-YYYY-MMMM-NNNN
  
  // Expense details
  category: varchar("category").notNull(), // salaries, utilities, supplies, marketing, rent, maintenance, professional_services, equipment, insurance, other
  subcategory: varchar("subcategory"),
  description: text("description").notNull(),
  vendor: varchar("vendor").notNull(),
  
  // Financial details
  amountBeforeVat: decimal("amount_before_vat", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default("0.18"), // Current Israeli VAT 18%
  
  // Payment details
  paymentMethod: varchar("payment_method").notNull(), // bank_transfer, credit_card, cash, check
  receiptNumber: varchar("receipt_number"),
  invoiceNumber: varchar("invoice_number"),
  receiptUrl: text("receipt_url"), // Document storage URL
  
  // Tax compliance
  isDeductible: boolean("is_deductible").default(true),
  deductionPercentage: integer("deduction_percentage").default(100), // Some expenses partially deductible
  taxYear: integer("tax_year").notNull(),
  taxMonth: integer("tax_month").notNull(), // 1-12
  
  // Approval workflow
  status: varchar("status").default("pending"), // pending, approved, rejected
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  notes: text("notes"),
  attachments: text("attachments").array(),
  createdBy: varchar("created_by").references(() => adminUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_israeli_expenses_year_month").on(table.taxYear, table.taxMonth),
  index("idx_israeli_expenses_category").on(table.category),
  index("idx_israeli_expenses_status").on(table.status),
]);

// Monthly VAT declarations (מע"מ - דוח חודשי)
export const israeliVatDeclarations = pgTable("israeli_vat_declarations", {
  id: serial("id").primaryKey(),
  declarationId: varchar("declaration_id").unique().notNull(), // VAT-YYYY-MM
  
  // Reporting period
  taxYear: integer("tax_year").notNull(),
  taxMonth: integer("tax_month").notNull(), // 1-12
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Revenue (output VAT - מע"מ עסקאות)
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).notNull(),
  totalOutputVat: decimal("total_output_vat", { precision: 12, scale: 2 }).notNull(),
  transactionCount: integer("transaction_count").default(0),
  
  // Expenses (input VAT - מע"מ תשומות)
  totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }).notNull(),
  totalInputVat: decimal("total_input_vat", { precision: 12, scale: 2 }).notNull(),
  expenseCount: integer("expense_count").default(0),
  
  // Calculation
  netVatPayable: decimal("net_vat_payable", { precision: 12, scale: 2 }).notNull(), // output - input
  vatRefundDue: decimal("vat_refund_due", { precision: 12, scale: 2 }).default("0"),
  
  // Form 1206 compliance
  form1206Data: jsonb("form_1206_data"), // Complete form data structure
  domesticSales: decimal("domestic_sales", { precision: 12, scale: 2 }).default("0"),
  exportSales: decimal("export_sales", { precision: 12, scale: 2 }).default("0"),
  zeroRatedSales: decimal("zero_rated_sales", { precision: 12, scale: 2 }).default("0"),
  
  // Submission tracking
  status: varchar("status").default("draft"), // draft, pending_review, approved, submitted, filed
  preparedBy: varchar("prepared_by").references(() => adminUsers.id).notNull(),
  preparedAt: timestamp("prepared_at").defaultNow(),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  submittedToAccountant: boolean("submitted_to_accountant").default(false),
  submittedAt: timestamp("submitted_at"),
  filedWithAuthority: boolean("filed_with_authority").default(false),
  filingDate: date("filing_date"),
  filingReferenceNumber: varchar("filing_reference_number"),
  
  // Export tracking
  excelReportUrl: text("excel_report_url"),
  pdfReportUrl: text("pdf_report_url"),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_israeli_vat_year_month").on(table.taxYear, table.taxMonth),
  index("idx_israeli_vat_status").on(table.status),
]);

// Monthly income tax declarations (מס הכנסה - דיווח חודשי)
export const israeliIncomeTaxDeclarations = pgTable("israeli_income_tax_declarations", {
  id: serial("id").primaryKey(),
  declarationId: varchar("declaration_id").unique().notNull(), // INCOME-YYYY-MM
  
  // Reporting period
  taxYear: integer("tax_year").notNull(),
  taxMonth: integer("tax_month").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Income
  grossIncome: decimal("gross_income", { precision: 12, scale: 2 }).notNull(),
  netIncome: decimal("net_income", { precision: 12, scale: 2 }).notNull(),
  
  // Deductions
  totalDeductibleExpenses: decimal("total_deductible_expenses", { precision: 12, scale: 2 }).default("0"),
  salaryExpenses: decimal("salary_expenses", { precision: 12, scale: 2 }).default("0"),
  operatingExpenses: decimal("operating_expenses", { precision: 12, scale: 2 }).default("0"),
  depreciation: decimal("depreciation", { precision: 12, scale: 2 }).default("0"),
  otherDeductions: decimal("other_deductions", { precision: 12, scale: 2 }).default("0"),
  
  // Taxable income
  taxableIncome: decimal("taxable_income", { precision: 12, scale: 2 }).notNull(),
  estimatedTax: decimal("estimated_tax", { precision: 12, scale: 2 }).default("0"),
  
  // Submission tracking
  status: varchar("status").default("draft"),
  preparedBy: varchar("prepared_by").references(() => adminUsers.id).notNull(),
  preparedAt: timestamp("prepared_at").defaultNow(),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  submittedToAccountant: boolean("submitted_to_accountant").default(false),
  submittedAt: timestamp("submitted_at"),
  filedWithAuthority: boolean("filed_with_authority").default(false),
  filingDate: date("filing_date"),
  
  // Export tracking
  excelReportUrl: text("excel_report_url"),
  pdfReportUrl: text("pdf_report_url"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_israeli_income_year_month").on(table.taxYear, table.taxMonth),
  index("idx_israeli_income_status").on(table.status),
]);

// National Insurance declarations (ביטוח לאומי - דיווח חודשי)
export const israeliNationalInsuranceDeclarations = pgTable("israeli_national_insurance_declarations", {
  id: serial("id").primaryKey(),
  declarationId: varchar("declaration_id").unique().notNull(), // BTLMI-YYYY-MM
  
  // Reporting period
  taxYear: integer("tax_year").notNull(),
  taxMonth: integer("tax_month").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Employee data
  totalEmployees: integer("total_employees").default(0),
  totalGrossSalary: decimal("total_gross_salary", { precision: 12, scale: 2 }).default("0"),
  
  // Insurance calculations
  employerContribution: decimal("employer_contribution", { precision: 12, scale: 2 }).default("0"),
  employeeContribution: decimal("employee_contribution", { precision: 12, scale: 2 }).default("0"),
  totalContribution: decimal("total_contribution", { precision: 12, scale: 2 }).default("0"),
  
  // Self-employed owner contributions
  ownerIncome: decimal("owner_income", { precision: 12, scale: 2 }).default("0"),
  ownerContribution: decimal("owner_contribution", { precision: 12, scale: 2 }).default("0"),
  
  // Submission tracking
  status: varchar("status").default("draft"),
  preparedBy: varchar("prepared_by").references(() => adminUsers.id).notNull(),
  preparedAt: timestamp("prepared_at").defaultNow(),
  reviewedBy: varchar("reviewed_by").references(() => adminUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  submittedToAccountant: boolean("submitted_to_accountant").default(false),
  submittedAt: timestamp("submitted_at"),
  filedWithAuthority: boolean("filed_with_authority").default(false),
  filingDate: date("filing_date"),
  
  // Export tracking
  excelReportUrl: text("excel_report_url"),
  pdfReportUrl: text("pdf_report_url"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_israeli_natins_year_month").on(table.taxYear, table.taxMonth),
  index("idx_israeli_natins_status").on(table.status),
]);

// Complete monthly financial package for accountant
// Electronic Invoices (חשבוניות אלקטרוניות) - ITA Direct Submission
export const electronicInvoices = pgTable("electronic_invoices", {
  id: serial("id").primaryKey(),
  invoiceId: varchar("invoice_id").unique().notNull(), // INV-YYYY-MMDD-NNNN
  
  // Transaction source
  serviceType: varchar("service_type").notNull(), // k9000_wash, sitter_suite, walk_my_pet, pettrek_transport
  transactionId: varchar("transaction_id"), // Original transaction ID
  
  // Invoice details
  invoiceNumber: varchar("invoice_number").unique().notNull(),
  invoiceDate: timestamp("invoice_date").defaultNow(),
  invoiceType: varchar("invoice_type").notNull(), // B2B, B2C
  
  // Customer information
  customerTaxId: varchar("customer_tax_id"), // ח.פ. or ע.מ. (required for B2B ≥ ₪25,000)
  customerName: varchar("customer_name").notNull(),
  customerEmail: varchar("customer_email"),
  customerPhone: varchar("customer_phone"),
  customerAddress: text("customer_address"),
  
  // Financial details
  amountBeforeVat: decimal("amount_before_vat", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 4 }).default("0.18"), // 18%
  currency: varchar("currency").default("ILS"),
  
  // Line items
  lineItems: jsonb("line_items").notNull(), // Array of invoice line items
  
  // Payment details
  paymentMethod: varchar("payment_method"), // credit_card, bank_transfer, cash, nayax
  paymentStatus: varchar("payment_status").default("paid"), // paid, pending, cancelled
  
  // ITA Submission (Israeli Tax Authority Direct API)
  itaSubmissionStatus: varchar("ita_submission_status").default("pending"), // pending, submitted, accepted, rejected, error
  itaReferenceNumber: varchar("ita_reference_number"), // Reference from ITA API
  itaSubmittedAt: timestamp("ita_submitted_at"),
  itaResponse: jsonb("ita_response"), // Full response from ITA API
  itaErrorMessage: text("ita_error_message"),
  
  // Compliance flags
  requiresElectronicInvoicing: boolean("requires_electronic_invoicing").default(false), // true if B2B ≥ ₪25,000
  complianceStatus: varchar("compliance_status").default("compliant"), // compliant, warning, non_compliant
  complianceNotes: text("compliance_notes"),
  
  // Metadata
  createdBy: varchar("created_by"), // User/admin who created
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const israeliMonthlyFinancialPackages = pgTable("israeli_monthly_financial_packages", {
  id: serial("id").primaryKey(),
  packageId: varchar("package_id").unique().notNull(), // FIN-PKG-YYYY-MM
  
  // Reporting period
  taxYear: integer("tax_year").notNull(),
  taxMonth: integer("tax_month").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Reference to individual declarations
  vatDeclarationId: varchar("vat_declaration_id").references(() => israeliVatDeclarations.declarationId),
  incomeTaxDeclarationId: varchar("income_tax_declaration_id").references(() => israeliIncomeTaxDeclarations.declarationId),
  nationalInsuranceDeclarationId: varchar("national_insurance_declaration_id").references(() => israeliNationalInsuranceDeclarations.declarationId),
  
  // Summary financials
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).notNull(),
  totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }).notNull(),
  netProfit: decimal("net_profit", { precision: 12, scale: 2 }).notNull(),
  
  // Package status
  status: varchar("status").default("in_progress"), // in_progress, ready_for_review, approved, sent_to_accountant
  
  // Complete export package
  masterExcelUrl: text("master_excel_url"), // All-in-one Excel workbook
  masterPdfUrl: text("master_pdf_url"), // Complete PDF package
  transactionDetailsUrl: text("transaction_details_url"), // Detailed transaction CSV
  expenseDetailsUrl: text("expense_details_url"), // Detailed expense CSV
  
  // Accountant submission
  accountantEmail: varchar("accountant_email"),
  sentToAccountantAt: timestamp("sent_to_accountant_at"),
  accountantConfirmedReceipt: boolean("accountant_confirmed_receipt").default(false),
  accountantNotes: text("accountant_notes"),
  
  // Authority filing tracking
  vatFiled: boolean("vat_filed").default(false),
  incomeTaxFiled: boolean("income_tax_filed").default(false),
  nationalInsuranceFiled: boolean("national_insurance_filed").default(false),
  allFilingsComplete: boolean("all_filings_complete").default(false),
  
  // Metadata
  preparedBy: varchar("prepared_by").references(() => adminUsers.id).notNull(),
  preparedAt: timestamp("prepared_at").defaultNow(),
  finalApprovedBy: varchar("final_approved_by").references(() => adminUsers.id),
  finalApprovedAt: timestamp("final_approved_at"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_israeli_fin_pkg_year_month").on(table.taxYear, table.taxMonth),
  index("idx_israeli_fin_pkg_status").on(table.status),
]);

// TypeScript types for Israeli accounting
export type IsraeliExpense = typeof israeliExpenses.$inferSelect;
export type InsertIsraeliExpense = typeof israeliExpenses.$inferInsert;
export type IsraeliVatDeclaration = typeof israeliVatDeclarations.$inferSelect;
export type InsertIsraeliVatDeclaration = typeof israeliVatDeclarations.$inferInsert;
export type IsraeliIncomeTaxDeclaration = typeof israeliIncomeTaxDeclarations.$inferSelect;
export type InsertIsraeliIncomeTaxDeclaration = typeof israeliIncomeTaxDeclarations.$inferInsert;
export type IsraeliNationalInsuranceDeclaration = typeof israeliNationalInsuranceDeclarations.$inferSelect;
export type InsertIsraeliNationalInsuranceDeclaration = typeof israeliNationalInsuranceDeclarations.$inferInsert;
export type IsraeliMonthlyFinancialPackage = typeof israeliMonthlyFinancialPackages.$inferSelect;
export type InsertIsraeliMonthlyFinancialPackage = typeof israeliMonthlyFinancialPackages.$inferInsert;

// Insert schemas with validation
export const insertIsraeliExpenseSchema = createInsertSchema(israeliExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIsraeliVatDeclarationSchema = createInsertSchema(israeliVatDeclarations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIsraeliIncomeTaxDeclarationSchema = createInsertSchema(israeliIncomeTaxDeclarations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIsraeliNationalInsuranceDeclarationSchema = createInsertSchema(israeliNationalInsuranceDeclarations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIsraeliMonthlyFinancialPackageSchema = createInsertSchema(israeliMonthlyFinancialPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =================== BANK RECONCILIATION SYSTEM (Mizrahi-Tefahot Bank) ===================

// Bank Accounts
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  accountNumber: varchar("account_number").unique().notNull(),
  accountName: varchar("account_name").notNull(),
  accountNameHe: varchar("account_name_he"),
  bankName: varchar("bank_name").notNull().default("Mizrahi-Tefahot Bank"),
  bankNameHe: varchar("bank_name_he").default("בנק מזרחי טפחות"),
  branchName: varchar("branch_name").notNull().default("Poleg"),
  branchCode: varchar("branch_code"),
  swift: varchar("swift").default("MIZBILIT"),
  iban: varchar("iban"),
  currency: varchar("currency").default("ILS"),
  accountType: varchar("account_type").default("business"), // business, savings, etc.
  isActive: boolean("is_active").default(true),
  openedAt: date("opened_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank Transactions (imported from CSV/Excel)
export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => bankAccounts.id).notNull(),
  
  // Transaction details
  transactionDate: date("transaction_date").notNull(),
  valueDate: date("value_date"),
  description: text("description").notNull(),
  descriptionHe: text("description_he"),
  referenceNumber: varchar("reference_number"),
  
  // Amounts
  debitAmount: decimal("debit_amount", { precision: 12, scale: 2 }).default("0"),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 2 }).default("0"),
  balance: decimal("balance", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("ILS"),
  
  // Categorization
  category: varchar("category"), // payment_received, expense, transfer, fee, etc.
  subcategory: varchar("subcategory"),
  
  // Reconciliation
  reconciliationStatus: varchar("reconciliation_status").default("unmatched"), // unmatched, matched, manually_matched, ignored
  matchedTransactionId: integer("matched_transaction_id"), // Link to transactionRecords or israeliExpenses
  matchedEntityType: varchar("matched_entity_type"), // nayax_transaction, expense, manual
  matchConfidence: integer("match_confidence"), // 0-100 score
  
  // Import tracking
  importBatchId: varchar("import_batch_id"),
  importedAt: timestamp("imported_at").defaultNow(),
  importedBy: varchar("imported_by").references(() => adminUsers.id),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bank_trans_account").on(table.accountId),
  index("idx_bank_trans_date").on(table.transactionDate),
  index("idx_bank_trans_status").on(table.reconciliationStatus),
  index("idx_bank_trans_batch").on(table.importBatchId),
]);

// Bank Import Batches (track CSV/Excel uploads)
export const bankImportBatches = pgTable("bank_import_batches", {
  id: serial("id").primaryKey(),
  batchId: varchar("batch_id").unique().notNull(),
  accountId: integer("account_id").references(() => bankAccounts.id).notNull(),
  
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(), // csv, xlsx, xls
  fileSize: integer("file_size"),
  
  // Import details
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  totalTransactions: integer("total_transactions").default(0),
  successfulImports: integer("successful_imports").default(0),
  failedImports: integer("failed_imports").default(0),
  duplicatesSkipped: integer("duplicates_skipped").default(0),
  
  // Processing
  status: varchar("status").default("processing"), // processing, completed, failed
  errorLog: text("error_log"),
  
  importedBy: varchar("imported_by").references(() => adminUsers.id).notNull(),
  importedAt: timestamp("imported_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_bank_import_account").on(table.accountId),
  index("idx_bank_import_status").on(table.status),
]);

// Bank Reconciliation Records (manual matching & adjustments)
export const bankReconciliations = pgTable("bank_reconciliations", {
  id: serial("id").primaryKey(),
  reconciliationId: varchar("reconciliation_id").unique().notNull(),
  
  bankTransactionId: integer("bank_transaction_id").references(() => bankTransactions.id).notNull(),
  matchedEntityId: integer("matched_entity_id").notNull(), // ID from transactionRecords or israeliExpenses
  matchedEntityType: varchar("matched_entity_type").notNull(), // nayax_transaction, expense
  
  // Match details
  matchType: varchar("match_type").notNull(), // automatic, manual, suggested
  matchConfidence: integer("match_confidence").notNull(), // 0-100
  
  // Amount reconciliation
  bankAmount: decimal("bank_amount", { precision: 12, scale: 2 }).notNull(),
  entityAmount: decimal("entity_amount", { precision: 12, scale: 2 }).notNull(),
  discrepancy: decimal("discrepancy", { precision: 12, scale: 2 }).default("0"),
  discrepancyReason: text("discrepancy_reason"),
  
  // Approval
  status: varchar("status").default("pending"), // pending, approved, rejected
  matchedBy: varchar("matched_by").references(() => adminUsers.id).notNull(),
  matchedAt: timestamp("matched_at").defaultNow(),
  approvedBy: varchar("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  
  notes: text("notes"),
}, (table) => [
  index("idx_bank_recon_bank_trans").on(table.bankTransactionId),
  index("idx_bank_recon_status").on(table.status),
]);

// Bank Reconciliation Summary (monthly overview)
export const bankReconciliationSummary = pgTable("bank_reconciliation_summary", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => bankAccounts.id).notNull(),
  
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Bank statement totals
  openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull(),
  closingBalance: decimal("closing_balance", { precision: 12, scale: 2 }).notNull(),
  totalDebits: decimal("total_debits", { precision: 12, scale: 2 }).default("0"),
  totalCredits: decimal("total_credits", { precision: 12, scale: 2 }).default("0"),
  
  // Reconciliation stats
  totalTransactions: integer("total_transactions").default(0),
  matchedTransactions: integer("matched_transactions").default(0),
  unmatchedTransactions: integer("unmatched_transactions").default(0),
  matchRate: decimal("match_rate", { precision: 5, scale: 2 }).default("0"), // percentage
  
  // Discrepancies
  totalDiscrepancies: decimal("total_discrepancies", { precision: 12, scale: 2 }).default("0"),
  unreconciledAmount: decimal("unreconciled_amount", { precision: 12, scale: 2 }).default("0"),
  
  status: varchar("status").default("in_progress"), // in_progress, completed, reviewed
  completedBy: varchar("completed_by").references(() => adminUsers.id),
  completedAt: timestamp("completed_at"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bank_summary_account").on(table.accountId),
  index("idx_bank_summary_period").on(table.year, table.month),
]);

// TypeScript types for Bank Reconciliation
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = typeof bankTransactions.$inferInsert;
export type BankImportBatch = typeof bankImportBatches.$inferSelect;
export type InsertBankImportBatch = typeof bankImportBatches.$inferInsert;
export type BankReconciliation = typeof bankReconciliations.$inferSelect;
export type InsertBankReconciliation = typeof bankReconciliations.$inferInsert;
export type BankReconciliationSummary = typeof bankReconciliationSummary.$inferSelect;
export type InsertBankReconciliationSummary = typeof bankReconciliationSummary.$inferInsert;

// Insert schemas with validation
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankImportBatchSchema = createInsertSchema(bankImportBatches).omit({
  id: true,
  importedAt: true,
});

export const insertBankReconciliationSchema = createInsertSchema(bankReconciliations).omit({
  id: true,
  matchedAt: true,
});

export const insertBankReconciliationSummarySchema = createInsertSchema(bankReconciliationSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =================== KIOSK / VENDING MACHINE SYSTEM (Future Expansion) ===================

// Kiosk Machines (healthy dog treat vending machines)
export const kioskMachines = pgTable("kiosk_machines", {
  id: serial("id").primaryKey(),
  kioskId: varchar("kiosk_id").unique().notNull(), // KIOSK-TLV-001
  
  // Basic info
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  location: varchar("location").notNull(),
  locationHe: varchar("location_he"),
  address: text("address"),
  
  // Geographic coordinates
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  // Machine details
  machineType: varchar("machine_type").notNull(), // BAX_BOX, MICRON_SMART, OTHER
  manufacturer: varchar("manufacturer"),
  model: varchar("model"),
  serialNumber: varchar("serial_number"),
  
  // Payment integration
  nayaxTerminalId: varchar("nayax_terminal_id").unique(),
  nayaxMerchantId: varchar("nayax_merchant_id"),
  qrReaderEnabled: boolean("qr_reader_enabled").default(true),
  
  // Capacity
  totalSlots: integer("total_slots").default(36),
  activeSlots: integer("active_slots").default(0),
  
  // Status
  status: varchar("status").default("planned"), // planned, installing, active, maintenance, offline, decommissioned
  isOnline: boolean("is_online").default(false),
  lastHeartbeat: timestamp("last_heartbeat"),
  
  // Operations
  installationDate: date("installation_date"),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  
  // Financials
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  totalTransactions: integer("total_transactions").default(0),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kiosk_status").on(table.status),
  index("idx_kiosk_terminal").on(table.nayaxTerminalId),
]);

// Kiosk Products (dog treats and accessories)
export const kioskProducts = pgTable("kiosk_products", {
  id: serial("id").primaryKey(),
  sku: varchar("sku").unique().notNull(),
  
  // Product details
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  
  category: varchar("category").notNull(), // treats, accessories, supplements
  subcategory: varchar("subcategory"),
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  
  // Product attributes
  brand: varchar("brand"),
  weight: varchar("weight"),
  ingredients: text("ingredients"),
  ingredientsHe: text("ingredients_he"),
  allergens: text("allergens"),
  allergensHe: text("allergens_he"),
  
  // Nutrition info
  caloriesPerServing: integer("calories_per_serving"),
  proteinPercent: decimal("protein_percent", { precision: 5, scale: 2 }),
  fatPercent: decimal("fat_percent", { precision: 5, scale: 2 }),
  
  // Inventory
  barcode: varchar("barcode"),
  supplierSku: varchar("supplier_sku"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isHealthy: boolean("is_healthy").default(true), // Marketing flag for "healthy treats"
  
  imageUrl: varchar("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kiosk_prod_category").on(table.category),
  index("idx_kiosk_prod_active").on(table.isActive),
]);

// Kiosk Inventory (per-machine stock levels)
export const kioskInventory = pgTable("kiosk_inventory", {
  id: serial("id").primaryKey(),
  kioskId: integer("kiosk_id").references(() => kioskMachines.id).notNull(),
  productId: integer("product_id").references(() => kioskProducts.id).notNull(),
  
  slotNumber: integer("slot_number").notNull(), // Physical slot in machine
  currentStock: integer("current_stock").default(0),
  maxCapacity: integer("max_capacity").default(10),
  minThreshold: integer("min_threshold").default(3), // Low stock alert threshold
  
  lastRestocked: timestamp("last_restocked"),
  restockedBy: varchar("restocked_by"),
  
  isLowStock: boolean("is_low_stock").default(false),
  isOutOfStock: boolean("is_out_of_stock").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kiosk_inv_kiosk").on(table.kioskId),
  index("idx_kiosk_inv_product").on(table.productId),
  index("idx_kiosk_inv_stock_status").on(table.isLowStock, table.isOutOfStock),
]);

// Kiosk Sales (transactions from vending machines)
export const kioskSales = pgTable("kiosk_sales", {
  id: serial("id").primaryKey(),
  saleId: varchar("sale_id").unique().notNull(),
  
  kioskId: integer("kiosk_id").references(() => kioskMachines.id).notNull(),
  productId: integer("product_id").references(() => kioskProducts.id).notNull(),
  
  // Transaction details
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Payment
  paymentMethod: varchar("payment_method").notNull(), // credit_card, qr_voucher, nfc
  nayaxTransactionId: varchar("nayax_transaction_id"),
  voucherCode: varchar("voucher_code"),
  
  // Status
  status: varchar("status").default("completed"), // pending, completed, failed, refunded
  
  // Customer (optional)
  customerEmail: varchar("customer_email"),
  customerPhone: varchar("customer_phone"),
  
  transactionDate: timestamp("transaction_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kiosk_sales_kiosk").on(table.kioskId),
  index("idx_kiosk_sales_product").on(table.productId),
  index("idx_kiosk_sales_date").on(table.transactionDate),
  index("idx_kiosk_sales_nayax").on(table.nayaxTransactionId),
]);

// TypeScript types for Kiosk System
export type KioskMachine = typeof kioskMachines.$inferSelect;
export type InsertKioskMachine = typeof kioskMachines.$inferInsert;
export type KioskProduct = typeof kioskProducts.$inferSelect;
export type InsertKioskProduct = typeof kioskProducts.$inferInsert;
export type KioskInventory = typeof kioskInventory.$inferSelect;
export type InsertKioskInventory = typeof kioskInventory.$inferInsert;
export type KioskSale = typeof kioskSales.$inferSelect;
export type InsertKioskSale = typeof kioskSales.$inferInsert;

// Insert schemas
export const insertKioskMachineSchema = createInsertSchema(kioskMachines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKioskProductSchema = createInsertSchema(kioskProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKioskInventorySchema = createInsertSchema(kioskInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKioskSaleSchema = createInsertSchema(kioskSales).omit({
  id: true,
  createdAt: true,
});

// Personalized loyalty campaign messages (confidential)
export const loyaltyCampaigns = pgTable("loyalty_campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  targetGroup: varchar("target_group").notNull(), // seniors, students, councils, disability, custom
  customCondition: text("custom_condition"), // JSON condition for advanced targeting
  messageEn: text("message_en").notNull(),
  messageHe: text("message_he").notNull(),
  specialDiscountPercent: integer("special_discount_percent"),
  isActive: boolean("is_active").default(true),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoyaltyCampaignSchema = createInsertSchema(loyaltyCampaigns);
export type InsertLoyaltyCampaign = z.infer<typeof insertLoyaltyCampaignSchema>;
export type SelectLoyaltyCampaign = typeof loyaltyCampaigns.$inferSelect;

// ==================== BLOCKCHAIN-STYLE AUDIT LEDGER ====================
// Immutable, cryptographically-chained audit trail for fraud prevention
// Similar to blockchain but optimized for Pet Wash™ operations

export const auditLedger = pgTable("audit_ledger", {
  id: serial("id").primaryKey(),
  
  // Chain integrity
  previousHash: text("previous_hash"), // Hash of previous record (null for genesis)
  currentHash: text("current_hash").notNull().unique(), // SHA-256 hash of this record
  blockNumber: integer("block_number").notNull().unique(), // Sequential block number (UNIQUE prevents forks)
  
  // Event data
  eventType: varchar("event_type").notNull(), // wallet_generated, voucher_redeemed, loyalty_updated, discount_used, package_redeemed
  userId: varchar("user_id").notNull(), // Who performed the action
  entityType: varchar("entity_type").notNull(), // voucher, loyalty_card, discount, wash_package, wallet_pass
  entityId: varchar("entity_id").notNull(), // ID of the entity being tracked
  
  // Transaction details
  action: varchar("action").notNull(), // created, updated, redeemed, deleted, generated
  previousState: jsonb("previous_state"), // State before change
  newState: jsonb("new_state").notNull(), // State after change
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`), // Additional context
  
  // Security & verification
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceId: varchar("device_id"),
  fraudScore: integer("fraud_score").default(0), // 0-100 risk score
  fraudSignals: jsonb("fraud_signals").default(sql`'[]'::jsonb`), // Array of fraud indicators
  
  // Timestamp (immutable)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  
  // Verification status
  verified: boolean("verified").default(true), // Hash chain verification status
  verifiedAt: timestamp("verified_at"),
}, (table) => [
  index("idx_audit_user").on(table.userId),
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_event").on(table.eventType),
  index("idx_audit_created").on(table.createdAt),
  index("idx_audit_block").on(table.blockNumber),
]);

export const insertAuditLedgerSchema = createInsertSchema(auditLedger, {
  eventType: z.enum(['wallet_generated', 'voucher_redeemed', 'loyalty_updated', 'discount_used', 'package_redeemed', 'points_earned', 'points_spent', 'tier_changed']),
  entityType: z.enum(['voucher', 'loyalty_card', 'discount', 'wash_package', 'wallet_pass', 'points']),
  action: z.enum(['created', 'updated', 'redeemed', 'deleted', 'generated', 'earned', 'spent', 'upgraded']),
}).omit({ id: true, createdAt: true, verifiedAt: true });

export type InsertAuditLedger = z.infer<typeof insertAuditLedgerSchema>;
export type AuditLedger = typeof auditLedger.$inferSelect;

// Voucher redemption tracking (prevent double-spend)
export const voucherRedemptions = pgTable("voucher_redemptions", {
  id: serial("id").primaryKey(),
  voucherId: varchar("voucher_id").notNull().unique(), // 🔒 UNIQUE: Prevents double-redemption by anyone
  userId: varchar("user_id").notNull(),
  redemptionCode: text("redemption_code").notNull().unique(), // One-time use token
  auditLedgerId: integer("audit_ledger_id").references(() => auditLedger.id), // Link to audit chain
  
  // Transaction details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  stationId: varchar("station_id"),
  franchiseId: varchar("franchise_id"),
  
  // Verification
  redemptionHash: text("redemption_hash").notNull().unique(), // Hash to prevent duplicates
  verified: boolean("verified").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_voucher_redemption_user").on(table.userId),
  index("idx_voucher_redemption_code").on(table.redemptionCode),
]);

export const insertVoucherRedemptionSchema = createInsertSchema(voucherRedemptions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertVoucherRedemption = z.infer<typeof insertVoucherRedemptionSchema>;
export type VoucherRedemption = typeof voucherRedemptions.$inferSelect;

// Discount usage tracking (one-time use enforcement)
export const discountUsageLog = pgTable("discount_usage_log", {
  id: serial("id").primaryKey(),
  discountCode: varchar("discount_code").notNull(),
  userId: varchar("user_id").notNull(),
  usageToken: text("usage_token").notNull().unique(), // One-time use token
  auditLedgerId: integer("audit_ledger_id").references(() => auditLedger.id),
  
  // Transaction details
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }).notNull(),
  stationId: varchar("station_id"),
  
  // Verification
  usageHash: text("usage_hash").notNull().unique(),
  verified: boolean("verified").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // 🔒 UNIQUE CONSTRAINT: Prevents race condition - each user can only use a discount code once
  uniqueIndex("idx_discount_usage_unique").on(table.discountCode, table.userId),
  index("idx_discount_usage_token").on(table.usageToken),
]);

export const insertDiscountUsageLogSchema = createInsertSchema(discountUsageLog).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertDiscountUsageLog = z.infer<typeof insertDiscountUsageLogSchema>;
export type DiscountUsageLog = typeof discountUsageLog.$inferSelect;

// Merkle root daily snapshots (for tamper-proof verification)
export const merkleSnapshots = pgTable("merkle_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull().unique(),
  startBlockNumber: integer("start_block_number").notNull(),
  endBlockNumber: integer("end_block_number").notNull(),
  merkleRoot: text("merkle_root").notNull(), // Root hash of all records in this period
  recordCount: integer("record_count").notNull(),
  verified: boolean("verified").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_merkle_date").on(table.snapshotDate),
]);

export const insertMerkleSnapshotSchema = createInsertSchema(merkleSnapshots).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertMerkleSnapshot = z.infer<typeof insertMerkleSnapshotSchema>;
export type MerkleSnapshot = typeof merkleSnapshots.$inferSelect;

// ==================== APPLE-STYLE DEVICE MONITORING SYSTEM ====================
// Track user devices for fraud prevention and security monitoring

export const userDevices = pgTable("user_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Device identification
  deviceLabel: varchar("device_label"), // User-friendly name (e.g., "Nir's iPhone 15 Pro")
  deviceFingerprint: text("device_fingerprint").notNull().unique(), // Deterministic hash of device characteristics
  platform: varchar("platform").notNull(), // iOS, Android, Windows, macOS, Linux
  browser: varchar("browser"), // Chrome, Safari, Firefox, Edge
  osVersion: varchar("os_version"),
  browserVersion: varchar("browser_version"),
  
  // WebAuthn integration
  webauthnCredentialId: text("webauthn_credential_id"), // Link to passkey credential
  
  // Network information
  ipAddress: varchar("ip_address"),
  ipLocation: jsonb("ip_location"), // {city, country, region, lat, lng}
  wifiSsidEncrypted: text("wifi_ssid_encrypted"), // Encrypted WiFi network name
  wifiBssidHash: text("wifi_bssid_hash"), // Hashed WiFi MAC address
  
  // Activity tracking
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastIpChangeAt: timestamp("last_ip_change_at", { withTimezone: true }),
  lastGeoChangeAt: timestamp("last_geo_change_at", { withTimezone: true }),
  sessionCount: integer("session_count").default(1).notNull(),
  
  // Trust & fraud scoring
  trustScore: integer("trust_score").default(50).notNull(), // 0-100 (50 = neutral)
  fraudFlags: jsonb("fraud_flags").default(sql`'[]'::jsonb`), // Array of fraud indicators
  
  // Status
  isCurrentDevice: boolean("is_current_device").default(false),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedReason: varchar("revoked_reason"), // user_dismissed, suspicious_activity, security_breach
  
  // Metadata
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`), // Additional device info
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_user_devices_user").on(table.userId),
  index("idx_user_devices_revoked").on(table.revokedAt),
  index("idx_user_devices_last_seen").on(table.userId, table.lastSeenAt),
  index("idx_user_devices_fingerprint").on(table.deviceFingerprint),
  index("idx_user_devices_trust_score").on(table.trustScore),
]);

export const insertUserDeviceSchema = createInsertSchema(userDevices, {
  platform: z.enum(['iOS', 'Android', 'Windows', 'macOS', 'Linux', 'Unknown']),
  trustScore: z.number().min(0).max(100).default(50),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  firstSeenAt: true,
});
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;
export type UserDevice = typeof userDevices.$inferSelect;

// Device events append-only audit log (7-year retention)
export const userDeviceEvents = pgTable("user_device_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => userDevices.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  auditLedgerId: integer("audit_ledger_id").references(() => auditLedger.id), // Link to blockchain audit
  
  // Event details
  eventType: varchar("event_type").notNull(), // device_added, device_renamed, device_trusted, device_revoked, login_success, login_failed, suspicious_activity, ip_changed, geo_changed
  action: varchar("action").notNull(), // login, logout, revoke, update, trust
  
  // Device state snapshot
  ipAddress: varchar("ip_address"),
  location: jsonb("location"), // Geolocation at time of event
  fraudScore: integer("fraud_score").default(0), // 0-100 risk score at time of event
  fraudSignals: jsonb("fraud_signals").default(sql`'[]'::jsonb`),
  
  // Additional context
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_device_events_device").on(table.deviceId),
  index("idx_device_events_user").on(table.userId),
  index("idx_device_events_type").on(table.eventType),
  index("idx_device_events_created").on(table.createdAt),
  index("idx_device_events_audit").on(table.auditLedgerId),
]);

export const insertUserDeviceEventSchema = createInsertSchema(userDeviceEvents, {
  eventType: z.enum(['device_added', 'device_renamed', 'device_trusted', 'device_revoked', 'login_success', 'login_failed', 'suspicious_activity', 'ip_changed', 'geo_changed', 'session_started', 'session_ended']),
  action: z.enum(['login', 'logout', 'revoke', 'update', 'trust', 'rename', 'add']),
  fraudScore: z.number().min(0).max(100).default(0),
}).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertUserDeviceEvent = z.infer<typeof insertUserDeviceEventSchema>;
export type UserDeviceEvent = typeof userDeviceEvents.$inferSelect;

// ==================== NAYAX SPARK API - ADDITIONAL TABLES ====================

// Nayax telemetry snapshots (machine status from Lynx API)
export const nayaxTelemetry = pgTable("nayax_telemetry", {
  id: serial("id").primaryKey(),
  
  // Terminal identification
  terminalId: varchar("terminal_id").notNull(),
  stationId: varchar("station_id").notNull(),
  
  // Machine state (from Lynx API)
  state: varchar("state").notNull(), // Idle, InUse, OutOfService, Offline
  
  // Telemetry data
  waterTemp: decimal("water_temp", { precision: 5, scale: 2 }), // Celsius
  waterPressure: decimal("water_pressure", { precision: 5, scale: 2 }), // PSI
  shampooLevel: integer("shampoo_level"), // 0-100%
  conditionerLevel: integer("conditioner_level"), // 0-100%
  
  // Connectivity
  isOnline: boolean("is_online").default(true),
  lastPingAt: timestamp("last_ping_at").notNull(),
  
  // Error states
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_nayax_telemetry_terminal").on(table.terminalId),
  index("idx_nayax_telemetry_station").on(table.stationId),
  index("idx_nayax_telemetry_state").on(table.state),
  index("idx_nayax_telemetry_ping").on(table.lastPingAt),
]);

export const insertNayaxTelemetrySchema = createInsertSchema(nayaxTelemetry, {
  state: z.enum(['Idle', 'InUse', 'OutOfService', 'Offline', 'Maintenance']),
}).omit({ id: true, createdAt: true });

export type InsertNayaxTelemetry = z.infer<typeof insertNayaxTelemetrySchema>;
export type NayaxTelemetry = typeof nayaxTelemetry.$inferSelect;

// Customer payment tokens (secure tokenized payment methods)
export const customerPaymentTokens = pgTable("customer_payment_tokens", {
  id: serial("id").primaryKey(),
  
  // Customer identification
  customerUid: varchar("customer_uid").notNull(),
  
  // Nayax token (encrypted in storage)
  nayaxToken: text("nayax_token").notNull().unique(), // Encrypted Nayax payment token
  
  // Card details (masked for display)
  lastFourDigits: varchar("last_four_digits", { length: 4 }),
  cardType: varchar("card_type"), // Visa, Mastercard, Amex
  cardBrand: varchar("card_brand"),
  expiryMonth: varchar("expiry_month", { length: 2 }),
  expiryYear: varchar("expiry_year", { length: 4 }),
  
  // Token metadata
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  
  // Security
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash for validation
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  index("idx_payment_token_customer").on(table.customerUid),
  index("idx_payment_token_hash").on(table.tokenHash),
]);

export const insertCustomerPaymentTokenSchema = createInsertSchema(customerPaymentTokens).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type InsertCustomerPaymentToken = z.infer<typeof insertCustomerPaymentTokenSchema>;
export type CustomerPaymentToken = typeof customerPaymentTokens.$inferSelect;

// QR code redemptions (loyalty/voucher via Nayax terminal)
export const nayaxQrRedemptions = pgTable("nayax_qr_redemptions", {
  id: serial("id").primaryKey(),
  
  // QR code identification
  qrCode: varchar("qr_code").notNull(),
  qrType: varchar("qr_type").notNull(), // loyalty_token, e_voucher, gift_card
  
  // Entity linkage
  voucherId: varchar("voucher_id"), // If QR is for voucher
  loyaltyTokenId: varchar("loyalty_token_id"), // If QR is for loyalty discount
  
  // Customer & station
  customerUid: varchar("customer_uid").notNull(),
  stationId: varchar("station_id").notNull(),
  terminalId: varchar("terminal_id").notNull(),
  
  // Redemption result
  status: varchar("status").notNull(), // success, failed, expired, already_used
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  discountPercent: integer("discount_percent"),
  
  // Linked transaction (if vend was triggered)
  nayaxTransactionId: varchar("nayax_transaction_id").references(() => nayaxTransactions.id),
  
  // Audit
  redemptionHash: text("redemption_hash").notNull().unique(), // Prevent duplicates
  auditLedgerId: integer("audit_ledger_id").references(() => auditLedger.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_qr_redemption_code").on(table.qrCode),
  index("idx_qr_redemption_customer").on(table.customerUid),
  index("idx_qr_redemption_station").on(table.stationId),
  index("idx_qr_redemption_hash").on(table.redemptionHash),
]);

export const insertNayaxQrRedemptionSchema = createInsertSchema(nayaxQrRedemptions, {
  qrType: z.enum(['loyalty_token', 'e_voucher', 'gift_card', 'promo_code']),
  status: z.enum(['success', 'failed', 'expired', 'already_used', 'invalid']),
}).omit({ id: true, createdAt: true });

export type InsertNayaxQrRedemption = z.infer<typeof insertNayaxQrRedemptionSchema>;
export type NayaxQrRedemption = typeof nayaxQrRedemptions.$inferSelect;

// Pet Avatars (The Plush Lab - 3D avatar customization feature)
export const petAvatars = pgTable("pet_avatars", {
  id: serial("id").primaryKey(),
  
  // User & Pet identification
  userId: varchar("user_id").references(() => users.id).notNull(),
  petName: varchar("pet_name").notNull(),
  
  // Photo & visual assets
  photoUrl: text("photo_url").notNull(), // Original pet photo
  thumbnailUrl: text("thumbnail_url"), // Optimized thumbnail
  
  // AI-powered facial landmark configuration
  landmarkConfig: jsonb("landmark_config"), // Facial landmarks for animation
  
  // Animation settings
  animationProfile: jsonb("animation_profile").default('{"style":"playful","intensity":"medium","blinkRate":3}'), // Animation preferences
  
  // Text-to-speech voice
  ttsVoice: varchar("tts_voice").default("en-US-Neural2-A"), // Google TTS voice ID
  
  // PREMIUM CUSTOMIZATION - Outfit & Accessory System
  characterType: varchar("character_type").default("pet"), // pet, person, superhero, custom
  outfitId: varchar("outfit_id"), // Selected outfit from library
  accessories: jsonb("accessories").default('[]'), // Array of accessory IDs: ["hat_01", "glasses_02"]
  customization: jsonb("customization").default('{"colors":{},"patterns":{},"layering":[]}'), // Color/pattern overrides
  
  // Status & metadata
  status: varchar("status").default("active").notNull(), // active, processing, inactive
  isDefault: boolean("is_default").default(false), // Primary avatar for user
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_pet_avatar_user").on(table.userId),
  index("idx_pet_avatar_status").on(table.status),
]);

export const insertPetAvatarSchema = createInsertSchema(petAvatars, {
  status: z.enum(['active', 'processing', 'inactive']).optional(),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type InsertPetAvatar = z.infer<typeof insertPetAvatarSchema>;
export type PetAvatar = typeof petAvatars.$inferSelect;

// ========================================
// THE SITTER SUITE™ - Pet Sitting Marketplace
// ========================================

// Sitter Profiles (Marketplace Providers) - DEEP ONBOARDING LIKE AIRBNB
export const sitterProfiles = pgTable("sitter_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  
  // Basic Information
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(), // Required for age verification
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  
  // Address & Location (Full Deep Details)
  streetAddress: varchar("street_address").notNull(),
  apartment: varchar("apartment"), // Optional
  city: varchar("city").notNull(),
  stateProvince: varchar("state_province").notNull(),
  postalCode: varchar("postal_code").notNull(),
  country: varchar("country").notNull().default("Israel"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Personal Details & Safety
  profilePictureUrl: varchar("profile_picture_url"),
  bio: text("bio"),
  yearsOfExperience: integer("years_of_experience").notNull(),
  detailedExperience: text("detailed_experience"), // Deep experience description
  specializations: text("specializations").array(), // ["dogs", "cats", "exotic"]
  languagesSpoken: text("languages_spoken").array(), // ["Hebrew", "English", "Arabic"]
  
  // Health & Safety (Like Airbnb host details)
  personalAllergies: text("personal_allergies"), // Sitter's own allergies (e.g., to certain pet foods)
  smokingStatus: varchar("smoking_status"), // non_smoker | smoker | outdoor_only
  hasOtherPets: boolean("has_other_pets").default(false),
  otherPetsDetails: text("other_pets_details"), // If they have their own pets at home
  
  // Home Environment (For boarding services)
  homeType: varchar("home_type"), // apartment | house | studio | farm
  yardSize: varchar("yard_size"), // none | small | medium | large
  homePhotos: text("home_photos").array(), // URLs to home environment photos
  
  // Pricing & Services
  pricePerDayCents: integer("price_per_day_cents").notNull(), // Base price in cents
  serviceTypes: text("service_types").array(), // ["boarding", "daycare", "drop_in", "walking"]
  
  // Availability Calendar (Like Airbnb calendar)
  availabilityCalendar: jsonb("availability_calendar").$type<Array<{
    date: string; // YYYY-MM-DD
    available: boolean;
    reason?: string; // Optional block reason
  }>>(),
  recurringAvailability: jsonb("recurring_availability").$type<{
    monday: { available: boolean; hours?: string };
    tuesday: { available: boolean; hours?: string };
    wednesday: { available: boolean; hours?: string };
    thursday: { available: boolean; hours?: string };
    friday: { available: boolean; hours?: string };
    saturday: { available: boolean; hours?: string };
    sunday: { available: boolean; hours?: string };
  }>(),
  
  // House Policies & Rules (Airbnb-style)
  housePolicies: jsonb("house_policies").$type<{
    maxPetsAtOnce: number;
    acceptsUnvaccinatedPets: boolean;
    acceptsPuppies: boolean; // Under 6 months
    acceptsSeniorPets: boolean; // Over 10 years
    acceptsSpecialNeeds: boolean;
    cancellationPolicy: 'flexible' | 'moderate' | 'strict'; // Like Airbnb
    additionalRules: string[];
  }>(),
  
  // PROPERTY DETAILS (Airbnb-Level Discretion)
  propertyAmenities: jsonb("property_amenities").$type<{
    // Outdoor Space
    hasBackyard: boolean;
    yardFenced: boolean;
    yardSizeMeters: number; // Square meters
    hasBalcony: boolean;
    hasPatio: boolean;
    
    // Indoor Amenities
    numberOfBedrooms: number;
    numberOfBathrooms: number; // "There is a shower or two"
    hasDedicatedPetRoom: boolean;
    hasPetBed: boolean;
    hasAirConditioning: boolean;
    hasHeating: boolean;
    
    // Pet Facilities
    hasPetDoor: boolean;
    hasCrate: boolean;
    crateSize?: string; // small | medium | large
    hasToys: boolean;
    toyTypes?: string[]; // ["balls", "chew toys", "puzzles"]
    hasTrainingAids: boolean;
    
    // Feeding
    providesFood: boolean;
    foodBrands?: string[]; // Preferred food brands available
    dailyFoodAmount?: string; // "1 cup twice daily", "250g per meal"
    feedingSchedule?: string; // "8am, 6pm"
    hasAutomaticFeeder: boolean;
    hasWaterFountain: boolean;
    
    // Exercise & Activities
    walkFrequency?: string; // "3 times daily", "Morning and evening"
    walkDuration?: string; // "30 minutes each"
    hasNearbyPark: boolean;
    parkDistance?: number; // Meters to nearest park
    hasSwimmingPool: boolean; // Pool access for dogs
    
    // Safety & Security
    hasCCTV: boolean;
    has24hrSupervision: boolean;
    hasFirstAidKit: boolean;
    hasEmergencyVet: boolean;
    emergencyVetDistance?: number; // km
    hasFireExtinguisher: boolean;
    
    // Other
    allowsPetsOnFurniture: boolean;
    allowsPetsOnBed: boolean;
    hasOtherAnimals: boolean;
    otherAnimalsDetails?: string;
  }>(),
  
  // ENTRY INSTRUCTIONS (Like Airbnb Check-In Details)
  entryInstructions: jsonb("entry_instructions").$type<{
    accessMethod: 'key' | 'lockbox' | 'smart_lock' | 'doorman' | 'host_greeting'; // How to enter property
    
    // Key/Lockbox Details
    keyLocation?: string; // "Under doormat", "With building manager"
    lockboxCode?: string; // 4-digit code (encrypted in real implementation)
    lockboxLocation?: string; // "Front door", "Side gate"
    
    // Smart Lock
    smartLockType?: string; // "August", "Yale", "Schlage"
    smartLockCode?: string; // Temporary access code
    smartLockInstructions?: string;
    
    // Building Access
    buildingEntry?: string; // "Ring apartment 5B", "Use main entrance code 1234#"
    parkingInstructions?: string; // "Street parking available", "Use visitor spot #12"
    
    // WiFi Details (Essential!)
    wifiNetwork: string; // "MyHomeWiFi"
    wifiPassword: string; // Encrypted password
    wifiInstructions?: string; // "2.4GHz network, 5GHz may not work with some devices"
    
    // Host Contact
    hostMobileForEmergency: string;
    hostPreferredContactMethod: 'call' | 'sms' | 'whatsapp' | 'platform_message';
    
    // Special Instructions
    gateCode?: string; // Community gate code
    elevatorInstructions?: string; // "Use service elevator with key"
    alarmCode?: string; // Home alarm system code
    alarmInstructions?: string; // "Disarm within 30 seconds, code panel by front door"
    
    // Check-in/Check-out Times
    flexibleCheckIn: boolean;
    preferredCheckInTime?: string; // "After 3pm"
    preferredCheckOutTime?: string; // "Before 11am"
    
    // Additional Notes
    additionalInstructions: string; // Free text for any other details
  }>(),
  
  // HOUSE MANUAL (Like Airbnb Guidebook)
  houseManual: jsonb("house_manual").$type<{
    // Appliances
    applianceInstructions?: string; // How to use washer/dryer, dishwasher, etc.
    heatingCoolingInstructions?: string; // Thermostat settings
    
    // Trash & Recycling
    trashSchedule?: string; // "Pickup: Tuesday & Friday"
    recyclingInstructions?: string;
    
    // Neighborhood Info
    nearbyVets?: Array<{ name: string; address: string; phone: string; distance: number }>;
    nearbyPetStores?: Array<{ name: string; address: string; distance: number }>;
    nearbyParks?: Array<{ name: string; address: string; distance: number }>;
    
    // Emergency Contacts
    emergencyContacts?: Array<{ name: string; relationship: string; phone: string }>;
    
    // House Rules Reminder
    quietHours?: string; // "10pm - 8am"
    smokingPolicy: 'no_smoking' | 'outdoor_only' | 'allowed';
    
    // Recommendations
    recommendedActivities?: string[]; // ["Beach walk 5min away", "Dog park at Central Park"]
  }>(),
  
  // Emergency Contacts
  emergencyContactName: varchar("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone"),
  emergencyContactRelationship: varchar("emergency_contact_relationship"),
  
  // STRICT VETTING FUNNEL (Matches Python StatusManager)
  verificationStatus: varchar("verification_status").default("pending_id"), // pending_id | id_verified | criminal_check_passed | training_complete | active
  verificationDocumentUrl: varchar("verification_document_url"),
  backgroundCheckStatus: varchar("background_check_status"), // pending | passed | failed
  backgroundCheckCompletedAt: timestamp("background_check_completed_at"),
  trainingCompletedAt: timestamp("training_completed_at"),
  activatedAt: timestamp("activated_at"),
  
  // BIOMETRIC KYC (TWO-WAY AUTHENTICATION - MANDATORY)
  selfiePhotoUrl: varchar("selfie_photo_url").notNull(), // Current selfie with clear face
  idPhotoUrl: varchar("id_photo_url").notNull(), // Government ID photo (passport, driver's license, national ID)
  biometricMatchStatus: varchar("biometric_match_status").default("pending"), // pending | matched | failed
  biometricMatchScore: decimal("biometric_match_score", { precision: 5, scale: 2 }), // 0-100 confidence score from Google Vision API
  biometricVerifiedAt: timestamp("biometric_verified_at"), // When verification passed
  biometricRejectionReason: text("biometric_rejection_reason"), // Why verification failed (if applicable)
  
  // Legal Compliance
  termsAcceptedAt: timestamp("terms_accepted_at"),
  privacyPolicyAcceptedAt: timestamp("privacy_policy_accepted_at"),
  insuranceCertUrl: varchar("insurance_cert_url"),
  
  // Performance Metrics
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalBookings: integer("total_bookings").default(0),
  totalEarningsCents: integer("total_earnings_cents").default(0),
  responseTimeMinutes: integer("response_time_minutes"), // Avg response time
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pet Profiles for Sitting Service (with High Alert Safety)
export const petProfilesForSitting = pgTable("pet_profiles_for_sitting", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Owner Firebase UID
  name: varchar("name").notNull(),
  breed: varchar("breed").notNull(),
  age: integer("age"),
  weight: varchar("weight"),
  photoUrl: varchar("photo_url"),
  specialNeeds: text("special_needs"),
  allergies: jsonb("allergies").$type<Array<{
    allergen: string;
    severity: 'mild' | 'moderate' | 'severe';
    highAlertFlag: boolean; // RED ALERT BANNER trigger
    notes: string;
  }>>(),
  medications: text("medications"),
  vetContactName: varchar("vet_contact_name"),
  vetContactPhone: varchar("vet_contact_phone"),
  emergencyContactName: varchar("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bookings (Transaction Register / Audit Trail)
export const sitterBookings = pgTable("sitter_bookings", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").unique().notNull(), // UUID for tracking
  ownerId: varchar("owner_id").notNull(), // Firebase UID
  sitterId: integer("sitter_id").references(() => sitterProfiles.id).notNull(),
  petId: integer("pet_id").references(() => petProfilesForSitting.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  
  // Financial Split Payment Model - CONNECTOR PLATFORM (Like cars.com.au)
  basePriceCents: integer("base_price_cents").notNull(), // Sitter's base rate × days
  platformServiceFeeCents: integer("platform_service_fee_cents").notNull(), // 10% visible to owner
  brokerCutCents: integer("broker_cut_cents").notNull(), // 7% hidden (our clip/commission)
  sitterPayoutCents: integer("sitter_payout_cents").notNull(), // 93% of base (100% - 7%)
  totalChargeCents: integer("total_charge_cents").notNull(), // base + platform fee
  
  // Payment Integration (NAYAX ONLY - Like Booking.com/Airbnb)
  nayaxTransactionId: varchar("nayax_transaction_id"), // Nayax payment transaction ID
  nayaxSplitPaymentId: varchar("nayax_split_payment_id"), // Nayax split payment reference
  paymentStatus: varchar("payment_status").default("pending"), // pending, captured, failed, refunded
  payoutStatus: varchar("payout_status").default("pending"), // pending, completed, failed
  
  // ESCROW SYSTEM (Matches Python EscrowManager - 24-hour hold)
  escrowHeldAt: timestamp("escrow_held_at"), // When funds moved to escrow
  escrowReleaseEligibleAt: timestamp("escrow_release_eligible_at"), // completedAt + 24 hours
  payoutReleasedAt: timestamp("payout_released_at"), // Actual payout timestamp
  
  // Booking Status & Audit Trail
  status: varchar("status").default("pending"), // pending, confirmed, in_progress, completed, cancelled
  urgencyScore: integer("urgency_score").default(1), // 1-3 (3 = critical/last-minute)
  aiTriageNotes: text("ai_triage_notes"), // Gemini AI analysis
  cancellationReason: text("cancellation_reason"),
  specialInstructions: text("special_instructions"),
  
  // Timestamps (AGD Stamped)
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sitter Reviews (Uber-style)
export const sitterReviews = pgTable("sitter_reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => sitterBookings.id).notNull(),
  sitterId: integer("sitter_id").references(() => sitterProfiles.id).notNull(),
  ownerId: varchar("owner_id").notNull(), // Firebase UID
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  isVerifiedStay: boolean("is_verified_stay").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// TWO-SIDED CONSENT SYSTEM (Both parties must agree)
export const bookingConsents = pgTable("booking_consents", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => sitterBookings.id).notNull(),
  
  // Owner Consent
  ownerConsented: boolean("owner_consented").default(false),
  ownerConsentedAt: timestamp("owner_consented_at"),
  ownerAcceptedTerms: boolean("owner_accepted_terms").default(false),
  ownerSignature: text("owner_signature"), // Digital signature or IP address
  
  // Sitter Consent
  sitterConsented: boolean("sitter_consented").default(false),
  sitterConsentedAt: timestamp("sitter_consented_at"),
  sitterAcceptedHouseRules: boolean("sitter_accepted_house_rules").default(false),
  sitterSignature: text("sitter_signature"), // Digital signature or IP address
  
  // Both Parties Agreement Status
  bothPartiesAgreed: boolean("both_parties_agreed").default(false),
  agreementCompletedAt: timestamp("agreement_completed_at"),
  
  // Special Instructions & Messages (Owner → Sitter)
  ownerInstructions: text("owner_instructions"), // Feeding schedule, special care, etc.
  ownerMedicalInstructions: text("owner_medical_instructions"),
  
  // Sitter Acknowledgment & Notes (Sitter → Owner)
  sitterNotes: text("sitter_notes"), // Questions, clarifications
  sitterAcceptanceMessage: text("sitter_acceptance_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// BOOKING EXTENSION REQUESTS (Automatic recalculation)
export const bookingExtensions = pgTable("booking_extensions", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => sitterBookings.id).notNull(),
  
  // Extension Details
  requestedBy: varchar("requested_by").notNull(), // owner | sitter
  originalEndDate: timestamp("original_end_date").notNull(),
  newEndDate: timestamp("new_end_date").notNull(),
  additionalDays: integer("additional_days").notNull(),
  
  // Financial Recalculation (More money for platform!)
  originalTotalCents: integer("original_total_cents").notNull(),
  extensionBaseCents: integer("extension_base_cents").notNull(),
  extensionPlatformFeeCents: integer("extension_platform_fee_cents").notNull(),
  extensionBrokerCutCents: integer("extension_broker_cut_cents").notNull(), // 7% of extension
  newTotalCents: integer("new_total_cents").notNull(),
  
  // Approval Status
  status: varchar("status").default("pending"), // pending | approved | rejected
  approvedBy: varchar("approved_by"), // other party's userId
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// SILENT COMPLAINT SYSTEM (Report to Pet Wash)
export const sitterComplaints = pgTable("sitter_complaints", {
  id: serial("id").primaryKey(),
  complaintId: varchar("complaint_id").unique().notNull(), // COMP-YYYY-NNNN
  
  // Reporter Information
  reportedBy: varchar("reported_by").notNull(), // userId (owner or sitter)
  reporterType: varchar("reporter_type").notNull(), // owner | sitter
  
  // Target of Complaint
  reportedUser: varchar("reported_user").notNull(), // userId being reported
  reportedUserType: varchar("reported_user_type").notNull(), // owner | sitter
  bookingId: integer("booking_id").references(() => sitterBookings.id), // Optional - complaint might not be booking-specific
  
  // Complaint Details
  category: varchar("category").notNull(), // safety_concern | harassment | fraud | negligence | property_damage | other
  severity: varchar("severity").notNull(), // low | medium | high | critical
  description: text("description").notNull(),
  evidenceUrls: text("evidence_urls").array(), // Photos, videos, screenshots
  
  // Investigation & Resolution
  status: varchar("status").default("pending"), // pending | under_review | resolved | dismissed
  assignedTo: varchar("assigned_to").references(() => adminUsers.id), // Admin handling the case
  adminNotes: text("admin_notes"),
  actionTaken: text("action_taken"), // Warning, suspension, ban, refund, etc.
  resolvedAt: timestamp("resolved_at"),
  
  // Silent Flag (Complaint not visible to reported party)
  isSilent: boolean("is_silent").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas for Validation
export const insertSitterProfileSchema = createInsertSchema(sitterProfiles).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSitterProfile = z.infer<typeof insertSitterProfileSchema>;
export type SitterProfile = typeof sitterProfiles.$inferSelect;

export const insertPetProfileForSittingSchema = createInsertSchema(petProfilesForSitting).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertPetProfileForSitting = z.infer<typeof insertPetProfileForSittingSchema>;
export type PetProfileForSitting = typeof petProfilesForSitting.$inferSelect;

export const insertSitterBookingSchema = createInsertSchema(sitterBookings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSitterBooking = z.infer<typeof insertSitterBookingSchema>;
export type SitterBooking = typeof sitterBookings.$inferSelect;

export const insertSitterReviewSchema = createInsertSchema(sitterReviews).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertSitterReview = z.infer<typeof insertSitterReviewSchema>;
export type SitterReview = typeof sitterReviews.$inferSelect;

export const insertBookingConsentSchema = createInsertSchema(bookingConsents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertBookingConsent = z.infer<typeof insertBookingConsentSchema>;
export type BookingConsent = typeof bookingConsents.$inferSelect;

export const insertBookingExtensionSchema = createInsertSchema(bookingExtensions).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertBookingExtension = z.infer<typeof insertBookingExtensionSchema>;
export type BookingExtension = typeof bookingExtensions.$inferSelect;

export const insertSitterComplaintSchema = createInsertSchema(sitterComplaints).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSitterComplaint = z.infer<typeof insertSitterComplaintSchema>;
export type SitterComplaint = typeof sitterComplaints.$inferSelect;

// PRIVATE MESSAGING SYSTEM (Owner ↔ Sitter Communication)
export const sitterMessages = pgTable("sitter_messages", {
  id: serial("id").primaryKey(),
  messageId: varchar("message_id").unique().notNull(), // MSG-UUID
  bookingId: integer("booking_id").references(() => sitterBookings.id), // Optional - can message before booking
  
  // Participants
  senderId: varchar("sender_id").notNull(), // Firebase UID
  senderType: varchar("sender_type").notNull(), // owner | sitter
  receiverId: varchar("receiver_id").notNull(), // Firebase UID
  receiverType: varchar("receiver_type").notNull(), // owner | sitter
  
  // Message Content
  messageText: text("message_text").notNull(),
  attachmentUrls: text("attachment_urls").array(), // Photos, documents
  
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isDeleted: boolean("is_deleted").default(false), // Soft delete
  deletedBy: varchar("deleted_by"), // userId who deleted
  
  // Safety & Moderation
  isFlagged: boolean("is_flagged").default(false), // Flagged for review
  flaggedReason: varchar("flagged_reason"), // inappropriate | spam | harassment
  moderatedBy: varchar("moderated_by").references(() => adminUsers.id), // Admin who reviewed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSitterMessageSchema = createInsertSchema(sitterMessages).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSitterMessage = z.infer<typeof insertSitterMessageSchema>;
export type SitterMessage = typeof sitterMessages.$inferSelect;

// =================== WALK MY PET PLATFORM ===================
// Premium dog walking marketplace with GPS tracking, blockchain verification,
// AI behavior analysis, health monitoring, and 2025-2026 advanced tech

// WALKER PROFILES (Independent Contractors)
export const walkerProfiles = pgTable("walker_profiles", {
  id: serial("id").primaryKey(),
  walkerId: varchar("walker_id").unique().notNull(), // WALKER-UUID
  
  // User Account Link
  userId: varchar("user_id").notNull(), // Firebase UID
  
  // Profile Information
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  displayName: varchar("display_name"),
  profilePhotoUrl: varchar("profile_photo_url"),
  bio: text("bio"),
  
  // Location & Service Area
  city: varchar("city").notNull(),
  country: varchar("country").notNull().default("IL"), // IL, USA, UK, AUS, CAN
  currentLatitude: decimal("current_latitude", { precision: 10, scale: 7 }), // Real-time location
  currentLongitude: decimal("current_longitude", { precision: 10, scale: 7 }),
  serviceRadiusKm: integer("service_radius_km").default(5), // How far they'll travel
  
  // Verification & Trust
  verificationStatus: varchar("verification_status").default("pending"), // pending | verified | rejected | suspended
  kycCompleted: boolean("kyc_completed").default(false),
  backgroundCheckStatus: varchar("background_check_status").default("pending"), // pending | passed | failed
  backgroundCheckDate: timestamp("background_check_date"),
  
  // Biometric KYC (Banking-Level)
  selfiePhotoUrl: varchar("selfie_photo_url"),
  governmentIdUrl: varchar("government_id_url"),
  biometricMatchScore: decimal("biometric_match_score", { precision: 5, scale: 2 }), // 0-100
  biometricVerifiedAt: timestamp("biometric_verified_at"),
  
  // Experience & Skills
  yearsOfExperience: integer("years_of_experience"),
  specializations: text("specializations").array(), // large_breeds, puppies, senior_dogs, reactive_dogs
  certifications: text("certifications").array(), // pet_first_aid, dog_training, etc
  
  // Ratings & Performance
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"), // 0-5.00
  totalWalks: integer("total_walks").default(0),
  totalReviews: integer("total_reviews").default(0),
  responseTimeMinutes: integer("response_time_minutes"), // Average response time
  acceptanceRate: decimal("acceptance_rate", { precision: 5, scale: 2 }).default("0"), // 0-100%
  
  // Equipment & Features
  hasBodyCamera: boolean("has_body_camera").default(false), // HD camera for live streaming
  hasDroneAccess: boolean("has_drone_access").default(false), // VIP drone monitoring
  hasFirstAidKit: boolean("has_first_aid_kit").default(false),
  hasCarTransport: boolean("has_car_transport").default(false),
  
  // Pricing
  baseHourlyRate: decimal("base_hourly_rate", { precision: 10, scale: 2 }).notNull(), // Walker sets their rate
  currency: varchar("currency").default("ILS"), // ILS, USD, GBP, AUD, CAD
  
  // Availability
  isAvailable: boolean("is_available").default(true),
  maxDailyWalks: integer("max_daily_walks").default(5),
  
  // Banking (for payouts - Nayax Israel ONLY)
  bankAccountVerified: boolean("bank_account_verified").default(false),
  nayaxPayoutAccountId: varchar("nayax_payout_account_id"), // Nayax payout account
  
  // Platform Commission (24% gross take rate split)
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("18.00"), // Walker pays 18%
  
  // Status
  isActive: boolean("is_active").default(true),
  suspensionReason: text("suspension_reason"),
  suspendedUntil: timestamp("suspended_until"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WALKER SCHEDULE & AVAILABILITY
export const walkerSchedule = pgTable("walker_schedule", {
  id: serial("id").primaryKey(),
  walkerId: varchar("walker_id").references(() => walkerProfiles.walkerId).notNull(),
  
  // Date & Time Blocks
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 6=Saturday
  startTime: varchar("start_time").notNull(), // HH:MM format (24h)
  endTime: varchar("end_time").notNull(),
  isAvailable: boolean("is_available").default(true),
  
  // Override for specific dates
  specificDate: date("specific_date"), // Override for vacation/holidays
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WALK BOOKINGS
export const walkBookings = pgTable("walk_bookings", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").unique().notNull(), // WALK-YYYY-NNNNNN
  
  // Participants
  ownerId: varchar("owner_id").notNull(), // Firebase UID (pet owner)
  walkerId: varchar("walker_id").references(() => walkerProfiles.walkerId).notNull(),
  petId: varchar("pet_id"), // Optional: specific pet from user's pet list
  
  // Walk Details
  scheduledDate: date("scheduled_date").notNull(),
  scheduledStartTime: varchar("scheduled_start_time").notNull(), // HH:MM
  durationMinutes: integer("duration_minutes").notNull(), // 30, 45, 60, 90
  
  // Location
  pickupLatitude: decimal("pickup_latitude", { precision: 10, scale: 7 }).notNull(),
  pickupLongitude: decimal("pickup_longitude", { precision: 10, scale: 7 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  
  // Geofencing (Safety Zone)
  geofenceRadiusMeters: integer("geofence_radius_meters").default(500), // Safe walking radius
  geofenceCenterLat: decimal("geofence_center_lat", { precision: 10, scale: 7 }),
  geofenceCenterLon: decimal("geofence_center_lon", { precision: 10, scale: 7 }),
  
  // Pet Information
  petName: varchar("pet_name"),
  petBreed: varchar("pet_breed"),
  petWeight: varchar("pet_weight"),
  petSpecialNeeds: text("pet_special_needs"),
  petMedications: text("pet_medications"),
  petBehaviorNotes: text("pet_behavior_notes"),
  
  // Pricing & Payment
  walkerRate: decimal("walker_rate", { precision: 10, scale: 2 }).notNull(), // What walker charges
  platformFeeOwner: decimal("platform_fee_owner", { precision: 10, scale: 2 }).notNull(), // 6% owner pays
  platformFeeSitter: decimal("platform_fee_sitter", { precision: 10, scale: 2 }).notNull(), // 18% walker pays
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(), // What owner pays
  walkerPayout: decimal("walker_payout", { precision: 10, scale: 2 }).notNull(), // What walker receives (82%)
  currency: varchar("currency").default("ILS"),
  
  // Status Tracking
  status: varchar("status").default("pending"), // pending | confirmed | in_progress | completed | cancelled
  confirmationCode: varchar("confirmation_code"), // 6-digit code for walker to start walk
  
  // Walk Execution
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  actualDurationMinutes: integer("actual_duration_minutes"),
  
  // Check-in/Check-out Tracking (Timetable Protocol)
  checkInLocation: jsonb("check_in_location"), // {latitude, longitude, accuracy, timestamp, deviceInfo} - IMMUTABLE after check-in
  checkOutLocation: jsonb("check_out_location"), // {latitude, longitude, accuracy, timestamp, deviceInfo}
  lastKnownLocation: jsonb("last_known_location"), // {latitude, longitude, accuracy, timestamp} - LIVE tracking updates
  routePolyline: text("route_polyline"), // Encoded GPS path for map visualization
  totalDistanceMeters: integer("total_distance_meters"), // Calculated from GPS points
  lastGPSUpdate: timestamp("last_gps_update"), // Last real-time GPS ping
  
  // Bathroom Markers (Wag-style pee/poo flags)
  bathroomMarkers: jsonb("bathroom_markers"), // [{type: 'pee'|'poo', latitude, longitude, timestamp, accuracy}]
  
  // Vital Data Summary (Aggregated from walkHealthData)
  vitalDataSummary: jsonb("vital_data_summary"), // {heartRateAvg, heartRateMax, steps, hydrationStops, photosTaken}
  
  // Real-time Features
  isLiveTrackingActive: boolean("is_live_tracking_active").default(false),
  isVideoStreamActive: boolean("is_video_stream_active").default(false),
  isDroneMonitoringActive: boolean("is_drone_monitoring_active").default(false),
  
  // Safety Alerts
  geofenceViolationCount: integer("geofence_violation_count").default(0),
  emergencyStopTriggered: boolean("emergency_stop_triggered").default(false),
  emergencyStopReason: text("emergency_stop_reason"),
  
  // Completion & Review
  walkCompletedSuccessfully: boolean("walk_completed_successfully"),
  completionNotes: text("completion_notes"),
  ownerNotified: boolean("owner_notified").default(false),
  
  // Cancellation
  cancelledBy: varchar("cancelled_by"), // owner | walker | system
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  
  // Emergency/ASAP Walk Features (Rover/Wag "Book Now" model)
  isEmergencyWalk: boolean("is_emergency_walk").default(false), // ASAP booking with 90-min arrival
  emergencySurgeMultiplier: decimal("emergency_surge_multiplier", { precision: 3, scale: 2 }), // 1.0 = no surge, 1.5 = 50% increase, 2.0 = double
  emergencySurgeReason: text("emergency_surge_reason"), // High demand, Peak hours, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// REAL-TIME GPS TRACKING (High-frequency data points)
export const walkGpsTracking = pgTable("walk_gps_tracking", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => walkBookings.bookingId).notNull(),
  
  // GPS Coordinates (1-meter accuracy)
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }), // meters
  altitude: decimal("altitude", { precision: 7, scale: 2 }), // meters
  heading: decimal("heading", { precision: 5, scale: 2 }), // degrees (0-360)
  speed: decimal("speed", { precision: 5, scale: 2 }), // km/h
  
  // Location Context
  isInsideGeofence: boolean("is_inside_geofence").default(true),
  distanceFromCenterMeters: decimal("distance_from_center_meters", { precision: 7, scale: 2 }),
  
  // Timestamp (recorded every 1-5 seconds)
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  
  // Device Info
  deviceType: varchar("device_type"), // ios | android
  batteryLevel: integer("battery_level"), // 0-100
});

// WALK HEALTH & ACTIVITY MONITORING
export const walkHealthData = pgTable("walk_health_data", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => walkBookings.bookingId).notNull(),
  
  // Health Metrics
  averageHeartRate: integer("average_heart_rate"), // BPM (from smart collar/wearable)
  maxHeartRate: integer("max_heart_rate"),
  caloriesBurned: integer("calories_burned"),
  distanceKm: decimal("distance_km", { precision: 5, scale: 2 }),
  averagePaceMinPerKm: decimal("average_pace_min_per_km", { precision: 5, scale: 2 }),
  
  // Activity Breakdown
  walkingMinutes: integer("walking_minutes"),
  runningMinutes: integer("running_minutes"),
  restingMinutes: integer("resting_minutes"),
  
  // AI Behavior Analysis
  stressLevel: varchar("stress_level"), // low | normal | moderate | high
  fatigueLevel: varchar("fatigue_level"), // none | slight | moderate | high
  interactionCount: integer("interaction_count"), // With other dogs/people
  excessivePullingDetected: boolean("excessive_pulling_detected").default(false),
  excessiveBarkingDetected: boolean("excessive_barking_detected").default(false),
  
  // Environmental Conditions
  weatherCondition: varchar("weather_condition"), // sunny, rainy, cloudy, etc
  temperatureCelsius: decimal("temperature_celsius", { precision: 4, scale: 1 }),
  humidityPercent: integer("humidity_percent"),
  
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// BLOCKCHAIN AUDIT TRAIL (Tamper-Proof Walk Verification)
export const walkBlockchainAudit = pgTable("walk_blockchain_audit", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => walkBookings.bookingId).notNull(),
  
  // Blockchain Hash Chain
  blockHash: varchar("block_hash").unique().notNull(), // SHA-256 hash of this record
  previousBlockHash: varchar("previous_block_hash"), // Links to previous walk
  
  // Verified Data Snapshot
  walkStartTimestamp: timestamp("walk_start_timestamp").notNull(),
  walkEndTimestamp: timestamp("walk_end_timestamp").notNull(),
  totalDurationSeconds: integer("total_duration_seconds").notNull(),
  totalDistanceMeters: integer("total_distance_meters").notNull(),
  gpsDataPointsCount: integer("gps_data_points_count").notNull(),
  
  // Geofence Compliance
  geofenceViolations: integer("geofence_violations").default(0),
  geofenceCompliancePercent: decimal("geofence_compliance_percent", { precision: 5, scale: 2 }),
  
  // Payment Verification
  amountPaidByOwner: decimal("amount_paid_by_owner", { precision: 10, scale: 2 }).notNull(),
  amountPaidToWalker: decimal("amount_paid_to_walker", { precision: 10, scale: 2 }).notNull(),
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }).notNull(),
  
  // Digital Signatures
  walkerSignature: varchar("walker_signature"), // Digital confirmation
  ownerSignature: varchar("owner_signature"), // Digital approval
  
  // Immutability Proof
  merkleRoot: varchar("merkle_root"), // Root hash of all GPS points
  verificationStatus: varchar("verification_status").default("verified"), // verified | disputed | under_review
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// WALKER REVIEWS & RATINGS
export const walkerReviews = pgTable("walker_reviews", {
  id: serial("id").primaryKey(),
  reviewId: varchar("review_id").unique().notNull(),
  
  // Review Details
  bookingId: varchar("booking_id").references(() => walkBookings.bookingId).notNull(),
  walkerId: varchar("walker_id").references(() => walkerProfiles.walkerId).notNull(),
  ownerId: varchar("owner_id").notNull(), // Firebase UID
  
  // Ratings (1-5 stars)
  overallRating: integer("overall_rating").notNull(), // 1-5
  punctualityRating: integer("punctuality_rating"), // 1-5
  communicationRating: integer("communication_rating"), // 1-5
  petCareRating: integer("pet_care_rating"), // 1-5
  safetyRating: integer("safety_rating"), // 1-5
  
  // Written Review
  reviewText: text("review_text"),
  reviewPhotos: text("review_photos").array(),
  
  // Highlights (Auto-tagged by AI)
  highlights: text("highlights").array(), // friendly, professional, careful, experienced
  
  // Response from Walker
  walkerResponse: text("walker_response"),
  walkerRespondedAt: timestamp("walker_responded_at"),
  
  // Verification
  isVerifiedWalk: boolean("is_verified_walk").default(true), // Verified via blockchain
  
  // Moderation
  isFlagged: boolean("is_flagged").default(false),
  flaggedReason: varchar("flagged_reason"),
  moderatedBy: varchar("moderated_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// WALK ALERTS & NOTIFICATIONS
export const walkAlerts = pgTable("walk_alerts", {
  id: serial("id").primaryKey(),
  alertId: varchar("alert_id").unique().notNull(),
  
  // Alert Details
  bookingId: varchar("booking_id").references(() => walkBookings.bookingId).notNull(),
  alertType: varchar("alert_type").notNull(), // geofence_exit | emergency_stop | health_concern | completion | cancellation
  severity: varchar("severity").default("info"), // info | warning | critical
  
  // Alert Content
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  actionRequired: boolean("action_required").default(false),
  
  // Recipients
  sentToOwner: boolean("sent_to_owner").default(false),
  sentToWalker: boolean("sent_to_walker").default(false),
  
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  actionTaken: text("action_taken"),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// WALK VIDEO/CAMERA FOOTAGE
export const walkVideos = pgTable("walk_videos", {
  id: serial("id").primaryKey(),
  videoId: varchar("video_id").unique().notNull(),
  
  // Video Details
  bookingId: varchar("booking_id").references(() => walkBookings.bookingId).notNull(),
  videoType: varchar("video_type").notNull(), // body_camera | drone | milestone_photo
  
  // Storage
  videoUrl: varchar("video_url").notNull(), // Firebase Storage URL
  thumbnailUrl: varchar("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  fileSizeMb: decimal("file_size_mb", { precision: 7, scale: 2 }),
  
  // Metadata
  recordedAt: timestamp("recorded_at").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  // AI Analysis
  aiTags: text("ai_tags").array(), // happy_dog, running, playing, resting
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }), // 0-100%
  
  // Access Control
  isPublic: boolean("is_public").default(false), // Can owner share with friends?
  viewCount: integer("view_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod Schemas for Walk My Pet
export const insertWalkerProfileSchema = createInsertSchema(walkerProfiles).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertWalkerProfile = z.infer<typeof insertWalkerProfileSchema>;
export type WalkerProfile = typeof walkerProfiles.$inferSelect;

export const insertWalkBookingSchema = createInsertSchema(walkBookings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertWalkBooking = z.infer<typeof insertWalkBookingSchema>;
export type WalkBooking = typeof walkBookings.$inferSelect;

export const insertWalkGpsTrackingSchema = createInsertSchema(walkGpsTracking).omit({ 
  id: true 
});
export type InsertWalkGpsTracking = z.infer<typeof insertWalkGpsTrackingSchema>;
export type WalkGpsTracking = typeof walkGpsTracking.$inferSelect;

export const insertWalkHealthDataSchema = createInsertSchema(walkHealthData).omit({ 
  id: true 
});
export type InsertWalkHealthData = z.infer<typeof insertWalkHealthDataSchema>;
export type WalkHealthData = typeof walkHealthData.$inferSelect;

// =================== PROVIDER ONBOARDING SYSTEM (UBER-STYLE) ===================
// Invite codes and KYC verification for walkers, sitters, and station operators

// PROVIDER INVITE CODES (Like Uber driver codes)
export const providerInviteCodes = pgTable("provider_invite_codes", {
  id: serial("id").primaryKey(),
  inviteCode: varchar("invite_code").unique().notNull(), // e.g., "WALKER-A8F3H9K2"
  
  // Provider Type
  providerType: varchar("provider_type").notNull(), // walker | sitter | station_operator | admin
  
  // Code Details
  createdByAdminId: varchar("created_by_admin_id").notNull(), // Admin who generated
  maxUses: integer("max_uses").default(1), // How many people can use this code
  currentUses: integer("current_uses").default(0),
  expiresAt: timestamp("expires_at"), // Optional expiry date
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Marketing & Attribution
  campaignName: varchar("campaign_name"), // e.g., "spring_2025_walker_recruitment"
  referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }), // Optional bonus for using code
  
  // Metadata
  notes: text("notes"), // Internal notes about this code
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PROVIDER APPLICATIONS (KYC Onboarding Flow)
export const providerApplications = pgTable("provider_applications", {
  id: serial("id").primaryKey(),
  applicationId: varchar("application_id").unique().notNull(), // APP-YYYY-NNNNNN
  
  // Applicant Info
  userId: varchar("user_id").notNull(), // Firebase UID
  email: varchar("email").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  
  // Provider Type & Invite
  providerType: varchar("provider_type").notNull(), // walker | sitter | station_operator
  inviteCode: varchar("invite_code").references(() => providerInviteCodes.inviteCode),
  
  // Location
  city: varchar("city").notNull(),
  country: varchar("country").notNull().default("IL"),
  
  // Biometric KYC (Banking-Level Verification)
  selfiePhotoUrl: varchar("selfie_photo_url"), // Live selfie
  governmentIdUrl: varchar("government_id_url"), // Passport/ID/Driver's license
  biometricMatchScore: decimal("biometric_match_score", { precision: 5, scale: 2 }), // 0-100
  biometricStatus: varchar("biometric_status").default("pending"), // pending | verified | failed
  biometricVerifiedAt: timestamp("biometric_verified_at"),
  biometricFailureReason: text("biometric_failure_reason"),
  
  // Background Check
  backgroundCheckStatus: varchar("background_check_status").default("pending"), // pending | passed | failed | waived
  backgroundCheckDate: timestamp("background_check_date"),
  backgroundCheckNotes: text("background_check_notes"),
  
  // Criminal Background Check (2026 Spec - 10-year residential history)
  criminalCheckStatus: varchar("criminal_check_status").default("pending"), // pending | passed | failed | requires_review
  criminalCheckProvider: varchar("criminal_check_provider"), // e.g., "Checkr", "Sterling", "Manual Review"
  criminalCheckReportId: varchar("criminal_check_report_id"), // External provider's report ID
  criminalCheckCompletedAt: timestamp("criminal_check_completed_at"),
  residentialHistory: text("residential_history"), // JSON: [{address, city, country, fromDate, toDate}] - 10 years
  criminalCheckConsent: boolean("criminal_check_consent").default(false), // Explicit consent to run check
  criminalCheckConsentDate: timestamp("criminal_check_consent_date"),
  
  // Role-Specific Certifications (2026 Spec)
  petFirstAidCertUrl: varchar("pet_first_aid_cert_url"), // Required for sitters/walkers
  petFirstAidExpiresAt: timestamp("pet_first_aid_expires_at"),
  petFirstAidProvider: varchar("pet_first_aid_provider"), // Red Cross, etc
  
  drivingRecordUrl: varchar("driving_record_url"), // Required for PetTrek drivers
  drivingRecordCheckedAt: timestamp("driving_record_checked_at"),
  drivingRecordStatus: varchar("driving_record_status"), // clean | minor_violations | major_violations | suspended
  drivingRecordNotes: text("driving_record_notes"),
  
  // Insurance Policy Monitoring (2026 Spec)
  insuranceCertUrl: varchar("insurance_cert_url"), // Required for walkers/sitters
  insurancePolicyNumber: varchar("insurance_policy_number"),
  insuranceProvider: varchar("insurance_provider"),
  insuranceExpiresAt: timestamp("insurance_expires_at"),
  insuranceCoverageAmount: decimal("insurance_coverage_amount", { precision: 12, scale: 2 }), // e.g., $1,000,000
  insuranceLastVerified: timestamp("insurance_last_verified"),
  
  businessLicenseUrl: varchar("business_license_url"), // Required for station operators
  businessLicenseExpiresAt: timestamp("business_license_expires_at"),
  
  // Additional Certifications
  certificationUrls: text("certification_urls").array(), // Pet first aid, training certs, etc
  certificationExpiryDates: text("certification_expiry_dates").array(), // Parallel array with expiry dates
  
  // Trust Score (2026 Spec - calculated after approval)
  trustScorePublic: decimal("trust_score_public", { precision: 3, scale: 2 }), // 4.0-5.0 (shown to customers)
  trustScoreInternal: decimal("trust_score_internal", { precision: 5, scale: 2 }), // 0-100 (internal risk score)
  trustScoreLastUpdated: timestamp("trust_score_last_updated"),
  
  // Application Status
  status: varchar("status").default("pending"), // pending | under_review | approved | rejected | withdrawn
  reviewedBy: varchar("reviewed_by"), // Admin user ID
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  // Admin Notes
  internalNotes: text("internal_notes"), // Only visible to admins
  
  // Approval Data (becomes provider profile)
  approvedAsProviderId: varchar("approved_as_provider_id"), // WALKER-UUID / SITTER-UUID / STATION-UUID
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas
export const insertProviderInviteCodeSchema = createInsertSchema(providerInviteCodes).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertProviderInviteCode = z.infer<typeof insertProviderInviteCodeSchema>;
export type ProviderInviteCode = typeof providerInviteCodes.$inferSelect;

export const insertProviderApplicationSchema = createInsertSchema(providerApplications).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertProviderApplication = z.infer<typeof insertProviderApplicationSchema>;
export type ProviderApplication = typeof providerApplications.$inferSelect;

export const insertWalkBlockchainAuditSchema = createInsertSchema(walkBlockchainAudit).omit({ 
  id: true 
});
export type InsertWalkBlockchainAudit = z.infer<typeof insertWalkBlockchainAuditSchema>;
export type WalkBlockchainAudit = typeof walkBlockchainAudit.$inferSelect;

export const insertWalkerReviewSchema = createInsertSchema(walkerReviews).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertWalkerReview = z.infer<typeof insertWalkerReviewSchema>;
export type WalkerReview = typeof walkerReviews.$inferSelect;

export const insertWalkAlertSchema = createInsertSchema(walkAlerts).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertWalkAlert = z.infer<typeof insertWalkAlertSchema>;
export type WalkAlert = typeof walkAlerts.$inferSelect;

export const insertWalkVideoSchema = createInsertSchema(walkVideos).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertWalkVideo = z.infer<typeof insertWalkVideoSchema>;
export type WalkVideo = typeof walkVideos.$inferSelect;

// =================== CONTRACTOR LIFECYCLE MANAGEMENT (2026) ===================

// Contractor Violations & Incidents (feeds into trust scoring)
export const contractorViolations = pgTable("contractor_violations", {
  id: serial("id").primaryKey(),
  violationId: varchar("violation_id").unique().notNull(), // VIO-YYYY-NNNNNN
  
  // Contractor Info
  contractorId: varchar("contractor_id").notNull(), // Firebase UID
  contractorType: varchar("contractor_type").notNull(), // sitter | walker | driver
  
  // Incident Details
  violationType: varchar("violation_type").notNull(), // late_arrival | no_show | safety_issue | unprofessional_behavior | policy_violation | customer_complaint
  severity: varchar("severity").notNull(), // minor | moderate | severe | critical
  
  // Related Booking
  bookingType: varchar("booking_type"), // sitter | walker | pettrek
  bookingId: varchar("booking_id"),
  
  // Description
  incidentDescription: text("incident_description").notNull(),
  evidenceUrls: text("evidence_urls").array(), // Photos, videos, screenshots
  
  // Reporter
  reportedBy: varchar("reported_by"), // Firebase UID (customer or admin)
  reporterType: varchar("reporter_type"), // customer | admin | system
  
  // Resolution
  status: varchar("status").default("under_review"), // under_review | confirmed | dismissed | appealed | resolved
  resolutionNotes: text("resolution_notes"),
  resolvedBy: varchar("resolved_by"), // Admin UID
  resolvedAt: timestamp("resolved_at"),
  
  // Trust Score Impact
  trustScoreImpact: decimal("trust_score_impact", { precision: 5, scale: 2 }), // Negative impact on trust score
  
  // Actions Taken
  warningIssued: boolean("warning_issued").default(false),
  suspensionDays: integer("suspension_days").default(0), // 0 = no suspension
  permanentDeactivation: boolean("permanent_deactivation").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Digital Badges (certifications, achievements)
export const contractorBadges = pgTable("contractor_badges", {
  id: serial("id").primaryKey(),
  badgeId: varchar("badge_id").unique().notNull(), // BADGE-YYYY-NNNNNN
  
  // Contractor Info
  contractorId: varchar("contractor_id").notNull(), // Firebase UID
  contractorType: varchar("contractor_type").notNull(), // sitter | walker | driver
  
  // Badge Details
  badgeType: varchar("badge_type").notNull(), // pet_first_aid | cpr_certified | 5_star_rating | 100_walks | verified_driver | elite_sitter
  badgeName: varchar("badge_name").notNull(), // Display name
  badgeDescription: text("badge_description"),
  badgeIconUrl: varchar("badge_icon_url"), // Icon/image for badge
  
  // Issuance
  issuedBy: varchar("issued_by"), // system | admin_uid
  issuedReason: text("issued_reason"), // Why badge was earned
  
  // Certification (if applicable)
  certificationProvider: varchar("certification_provider"), // Red Cross, etc
  certificationUrl: varchar("certification_url"), // Certificate document
  expiresAt: timestamp("expires_at"), // Null for permanent badges
  
  // Display
  isVisible: boolean("is_visible").default(true), // Show on profile
  isPrimary: boolean("is_primary").default(false), // Featured badge
  
  createdAt: timestamp("created_at").defaultNow(),
  revokedAt: timestamp("revoked_at"), // If badge is revoked
  revokedReason: text("revoked_reason"),
});

// Contractor Earnings Ledger (role-specific payout tracking)
export const contractorEarnings = pgTable("contractor_earnings", {
  id: serial("id").primaryKey(),
  earningId: varchar("earning_id").unique().notNull(), // EARN-YYYY-NNNNNN
  
  // Contractor Info
  contractorId: varchar("contractor_id").notNull(), // Firebase UID
  contractorType: varchar("contractor_type").notNull(), // sitter | walker | driver
  
  // Booking Reference
  bookingType: varchar("booking_type").notNull(), // sitter | walker | pettrek
  bookingId: varchar("booking_id").notNull(),
  
  // Earning Details (role-specific)
  // Sitters: charged by day/hour
  dayCount: integer("day_count"), // For sitters
  hourCount: decimal("hour_count", { precision: 5, scale: 2 }), // For sitters
  
  // Walkers: charged by GPS time/distance
  walkDurationMinutes: integer("walk_duration_minutes"), // For walkers
  walkDistanceKm: decimal("walk_distance_km", { precision: 10, scale: 3 }), // For walkers
  
  // Drivers: charged by mileage + tolls
  tripDistanceKm: decimal("trip_distance_km", { precision: 10, scale: 3 }), // For drivers
  tollCharges: decimal("toll_charges", { precision: 10, scale: 2 }), // For drivers
  
  // Financial
  baseAmount: decimal("base_amount", { precision: 12, scale: 2 }).notNull(), // Base earning
  bonusAmount: decimal("bonus_amount", { precision: 12, scale: 2 }).default(sql`0`), // Tips, bonuses
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).notNull(), // Pet Wash commission
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).default(sql`0`), // Israeli VAT (18%)
  netEarnings: decimal("net_earnings", { precision: 12, scale: 2 }).notNull(), // What contractor receives
  
  currency: varchar("currency").default("ILS"),
  
  // Payout Status
  payoutStatus: varchar("payout_status").default("pending"), // pending | in_escrow | released | paid_out | failed
  escrowReleaseDate: timestamp("escrow_release_date"), // 72 hours after completion
  paidOutAt: timestamp("paid_out_at"),
  payoutMethod: varchar("payout_method"), // COMPLIANCE: bank_transfer ONLY (Pet Wash Ltd mandate - Israeli bank transfers exclusively)
  payoutTransactionId: varchar("payout_transaction_id"), // External payment ID
  
  // Tax Reporting (Israeli compliance)
  taxYear: integer("tax_year"),
  taxQuarter: integer("tax_quarter"), // 1-4
  includeInTaxReport: boolean("include_in_tax_report").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas for new tables
export const insertContractorViolationSchema = createInsertSchema(contractorViolations).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertContractorViolation = z.infer<typeof insertContractorViolationSchema>;
export type ContractorViolation = typeof contractorViolations.$inferSelect;

export const insertContractorBadgeSchema = createInsertSchema(contractorBadges).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertContractorBadge = z.infer<typeof insertContractorBadgeSchema>;
export type ContractorBadge = typeof contractorBadges.$inferSelect;

export const insertContractorEarningSchema = createInsertSchema(contractorEarnings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertContractorEarning = z.infer<typeof insertContractorEarningSchema>;
export type ContractorEarning = typeof contractorEarnings.$inferSelect;

// =================== PETTREK™ TRANSPORT SYSTEM ===================

// PetTrek Providers (Transport Drivers)
export const pettrekProviders = pgTable("pettrek_providers", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").unique().notNull(), // DRIVER-UUID
  userId: varchar("user_id").notNull(), // Firebase UID
  
  // Provider Details
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  
  // Biometric KYC (Banking-Level Verification)
  selfiePhotoUrl: varchar("selfie_photo_url"),
  governmentIdUrl: varchar("government_id_url"),
  biometricMatchScore: decimal("biometric_match_score", { precision: 5, scale: 2 }),
  biometricStatus: varchar("biometric_status").default("pending"), // pending | verified | failed
  biometricVerifiedAt: timestamp("biometric_verified_at"),
  
  // Vehicle Information
  vehicleType: varchar("vehicle_type").notNull(), // sedan | suv | van
  vehicleMake: varchar("vehicle_make"),
  vehicleModel: varchar("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  vehicleColor: varchar("vehicle_color"),
  licensePlate: varchar("license_plate").notNull(),
  vehicleCapacity: varchar("vehicle_capacity").notNull(), // small | medium | large | xlarge
  hasCarrier: boolean("has_carrier").default(false), // Pet carrier available
  hasSeatbelt: boolean("has_seatbelt").default(false), // Pet seatbelt available
  
  // Certifications & Documents
  driversLicenseUrl: varchar("drivers_license_url"),
  insuranceCertUrl: varchar("insurance_cert_url"),
  vehicleRegistrationUrl: varchar("vehicle_registration_url"),
  petFirstAidCert: boolean("pet_first_aid_cert").default(false),
  certificationUrls: text("certification_urls").array(),
  
  // Service Offerings
  offersTransport: boolean("offers_transport").default(true),
  offersSitting: boolean("offers_sitting").default(false),
  offersWalking: boolean("offers_walking").default(false),
  
  // Availability & Status
  isOnline: boolean("is_online").default(false), // Currently accepting jobs
  isAvailable: boolean("is_available").default(true), // Account active
  isVetted: boolean("is_vetted").default(false), // Passed all checks
  vettedAt: timestamp("vetted_at"),
  vettedBy: varchar("vetted_by"), // Admin ID
  
  // Location (for geo-indexed matching)
  lastKnownLatitude: decimal("last_known_latitude", { precision: 10, scale: 7 }),
  lastKnownLongitude: decimal("last_known_longitude", { precision: 10, scale: 7 }),
  lastLocationUpdate: timestamp("last_location_update"),
  serviceRadius: integer("service_radius").default(10), // km
  
  // Performance Metrics
  totalTrips: integer("total_trips").default(0),
  completedTrips: integer("completed_trips").default(0),
  canceledTrips: integer("canceled_trips").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0"),
  
  // Banking Info (for payouts)
  bankAccountNumber: varchar("bank_account_number"),
  bankName: varchar("bank_name"),
  bankBranch: varchar("bank_branch"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  transportLookupIdx: index("idx_pettrek_providers_transport_lookup").on(
    table.isOnline, 
    table.offersTransport, 
    table.isAvailable, 
    table.isVetted
  ),
}));

// PetTrek Trips (Transport Bookings)
export const pettrekTrips = pgTable("pettrek_trips", {
  id: serial("id").primaryKey(),
  tripId: varchar("trip_id").unique().notNull(), // TRK-TIMESTAMP
  
  // Customer & Provider
  customerId: varchar("customer_id").notNull(), // Firebase UID (owner)
  providerId: integer("provider_id").references(() => pettrekProviders.id), // Assigned driver (nullable until accepted)
  
  // Pet Information
  petName: varchar("pet_name").notNull(),
  petType: varchar("pet_type").notNull(), // dog | cat | other
  petSize: varchar("pet_size").notNull(), // small | medium | large | xlarge
  petWeight: decimal("pet_weight", { precision: 5, scale: 2 }), // kg
  specialInstructions: text("special_instructions"),
  
  // Trip Details
  serviceType: varchar("service_type").notNull(), // transport | sitting | stay
  
  // Pickup Location
  pickupLatitude: decimal("pickup_latitude", { precision: 10, scale: 7 }).notNull(),
  pickupLongitude: decimal("pickup_longitude", { precision: 10, scale: 7 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  
  // Dropoff Location
  dropoffLatitude: decimal("dropoff_latitude", { precision: 10, scale: 7 }).notNull(),
  dropoffLongitude: decimal("dropoff_longitude", { precision: 10, scale: 7 }).notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  
  // Scheduled Time
  scheduledPickupTime: timestamp("scheduled_pickup_time").notNull(),
  scheduledDropoffTime: timestamp("scheduled_dropoff_time"),
  
  // Actual Times
  actualPickupTime: timestamp("actual_pickup_time"),
  actualDropoffTime: timestamp("actual_dropoff_time"),
  
  // Trip Status
  status: varchar("status").default("requested").notNull(), // requested | dispatched | accepted | in_progress | completed | canceled
  canceledBy: varchar("canceled_by"), // customer | provider | system
  cancelReason: text("cancel_reason"),
  
  // Fare & Payment
  estimatedFare: decimal("estimated_fare", { precision: 10, scale: 2 }),
  finalFare: decimal("final_fare", { precision: 10, scale: 2 }),
  baseFare: decimal("base_fare", { precision: 10, scale: 2 }),
  distanceFare: decimal("distance_fare", { precision: 10, scale: 2 }),
  timeFare: decimal("time_fare", { precision: 10, scale: 2 }),
  surgeFare: decimal("surge_fare", { precision: 10, scale: 2 }),
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }), // 20% of final fare
  driverPayout: decimal("driver_payout", { precision: 10, scale: 2 }), // 80% of final fare
  paymentStatus: varchar("payment_status").default("pending"), // pending | paid | refunded
  nayaxTransactionId: varchar("nayax_transaction_id"),
  
  // Distance & Duration
  estimatedDistance: decimal("estimated_distance", { precision: 10, scale: 2 }), // km
  estimatedDuration: integer("estimated_duration"), // minutes
  actualDistance: decimal("actual_distance", { precision: 10, scale: 2 }), // km
  actualDuration: integer("actual_duration"), // minutes
  
  // Dynamic Pricing
  isPeakTime: boolean("is_peak_time").default(false),
  surgeMultiplier: decimal("surge_multiplier", { precision: 3, scale: 2 }).default("1.0"),
  
  // Live Tracking
  isLiveTrackingActive: boolean("is_live_tracking_active").default(false),
  lastKnownLatitude: decimal("last_known_latitude", { precision: 10, scale: 7 }),
  lastKnownLongitude: decimal("last_known_longitude", { precision: 10, scale: 7 }),
  lastGPSUpdate: timestamp("last_gps_update"),
  
  // Safety & Compliance
  photoUploadedAtPickup: boolean("photo_uploaded_at_pickup").default(false),
  photoUploadedAtDropoff: boolean("photo_uploaded_at_dropoff").default(false),
  pickupPhotoUrl: varchar("pickup_photo_url"),
  dropoffPhotoUrl: varchar("dropoff_photo_url"),
  
  // Ratings & Reviews
  customerRating: integer("customer_rating"), // 1-5
  customerReview: text("customer_review"),
  driverRating: integer("driver_rating"), // 1-5
  driverReview: text("driver_review"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  customerStatusIdx: index("idx_pettrek_trips_customer_status").on(table.customerId, table.status),
}));

// PetTrek Dispatch Records (Job Offers to Drivers)
export const pettrekDispatchRecords = pgTable("pettrek_dispatch_records", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => pettrekTrips.id).notNull(),
  providerId: integer("provider_id").references(() => pettrekProviders.id).notNull(),
  
  // Dispatch Details
  dispatchedAt: timestamp("dispatched_at").defaultNow(),
  notificationSent: boolean("notification_sent").default(false),
  notificationMethod: varchar("notification_method"), // push | sms | email
  
  // Provider Response
  responseStatus: varchar("response_status").default("pending"), // pending | accepted | declined | expired
  respondedAt: timestamp("responded_at"),
  declineReason: varchar("decline_reason"), // busy | too_far | wrong_vehicle | other
  declineNotes: text("decline_notes"),
  
  // Timing
  expiresAt: timestamp("expires_at"), // Auto-expire after 30 seconds
  isExpired: boolean("is_expired").default(false),
  
  // Distance from Provider (at time of dispatch)
  distanceFromPickup: decimal("distance_from_pickup", { precision: 10, scale: 2 }), // km
  estimatedArrivalTime: integer("estimated_arrival_time"), // minutes
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueTripProvider: uniqueIndex("idx_pettrek_dispatch_unique").on(table.tripId, table.providerId),
  providerStatusIdx: index("idx_pettrek_dispatch_provider").on(table.providerId, table.responseStatus),
}));

// PetTrek GPS Tracking (Real-Time Location During Trip)
export const pettrekGpsTracking = pgTable("pettrek_gps_tracking", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => pettrekTrips.id).notNull(),
  
  // Location Data
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: decimal("accuracy", { precision: 10, scale: 2 }), // meters
  altitude: decimal("altitude", { precision: 10, scale: 2 }), // meters
  heading: decimal("heading", { precision: 5, scale: 2 }), // degrees (0-360)
  speed: decimal("speed", { precision: 5, scale: 2 }), // km/h
  
  // Timestamp
  recordedAt: timestamp("recorded_at").defaultNow(),
  
  // Distance from Destination
  distanceToDestination: decimal("distance_to_destination", { precision: 10, scale: 2 }), // km
  estimatedArrival: integer("estimated_arrival"), // minutes
  
  // Device Info
  deviceInfo: jsonb("device_info"), // Browser/device details for audit
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tripIdx: index("idx_pettrek_gps_trip").on(table.tripId, table.recordedAt),
}));

// Zod Schemas for PetTrek
export const insertPettrekProviderSchema = createInsertSchema(pettrekProviders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertPettrekProvider = z.infer<typeof insertPettrekProviderSchema>;
export type PettrekProvider = typeof pettrekProviders.$inferSelect;

export const insertPettrekTripSchema = createInsertSchema(pettrekTrips).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertPettrekTrip = z.infer<typeof insertPettrekTripSchema>;
export type PettrekTrip = typeof pettrekTrips.$inferSelect;

export const insertPettrekDispatchRecordSchema = createInsertSchema(pettrekDispatchRecords).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertPettrekDispatchRecord = z.infer<typeof insertPettrekDispatchRecordSchema>;
export type PettrekDispatchRecord = typeof pettrekDispatchRecords.$inferSelect;

export const insertPettrekGpsTrackingSchema = createInsertSchema(pettrekGpsTracking).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertPettrekGpsTracking = z.infer<typeof insertPettrekGpsTrackingSchema>;
export type PettrekGpsTracking = typeof pettrekGpsTracking.$inferSelect;

// Electronic Invoices Schemas
export const insertElectronicInvoiceSchema = createInsertSchema(electronicInvoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertElectronicInvoice = z.infer<typeof insertElectronicInvoiceSchema>;
export type ElectronicInvoice = typeof electronicInvoices.$inferSelect;

// =================== BIOMETRIC CERTIFICATE VERIFICATION ===================
// תעודת נכה, גימלאים, תעודת זהות, רשיון נהיגה ממדינות מאושרות
export const biometricCertificateVerifications = pgTable("biometric_certificate_verifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  
  // Document Type
  documentType: varchar("document_type").notNull(), // 'national_id' | 'drivers_license' | 'disability_certificate' | 'retirement_certificate' | 'club_membership'
  documentCountry: varchar("document_country").notNull(), // ISO country code (IL, US, GB, etc.)
  documentNumber: varchar("document_number"), // Encrypted document ID number
  
  // Document Files (Firebase Cloud Storage URLs)
  documentFrontUrl: varchar("document_front_url").notNull(), // Front of ID/certificate
  documentBackUrl: varchar("document_back_url"), // Back of ID (if applicable)
  selfiePhotoUrl: varchar("selfie_photo_url").notNull(), // Current selfie for biometric matching
  
  // Google Vision API - OCR Text Extraction
  ocrTextExtracted: text("ocr_text_extracted"), // Full text extracted from document
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 2 }), // 0-100 confidence
  detectedFields: jsonb("detected_fields"), // { name, idNumber, birthDate, expiryDate, etc. }
  
  // Biometric Face Matching (Google Vision API)
  biometricMatchStatus: varchar("biometric_match_status").default("pending"), // pending | matched | failed | manual_review
  biometricMatchScore: decimal("biometric_match_score", { precision: 5, scale: 2 }), // 0-100 confidence from face comparison
  faceDetectionData: jsonb("face_detection_data"), // Detailed face detection results
  
  // Verification Status
  verificationStatus: varchar("verification_status").default("pending"), // pending | approved | rejected | expired
  verificationMethod: varchar("verification_method").default("automatic"), // automatic | manual | hybrid
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"), // Admin UID who approved (if manual)
  rejectionReason: text("rejection_reason"),
  
  // Special Status Flags
  isDisabilityVerified: boolean("is_disability_verified").default(false), // תעודת נכה approved
  isRetirementVerified: boolean("is_retirement_verified").default(false), // גימלאים approved
  isClubMemberVerified: boolean("is_club_member_verified").default(false),
  
  // Security & Compliance
  ipAddress: varchar("ip_address"), // IP of upload
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint"),
  
  // Document Expiry
  documentExpiryDate: date("document_expiry_date"),
  isExpired: boolean("is_expired").default(false),
  expiryCheckDate: timestamp("expiry_check_date"),
  
  // Audit Trail
  auditLog: jsonb("audit_log"), // Array of {timestamp, action, user, notes}
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_biometric_cert_user").on(table.userId),
  statusIdx: index("idx_biometric_cert_status").on(table.verificationStatus),
  documentTypeIdx: index("idx_biometric_cert_type").on(table.documentType),
}));

export const insertBiometricCertificateVerificationSchema = createInsertSchema(biometricCertificateVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBiometricCertificateVerification = z.infer<typeof insertBiometricCertificateVerificationSchema>;
export type BiometricCertificateVerification = typeof biometricCertificateVerifications.$inferSelect;

// Approved Countries for ID Verification
export const approvedCountries = pgTable("approved_countries", {
  id: serial("id").primaryKey(),
  countryCode: varchar("country_code", { length: 2 }).unique().notNull(), // ISO 3166-1 alpha-2
  countryName: varchar("country_name").notNull(),
  countryNameHe: varchar("country_name_he"), // Hebrew translation
  
  // Document Types Accepted
  acceptsNationalId: boolean("accepts_national_id").default(true),
  acceptsDriversLicense: boolean("accepts_drivers_license").default(true),
  acceptsPassport: boolean("accepts_passport").default(true),
  
  // Verification Requirements
  requiresBiometricMatch: boolean("requires_biometric_match").default(true),
  requiresManualReview: boolean("requires_manual_review").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Biometric & Medical Consent Records (Double Consent System)
// תיעוד בלתי ניתן לשינוי של הסכמות למידע רגיש
export const biometricConsents = pgTable("biometric_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  verificationId: integer("verification_id"), // Link to biometric_certificate_verifications
  
  // Consent Types (כפול)
  consentDocumentProcessing: boolean("consent_document_processing").default(false), // אישור לשימוש במסמכים
  consentBiometricProcessing: boolean("consent_biometric_processing").default(false), // אישור לביומטריה
  
  // Timestamps - Immutable (בלתי ניתן לשינוי)
  documentConsentTimestamp: timestamp("document_consent_timestamp"),
  biometricConsentTimestamp: timestamp("biometric_consent_timestamp"),
  
  // Legal Details
  consentVersion: varchar("consent_version").default("1.0"), // Version of terms
  ipAddress: varchar("ip_address"), // IP when consent was given
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint"),
  
  // Revocation (if user withdraws consent)
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  
  // Immutable Audit Trail
  auditHash: varchar("audit_hash"), // Cryptographic hash for tamper detection
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApprovedCountrySchema = createInsertSchema(approvedCountries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertApprovedCountry = z.infer<typeof insertApprovedCountrySchema>;
export type ApprovedCountry = typeof approvedCountries.$inferSelect;

export const insertBiometricConsentSchema = createInsertSchema(biometricConsents).omit({
  id: true,
  createdAt: true,
});
export type InsertBiometricConsent = z.infer<typeof insertBiometricConsentSchema>;
export type BiometricConsent = typeof biometricConsents.$inferSelect;

// OAuth Consent Records - GDPR Compliance for Social Login
// Immutable audit trail for consent timestamps and legal compliance
export const oauthConsents = pgTable("oauth_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"), // Firebase UID (null before first login)
  provider: varchar("provider").notNull(), // 'google', 'facebook', 'apple', 'microsoft', 'tiktok', 'instagram'
  userEmail: varchar("user_email"),
  
  // Consent metadata
  timestamp: timestamp("timestamp").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  language: varchar("language").default("en"),
  
  // Legal compliance
  consentVersion: varchar("consent_version").default("1.0"),
  privacyPolicyVersion: varchar("privacy_policy_version"),
  termsOfServiceVersion: varchar("terms_of_service_version"),
  
  // Audit trail
  auditHash: varchar("audit_hash"), // Cryptographic hash for tamper detection
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOAuthConsentSchema = createInsertSchema(oauthConsents).omit({
  id: true,
  createdAt: true,
});
export type InsertOAuthConsent = z.infer<typeof insertOAuthConsentSchema>;
export type OAuthConsent = typeof oauthConsents.$inferSelect;

// =================== E-SIGNATURE SYSTEM ===================
// Digital signatures for legal documents (CEO/executives)

export const digitalSignatures = pgTable("digital_signatures", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID of signer
  signerName: varchar("signer_name").notNull(), // e.g., "Nir Hadad"
  signerTitle: varchar("signer_title").notNull(), // e.g., "CEO", "CFO", "Director"
  signerEmail: varchar("signer_email").notNull(),
  
  // Signature Image Storage
  signatureImageUrl: varchar("signature_image_url").notNull(), // Firebase Storage URL
  signatureThumbnailUrl: varchar("signature_thumbnail_url"),
  
  // Security & Validation
  signatureHash: varchar("signature_hash").notNull(), // SHA-256 hash for tampering detection
  isActive: boolean("is_active").default(true),
  
  // Company Information
  companyName: varchar("company_name").default("PetWash Ltd"),
  companyRegistrationNumber: varchar("company_registration_number"), // Israeli company number
  
  // Audit Trail
  createdBy: varchar("created_by").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_digital_signature_user").on(table.userId),
  activeIdx: index("idx_digital_signature_active").on(table.isActive),
}));

export const signedDocuments = pgTable("signed_documents", {
  id: serial("id").primaryKey(),
  signatureId: integer("signature_id").references(() => digitalSignatures.id).notNull(),
  
  // Document Information
  documentType: varchar("document_type").notNull(), // 'contract', 'agreement', 'invoice', 'authorization', 'legal_notice'
  documentTitle: varchar("document_title").notNull(),
  documentDescription: text("document_description"),
  
  // Document Storage
  originalDocumentUrl: varchar("original_document_url").notNull(), // Unsigned version
  signedDocumentUrl: varchar("signed_document_url").notNull(), // Signed version (with signature applied)
  documentHash: varchar("document_hash").notNull(), // SHA-256 hash of signed document
  
  // Parties Involved
  signedBy: varchar("signed_by").notNull(), // Name of signer
  signedByTitle: varchar("signed_by_title"), // Title of signer
  recipientName: varchar("recipient_name"), // Who received the signed document
  recipientEmail: varchar("recipient_email"),
  
  // Legal Details
  signedDate: timestamp("signed_date").notNull(),
  effectiveDate: timestamp("effective_date"), // When the agreement takes effect
  expiryDate: timestamp("expiry_date"), // When the agreement expires (if applicable)
  
  // Metadata
  metadata: jsonb("metadata"), // Additional data (contract value, terms, etc.)
  
  // Email Delivery
  emailSentTo: text("email_sent_to"), // Comma-separated email list
  ccEmails: text("cc_emails"), // CC recipients
  emailSentAt: timestamp("email_sent_at"),
  emailDeliveryStatus: varchar("email_delivery_status"), // 'pending', 'sent', 'delivered', 'failed'
  
  // Blockchain-Style Audit
  auditHash: varchar("audit_hash").notNull(), // Cryptographic hash linking to audit trail
  previousDocumentHash: varchar("previous_document_hash"), // Link to previous signature for chain verification
  
  // Status
  status: varchar("status").default("active"), // 'active', 'revoked', 'expired'
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  signatureIdIdx: index("idx_signed_doc_signature").on(table.signatureId),
  documentTypeIdx: index("idx_signed_doc_type").on(table.documentType),
  statusIdx: index("idx_signed_doc_status").on(table.status),
  signedDateIdx: index("idx_signed_doc_date").on(table.signedDate),
}));

export const insertDigitalSignatureSchema = createInsertSchema(digitalSignatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDigitalSignature = z.infer<typeof insertDigitalSignatureSchema>;
export type DigitalSignature = typeof digitalSignatures.$inferSelect;

export const insertSignedDocumentSchema = createInsertSchema(signedDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSignedDocument = z.infer<typeof insertSignedDocumentSchema>;
export type SignedDocument = typeof signedDocuments.$inferSelect;

// =================== SECURE PERSONAL INBOX SYSTEM ===================
// Internal messaging system with document signing and Google Cloud Storage backup

export const userMessages = pgTable("user_messages", {
  id: serial("id").primaryKey(),
  
  // Sender & Recipient
  senderId: varchar("sender_id").notNull(), // Firebase UID
  senderName: varchar("sender_name").notNull(),
  senderEmail: varchar("sender_email").notNull(),
  recipientId: varchar("recipient_id").notNull(), // Firebase UID
  recipientName: varchar("recipient_name").notNull(),
  recipientEmail: varchar("recipient_email").notNull(),
  
  // Message Content
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  messageType: varchar("message_type").default("general"), // 'general', 'document_request', 'signature_request', 'system'
  priority: varchar("priority").default("normal"), // 'low', 'normal', 'high', 'urgent'
  
  // Status Tracking
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isStarred: boolean("is_starred").default(false),
  isArchived: boolean("is_archived").default(false),
  
  // Security & Backup
  messageHash: varchar("message_hash").notNull(), // SHA-256 hash for tamper detection
  gcsBackupPath: varchar("gcs_backup_path"), // Google Cloud Storage backup location
  backupStatus: varchar("backup_status").default("pending"), // 'pending', 'completed', 'failed'
  encryptedContent: text("encrypted_content"), // Optional end-to-end encryption
  
  // Audit Trail
  auditHash: varchar("audit_hash").notNull(), // Cryptographic audit signature
  previousMessageHash: varchar("previous_message_hash"), // Blockchain-style chain linking
  
  // Soft Delete
  deletedBySender: boolean("deleted_by_sender").default(false),
  deletedByRecipient: boolean("deleted_by_recipient").default(false),
  permanentlyDeleted: boolean("permanently_deleted").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  senderIdx: index("idx_message_sender").on(table.senderId),
  recipientIdx: index("idx_message_recipient").on(table.recipientId),
  typeIdx: index("idx_message_type").on(table.messageType),
  readIdx: index("idx_message_read").on(table.isRead),
  createdIdx: index("idx_message_created").on(table.createdAt),
}));

export const messageAttachments = pgTable("message_attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => userMessages.id, { onDelete: 'cascade' }).notNull(),
  
  // File Information
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(), // 'pdf', 'image', 'document', 'other'
  fileSize: integer("file_size").notNull(), // bytes
  mimeType: varchar("mime_type").notNull(),
  
  // Storage
  gcsPath: varchar("gcs_path").notNull(), // Google Cloud Storage path
  publicUrl: varchar("public_url"), // Signed URL for temporary access
  urlExpiresAt: timestamp("url_expires_at"),
  
  // Security
  fileHash: varchar("file_hash").notNull(), // SHA-256 hash for integrity verification
  isScanned: boolean("is_scanned").default(false), // Virus/malware scan status
  scanStatus: varchar("scan_status").default("pending"), // 'pending', 'clean', 'infected', 'failed'
  
  // Backup & Retention
  backupStatus: varchar("backup_status").default("completed"),
  retentionPolicy: varchar("retention_policy").default("7_years"), // Compliance requirement
  scheduledDeletionDate: timestamp("scheduled_deletion_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  messageIdIdx: index("idx_attachment_message").on(table.messageId),
  fileTypeIdx: index("idx_attachment_type").on(table.fileType),
}));

export const messageSignatureRequests = pgTable("message_signature_requests", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => userMessages.id, { onDelete: 'cascade' }).notNull(),
  signatureId: integer("signature_id").references(() => digitalSignatures.id),
  signedDocumentId: integer("signed_document_id").references(() => signedDocuments.id),
  
  // Request Details
  requestedBy: varchar("requested_by").notNull(), // Firebase UID
  requestedFrom: varchar("requested_from").notNull(), // Firebase UID who should sign
  documentTitle: varchar("document_title").notNull(),
  documentType: varchar("document_type").notNull(),
  documentDescription: text("document_description"),
  
  // Document Storage
  unsignedDocumentGcsPath: varchar("unsigned_document_gcs_path").notNull(),
  signedDocumentGcsPath: varchar("signed_document_gcs_path"),
  
  // Status Tracking
  status: varchar("status").default("pending"), // 'pending', 'viewed', 'signed', 'rejected', 'expired'
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  expiresAt: timestamp("expires_at"), // Signature request expiration
  
  // Notifications
  notificationSent: boolean("notification_sent").default(false),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  
  // Audit
  auditHash: varchar("audit_hash").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  messageIdIdx: index("idx_sig_req_message").on(table.messageId),
  requestedFromIdx: index("idx_sig_req_from").on(table.requestedFrom),
  statusIdx: index("idx_sig_req_status").on(table.status),
}));

export const insertUserMessageSchema = createInsertSchema(userMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserMessage = z.infer<typeof insertUserMessageSchema>;
export type UserMessage = typeof userMessages.$inferSelect;

export const insertMessageAttachmentSchema = createInsertSchema(messageAttachments).omit({
  id: true,
  createdAt: true,
});
export type InsertMessageAttachment = z.infer<typeof insertMessageAttachmentSchema>;
export type MessageAttachment = typeof messageAttachments.$inferSelect;

export const insertMessageSignatureRequestSchema = createInsertSchema(messageSignatureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMessageSignatureRequest = z.infer<typeof insertMessageSignatureRequestSchema>;
export type MessageSignatureRequest = typeof messageSignatureRequests.$inferSelect;

// =================== THE PETWASH CIRCLE - SOCIAL PLATFORM ===================
// Instagram-style social network for pet owners with 7-star luxury design

export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  userName: varchar("user_name").notNull(),
  userEmail: varchar("user_email").notNull(),
  userAvatar: varchar("user_avatar"),
  
  // Post Content
  caption: text("caption"),
  mediaUrls: text("media_urls").array(), // Array of image/video URLs (CDN)
  mediaTypes: text("media_types").array(), // ['image', 'video', 'image']
  location: varchar("location"),
  petTags: text("pet_tags").array(), // Tag pets in photos
  
  // Engagement
  likesCount: integer("likes_count").default(0).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  sharesCount: integer("shares_count").default(0).notNull(),
  
  // Moderation
  moderationStatus: varchar("moderation_status").default("approved"), // 'pending', 'approved', 'rejected', 'flagged'
  moderationReason: text("moderation_reason"),
  moderatedAt: timestamp("moderated_at"),
  moderatedBy: varchar("moderated_by"), // AI or admin UID
  
  // Audit Trail
  contentHash: varchar("content_hash").notNull(), // SHA-256 hash for tamper detection
  auditHash: varchar("audit_hash"), // Blockchain-style audit
  
  // Metadata
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_post_user").on(table.userId),
  createdAtIdx: index("idx_post_created").on(table.createdAt),
  moderationStatusIdx: index("idx_post_moderation").on(table.moderationStatus),
}));

export const socialComments = pgTable("social_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => socialPosts.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").notNull(), // Firebase UID
  userName: varchar("user_name").notNull(),
  userAvatar: varchar("user_avatar"),
  
  // Comment Content
  text: text("text").notNull(),
  parentCommentId: integer("parent_comment_id"), // For nested replies
  
  // Engagement
  likesCount: integer("likes_count").default(0).notNull(),
  
  // Moderation
  moderationStatus: varchar("moderation_status").default("approved"),
  moderationReason: text("moderation_reason"),
  moderatedAt: timestamp("moderated_at"),
  
  // Metadata
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  postIdIdx: index("idx_comment_post").on(table.postId),
  userIdIdx: index("idx_comment_user").on(table.userId),
  createdAtIdx: index("idx_comment_created").on(table.createdAt),
}));

export const socialLikes = pgTable("social_likes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  targetType: varchar("target_type").notNull(), // 'post' or 'comment'
  targetId: integer("target_id").notNull(), // ID of post or comment
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userTargetIdx: uniqueIndex("idx_like_user_target").on(table.userId, table.targetType, table.targetId),
  targetIdx: index("idx_like_target").on(table.targetType, table.targetId),
}));

export const socialFriendships = pgTable("social_friendships", {
  id: serial("id").primaryKey(),
  requesterId: varchar("requester_id").notNull(), // User who sent friend request
  requesterName: varchar("requester_name").notNull(),
  requesterAvatar: varchar("requester_avatar"),
  addresseeId: varchar("addressee_id").notNull(), // User who received request
  addresseeName: varchar("addressee_name").notNull(),
  addresseeAvatar: varchar("addressee_avatar"),
  
  // Status
  status: varchar("status").default("pending").notNull(), // 'pending', 'accepted', 'rejected', 'blocked'
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  requesterIdx: index("idx_friendship_requester").on(table.requesterId),
  addresseeIdx: index("idx_friendship_addressee").on(table.addresseeId),
  statusIdx: index("idx_friendship_status").on(table.status),
  uniqueFriendship: uniqueIndex("idx_unique_friendship").on(table.requesterId, table.addresseeId),
}));

export const socialDirectMessages = pgTable("social_direct_messages", {
  id: serial("id").primaryKey(),
  conversationId: varchar("conversation_id").notNull(), // Hash of sorted user IDs
  senderId: varchar("sender_id").notNull(), // Firebase UID
  senderName: varchar("sender_name").notNull(),
  senderAvatar: varchar("sender_avatar"),
  recipientId: varchar("recipient_id").notNull(), // Firebase UID
  recipientName: varchar("recipient_name").notNull(),
  
  // Message Content
  text: text("text"),
  mediaUrl: varchar("media_url"), // Single image/video attachment
  mediaType: varchar("media_type"), // 'image', 'video'
  
  // Status
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  
  // Moderation
  moderationStatus: varchar("moderation_status").default("approved"),
  moderationReason: text("moderation_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  conversationIdx: index("idx_dm_conversation").on(table.conversationId),
  senderIdx: index("idx_dm_sender").on(table.senderId),
  recipientIdx: index("idx_dm_recipient").on(table.recipientId),
  createdAtIdx: index("idx_dm_created").on(table.createdAt),
}));

export const contentModerationLogs = pgTable("content_moderation_logs", {
  id: serial("id").primaryKey(),
  contentType: varchar("content_type").notNull(), // 'post', 'comment', 'dm'
  contentId: integer("content_id").notNull(),
  userId: varchar("user_id").notNull(), // Firebase UID of content creator
  
  // Content Analyzed
  originalText: text("original_text").notNull(),
  normalizedText: text("normalized_text").notNull(),
  
  // Stage 1: Blacklist Filter
  blacklistViolation: boolean("blacklist_violation").default(false),
  matchedBlacklistTerms: text("matched_blacklist_terms").array(),
  
  // Stage 2: AI Analysis
  aiAnalysisPerformed: boolean("ai_analysis_performed").default(false),
  aiModel: varchar("ai_model"), // 'gemini-2.5-flash'
  aiPrompt: text("ai_prompt"),
  aiResponse: text("ai_response"),
  aiDecision: varchar("ai_decision"), // 'ALLOWED', 'SUSPEND', 'FLAGGED'
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 5, scale: 2 }),
  
  // Final Decision
  finalDecision: varchar("final_decision").notNull(), // 'approved', 'rejected'
  rejectionReason: text("rejection_reason"),
  
  // Flagged Terms (for system learning)
  newAbusiveTermsDetected: text("new_abusive_terms_detected").array(),
  
  // User Impact
  userSuspended: boolean("user_suspended").default(false),
  suspensionDuration: integer("suspension_duration_hours"),
  
  // Processing Metadata
  processingTimeMs: integer("processing_time_ms"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_moderation_user").on(table.userId),
  contentTypeIdx: index("idx_moderation_type").on(table.contentType),
  finalDecisionIdx: index("idx_moderation_decision").on(table.finalDecision),
  createdAtIdx: index("idx_moderation_created").on(table.createdAt),
}));

// Zod Schemas
export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  sharesCount: true,
  moderationStatus: true,
  moderatedAt: true,
  moderatedBy: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPost = typeof socialPosts.$inferSelect;

export const insertSocialCommentSchema = createInsertSchema(socialComments).omit({
  id: true,
  likesCount: true,
  moderationStatus: true,
  moderatedAt: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSocialComment = z.infer<typeof insertSocialCommentSchema>;
export type SocialComment = typeof socialComments.$inferSelect;

export const insertSocialDirectMessageSchema = createInsertSchema(socialDirectMessages).omit({
  id: true,
  isRead: true,
  readAt: true,
  isDeleted: true,
  deletedAt: true,
  moderationStatus: true,
  createdAt: true,
});
export type InsertSocialDirectMessage = z.infer<typeof insertSocialDirectMessageSchema>;
export type SocialDirectMessage = typeof socialDirectMessages.$inferSelect;

export const insertSocialFriendshipSchema = createInsertSchema(socialFriendships).omit({
  id: true,
  status: true,
  acceptedAt: true,
  rejectedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSocialFriendship = z.infer<typeof insertSocialFriendshipSchema>;
export type SocialFriendship = typeof socialFriendships.$inferSelect;

// =================== PET AWARENESS DAYS & PROMOTIONAL CAMPAIGNS ===================
// International pet awareness calendar with multi-language promotional campaigns

export const petAwarenessDays = pgTable("pet_awareness_days", {
  id: serial("id").primaryKey(),
  
  // Event Identification
  slug: varchar("slug").notNull().unique(), // 'international-dog-day', 'national-cat-day'
  eventDate: date("event_date").notNull(), // Specific date (e.g., '2026-08-26')
  recurrenceType: varchar("recurrence_type").default("annual"), // 'annual', 'monthly', 'weekly', 'one_time'
  
  // Multi-language Content (JSONB for localized strings)
  titleLocales: jsonb("title_locales").notNull(), // { "en": "International Dog Day", "he": "יום הכלב הבינלאומי" }
  descriptionLocales: jsonb("description_locales"), // { "en": "Celebrates all dogs...", "he": "חוגגים את כל הכלבים..." }
  
  // Event Metadata
  petTypes: text("pet_types").array(), // ['dog'], ['cat'], ['dog', 'cat', 'bird']
  category: varchar("category").notNull(), // 'celebration', 'awareness', 'health', 'adoption', 'memorial'
  isGlobal: boolean("is_global").default(true), // True for international, false for country-specific
  targetCountries: text("target_countries").array(), // ['IL', 'US', 'AU'] - null means all countries
  
  // Campaign Hook
  defaultCampaignType: varchar("default_campaign_type"), // 'discount', 'awareness', 'donation', 'social'
  suggestedDiscountPercent: integer("suggested_discount_percent"), // 10, 20, 30
  
  // Display
  heroImageUrl: varchar("hero_image_url"),
  iconEmoji: varchar("icon_emoji"), // 🐕, 🐈, 🐾
  themeColor: varchar("theme_color"), // '#FF6B6B' for styling
  
  // Status
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: index("idx_awareness_slug").on(table.slug),
  dateIdx: index("idx_awareness_date").on(table.eventDate),
  categoryIdx: index("idx_awareness_category").on(table.category),
}));

export const promotionalCampaigns = pgTable("promotional_campaigns", {
  id: serial("id").primaryKey(),
  
  // Campaign Basics
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  awarenessDayId: integer("awareness_day_id").references(() => petAwarenessDays.id),
  
  // Status & Lifecycle
  status: varchar("status").default("draft").notNull(), // 'draft', 'pending_review', 'approved', 'live', 'paused', 'expired', 'cancelled'
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  
  // Targeting
  targetSegments: jsonb("target_segments"), // { "loyaltyTiers": ["gold", "platinum"], "petTypes": ["dog"] }
  targetLocales: text("target_locales").array(), // ['en', 'he', 'ar']
  targetCountries: text("target_countries").array(), // ['IL', 'US']
  
  // Discount Configuration
  discountType: varchar("discount_type").notNull(), // 'percentage', 'fixed', 'bundle', 'referral', 'bogo'
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(), // 20.00 for 20%, or 50.00 for ₪50
  discountCurrency: varchar("discount_currency").default("ILS"), // For fixed discounts
  maxRedemptions: integer("max_redemptions"), // null = unlimited
  currentRedemptions: integer("current_redemptions").default(0),
  minPurchaseAmount: decimal("min_purchase_amount", { precision: 10, scale: 2 }),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }), // Cap for percentage discounts
  
  // Promo Code
  promoCode: varchar("promo_code"), // 'DOGDAY2026'
  isAutoApply: boolean("is_auto_apply").default(false), // Auto-apply at checkout
  
  // Content (Multi-language)
  contentLocales: jsonb("content_locales").notNull(), // { "en": { "title": "...", "description": "..." }, "he": { ... } }
  heroAssets: jsonb("hero_assets"), // { "desktop": "url", "mobile": "url" }
  
  // Social Boost
  socialBoostEnabled: boolean("social_boost_enabled").default(false),
  socialBoostBudget: decimal("social_boost_budget", { precision: 10, scale: 2 }),
  scheduledPostIds: jsonb("scheduled_post_ids"), // [123, 456] - social post IDs to boost
  
  // Approval
  requiresManualReview: boolean("requires_manual_review").default(true),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Creator & Audit
  createdBy: varchar("created_by").notNull(),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: index("idx_campaign_slug").on(table.slug),
  statusIdx: index("idx_campaign_status").on(table.status),
  startAtIdx: index("idx_campaign_start").on(table.startAt),
  promoCodeIdx: index("idx_campaign_promo").on(table.promoCode),
}));

export const campaignRedemptions = pgTable("campaign_redemptions", {
  id: serial("id").primaryKey(),
  
  campaignId: integer("campaign_id").references(() => promotionalCampaigns.id).notNull(),
  userId: varchar("user_id").notNull(), // Firebase UID
  userEmail: varchar("user_email"),
  
  // Redemption Details
  bookingId: integer("booking_id"), // If used for a booking
  orderId: varchar("order_id"), // Generic order reference
  discountApplied: decimal("discount_applied", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Tracking
  promoCodeUsed: varchar("promo_code_used"),
  sourceChannel: varchar("source_channel"), // 'web', 'app', 'social', 'email'
  
  // Metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
}, (table) => ({
  campaignIdx: index("idx_redemption_campaign").on(table.campaignId),
  userIdx: index("idx_redemption_user").on(table.userId),
  dateIdx: index("idx_redemption_date").on(table.redeemedAt),
}));

// Zod Schemas for Promotional Campaigns
export const insertPetAwarenessDaySchema = createInsertSchema(petAwarenessDays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPetAwarenessDay = z.infer<typeof insertPetAwarenessDaySchema>;
export type PetAwarenessDay = typeof petAwarenessDays.$inferSelect;

export const insertPromotionalCampaignSchema = createInsertSchema(promotionalCampaigns).omit({
  id: true,
  currentRedemptions: true,
  reviewedBy: true,
  reviewedAt: true,
  approvedBy: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPromotionalCampaign = z.infer<typeof insertPromotionalCampaignSchema>;
export type PromotionalCampaign = typeof promotionalCampaigns.$inferSelect;

export const insertCampaignRedemptionSchema = createInsertSchema(campaignRedemptions).omit({
  id: true,
  redeemedAt: true,
});
export type InsertCampaignRedemption = z.infer<typeof insertCampaignRedemptionSchema>;
export type CampaignRedemption = typeof campaignRedemptions.$inferSelect;

// =================== ISRAELI EXPENSE MANAGEMENT SYSTEM ===================

// Tax Rate History - Regulatory Sync Architecture (2025 FinTech Best Practice)
// Stores all tax rates with effective dates for automatic regulatory compliance
export const taxRateHistory = pgTable("tax_rate_history", {
  id: serial("id").primaryKey(),
  
  // Tax Type
  taxType: varchar("tax_type").notNull(), // 'vat', 'municipal', 'corporate', 'customs'
  
  // Rate Information
  rate: decimal("rate", { precision: 5, scale: 4 }).notNull(), // 0.1800 (18%), 0.0000 (0%)
  ratePercent: decimal("rate_percent", { precision: 5, scale: 2 }).notNull(), // 18.00, 0.00 (for display)
  
  // Applicability
  category: varchar("category"), // 'standard', 'zero_rate', 'exempt', 'reduced', 'export'
  description: text("description"), // 'Standard VAT Rate'
  descriptionHe: text("description_he"), // 'שיעור מע"מ רגיל'
  
  // Temporal Validity
  effectiveFrom: date("effective_from").notNull(), // Date when this rate becomes active
  effectiveTo: date("effective_to"), // Date when this rate expires (null = current)
  
  // Regulatory Source
  regulatorySource: text("regulatory_source"), // 'Israeli Tax Authority Directive 2025/04'
  regulatoryUrl: text("regulatory_url"), // Link to official announcement
  
  // Metadata
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"), // Admin who added this rate
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  taxTypeIdx: index("idx_tax_type").on(table.taxType),
  effectiveFromIdx: index("idx_effective_from").on(table.effectiveFrom),
  activeIdx: index("idx_active").on(table.isActive),
}));

// Employee Expenses - Israeli FinTech 2025 Architecture
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  
  // Employee & Organization
  employeeId: varchar("employee_id").notNull(), // Firebase UID
  employeeName: varchar("employee_name").notNull(),
  employeeEmail: varchar("employee_email").notNull(),
  businessId: varchar("business_id").default("petwash-ltd").notNull(),
  departmentId: varchar("department_id"), // For multi-department companies
  
  // Date & Period
  expenseDate: date("expense_date").notNull(), // Date on receipt
  reportPeriod: varchar("report_period").notNull(), // 'YYYY-MM' for tax reporting
  
  // Amounts (ILS)
  totalAmountILS: decimal("total_amount_ils", { precision: 10, scale: 2 }).notNull(), // Gross amount (כולל מע"מ)
  netAmountILS: decimal("net_amount_ils", { precision: 10, scale: 2 }).notNull(), // Net amount (ללא מע"מ)
  vatAmountILS: decimal("vat_amount_ils", { precision: 10, scale: 2 }).notNull(), // VAT amount (סכום מע"מ)
  
  // Dynamic Tax Rates (NOT HARDCODED)
  vatRateApplied: decimal("vat_rate_applied", { precision: 5, scale: 4 }).notNull(), // Actual VAT rate used (0.1800, 0.0000)
  vatExemptionReason: varchar("vat_exemption_reason"), // 'zero_rate_export', 'exempt_education', 'exempt_flight'
  municipalTaxRate: decimal("municipal_tax_rate", { precision: 5, scale: 4 }), // Municipal taxes (ארנונה, etc.)
  municipalTaxAmount: decimal("municipal_tax_amount", { precision: 10, scale: 2 }),
  
  // Tax Deductibility
  isTaxDeductible: boolean("is_tax_deductible").default(true),
  deductibilityReason: text("deductibility_reason"), // Why deductible or not
  
  // Category
  category: varchar("category").notNull(), // 'meals', 'travel', 'office_supplies', 'training', 'accommodation', 'mileage', 'entertainment', 'other'
  subcategory: varchar("subcategory"), // More granular categorization
  description: text("description").notNull(), // User description
  
  // Receipt & Proof
  receiptImageUrls: text("receipt_image_urls").array(), // Multiple receipt images
  receiptOcrText: text("receipt_ocr_text"), // Extracted text from OCR
  receiptVendorName: varchar("receipt_vendor_name"), // Vendor extracted from OCR
  receiptVendorTaxId: varchar("receipt_vendor_tax_id"), // Israeli Tax ID (מספר עוסק מורשה)
  
  // Status & Approval Workflow
  status: varchar("status").default("draft").notNull(), // 'draft', 'pending', 'approved', 'rejected', 'reimbursed'
  submittedAt: timestamp("submitted_at"),
  
  // Approver Chain
  approverId: varchar("approver_id"), // Manager/supervisor
  approverName: varchar("approver_name"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Policy Compliance
  policyViolations: jsonb("policy_violations"), // Array of violation objects
  policyStatus: varchar("policy_status").default("compliant"), // 'compliant', 'warning', 'violation'
  
  // Mileage (if applicable)
  mileageKm: decimal("mileage_km", { precision: 10, scale: 2 }),
  mileageRatePerKm: decimal("mileage_rate_per_km", { precision: 5, scale: 2 }),
  
  // Location Data
  locationName: varchar("location_name"), // Where expense occurred
  locationCoordinates: varchar("location_coordinates"), // Lat/Long for verification
  
  // Reimbursement
  reimbursementStatus: varchar("reimbursement_status").default("pending"), // 'pending', 'processed', 'paid'
  reimbursementDate: date("reimbursement_date"),
  reimbursementMethod: varchar("reimbursement_method"), // 'bank_transfer', 'payroll', 'check'
  
  // Audit Trail
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  lastModifiedBy: varchar("last_modified_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_expense_employee").on(table.employeeId),
  statusIdx: index("idx_expense_status").on(table.status),
  dateIdx: index("idx_expense_date").on(table.expenseDate),
  reportPeriodIdx: index("idx_expense_period").on(table.reportPeriod),
  approverIdx: index("idx_expense_approver").on(table.approverId),
}));

// Zod Schemas for Expenses
export const insertTaxRateHistorySchema = createInsertSchema(taxRateHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTaxRateHistory = z.infer<typeof insertTaxRateHistorySchema>;
export type TaxRateHistory = typeof taxRateHistory.$inferSelect;

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// =================== PASSPORT VERIFICATION (KYC) ===================
export const passportVerifications = pgTable("passport_verifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  
  // Passport Data
  documentType: varchar("document_type").notNull(), // 'P'=Passport, 'V'=Visa, 'I'=ID
  
  // SECURITY WARNING: These fields contain sensitive PII
  // PRODUCTION REQUIREMENT: Must encrypt before storage using field-level encryption
  // Recommended: AES-256-GCM with Google Cloud KMS or AWS KMS
  passportNumber: varchar("passport_number").notNull(), // ⚠️ ENCRYPT IN PRODUCTION
  surname: varchar("surname").notNull(), // ⚠️ ENCRYPT IN PRODUCTION
  givenNames: varchar("given_names").notNull(), // ⚠️ ENCRYPT IN PRODUCTION
  dateOfBirth: date("date_of_birth").notNull(), // ⚠️ ENCRYPT IN PRODUCTION
  
  countryCode: varchar("country_code", { length: 3 }).notNull(), // ISO 3166-1 alpha-3 (OK to store)
  nationality: varchar("nationality", { length: 3 }).notNull(), // ISO 3166-1 alpha-3 (OK to store)
  sex: varchar("sex", { length: 1 }).notNull(), // 'M', 'F', 'X' (Low sensitivity)
  
  // Validity
  expiryDate: date("expiry_date").notNull(),
  isExpired: boolean("is_expired").default(false),
  
  // Verification Status
  verificationStatus: varchar("verification_status").default("pending"), // 'pending', 'approved', 'rejected'
  verifiedBy: varchar("verified_by"), // Admin UID who approved
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  
  // Image Storage (Google Cloud Storage URLs)
  passportImageUrl: varchar("passport_image_url"),
  selfieImageUrl: varchar("selfie_image_url"), // For biometric matching
  
  // MRZ Data
  // SECURITY WARNING: Raw MRZ contains all personal data
  // PRODUCTION REQUIREMENT: Must encrypt before storage
  rawMRZ: text("raw_mrz"), // ⚠️ ENCRYPT IN PRODUCTION - contains all PII
  mrzConfidence: decimal("mrz_confidence", { precision: 5, scale: 2 }), // 0-100 (OK to store)
  
  // Security & Compliance
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_passport_user").on(table.userId),
  statusIdx: index("idx_passport_status").on(table.verificationStatus),
  passportNumIdx: index("idx_passport_number").on(table.passportNumber),
}));

export const insertPassportVerificationSchema = createInsertSchema(passportVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPassportVerification = z.infer<typeof insertPassportVerificationSchema>;
export type PassportVerification = typeof passportVerifications.$inferSelect;

// =================== E-SIGNATURE (DOCUSEAL) ===================
// Free open-source e-signature with Hebrew RTL support
export const signingSessions = pgTable("signing_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // Firebase UID
  submissionId: varchar("submission_id").unique(), // DocuSeal submission ID
  templateSlug: varchar("template_slug").notNull(), // DocuSeal template identifier
  documentType: varchar("document_type").notNull(), // 'waiver', 'service_agreement', 'consent_form'
  documentName: varchar("document_name").notNull(),
  language: varchar("language").default("he"), // en, he, ar, es, fr, ru
  status: varchar("status").default("pending"), // 'pending', 'sent', 'opened', 'completed', 'expired'
  signerEmail: varchar("signer_email").notNull(),
  signerName: varchar("signer_name").notNull(),
  signerPhone: varchar("signer_phone"),
  
  // Embedded Signing URL
  signingUrl: varchar("signing_url"), // Direct link for mobile browsers
  embedCode: text("embed_code"), // HTML embed code
  
  // Completion Data
  signedDocumentUrl: varchar("signed_document_url"), // URL to completed PDF
  auditLogUrl: varchar("audit_log_url"), // Audit trail PDF
  certificateUrl: varchar("certificate_url"), // Completion certificate
  
  // Timestamps
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  signedAt: timestamp("signed_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  
  // Audit Trail
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  deviceInfo: jsonb("device_info"), // Mobile device details
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_signing_user").on(table.userId),
  statusIdx: index("idx_signing_status").on(table.status),
  submissionIdx: index("idx_signing_submission").on(table.submissionId),
}));

export const insertSigningSessionSchema = createInsertSchema(signingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSigningSession = z.infer<typeof insertSigningSessionSchema>;
export type SigningSession = typeof signingSessions.$inferSelect;

// =================== TWO-SIDED REVIEW SYSTEM (2026 Contractor Lifecycle) ===================
// Unified review system for all contractor types (sitters, walkers, drivers)
// Supports both owner → contractor AND contractor → owner reviews

export const contractorReviews = pgTable("contractor_reviews", {
  id: serial("id").primaryKey(),
  reviewId: varchar("review_id").unique().notNull(), // REV-YYYY-NNNN
  
  // Booking Reference (linked to specific service)
  bookingType: varchar("booking_type").notNull(), // sitter | walker | pettrek
  bookingId: varchar("booking_id").notNull(), // Universal booking ID
  
  // Review Direction (TWO-SIDED)
  reviewType: varchar("review_type").notNull(), // owner_to_contractor | contractor_to_owner
  
  // Reviewer (Who is writing the review)
  reviewerId: varchar("reviewer_id").notNull(), // Firebase UID or contractor ID
  reviewerName: varchar("reviewer_name").notNull(),
  reviewerType: varchar("reviewer_type").notNull(), // owner | contractor
  
  // Subject (Who is being reviewed)
  subjectId: varchar("subject_id").notNull(), // Firebase UID or contractor ID
  subjectName: varchar("subject_name").notNull(),
  subjectType: varchar("subject_type").notNull(), // owner | sitter | walker | driver
  
  // Star Ratings (1-5 scale, weighted average for Trust Score)
  overallRating: integer("overall_rating").notNull(), // 1-5 (REQUIRED)
  punctualityRating: integer("punctuality_rating"), // 1-5 (optional)
  communicationRating: integer("communication_rating"), // 1-5 (optional)
  professionalismRating: integer("professionalism_rating"), // 1-5 (optional)
  cleanlinessRating: integer("cleanliness_rating"), // 1-5 (for sitters, optional)
  safetyRating: integer("safety_rating"), // 1-5 (for walkers/drivers, optional)
  
  // Written Review
  reviewText: text("review_text"),
  reviewPhotos: text("review_photos").array(), // URLs to uploaded photos
  
  // AI-Generated Highlights (Auto-tagged by Gemini 2.5 Flash)
  highlights: text("highlights").array(), // friendly, professional, careful, experienced, punctual
  
  // Response System (Subject can respond to review)
  hasResponse: boolean("has_response").default(false),
  responseText: text("response_text"),
  respondedAt: timestamp("responded_at"),
  respondedBy: varchar("responded_by"), // Firebase UID of responder
  
  // Automatic Flagging Service (2026 Spec Requirement)
  isFlagged: boolean("is_flagged").default(false),
  flaggedKeywords: text("flagged_keywords").array(), // ['damaged', 'late', 'aggressive', 'unsafe']
  flaggedReason: varchar("flagged_reason"), // profanity | safety_concern | dispute | spam
  flaggedAt: timestamp("flagged_at"),
  moderatedBy: varchar("moderated_by"), // Admin who reviewed flag
  moderationNotes: text("moderation_notes"),
  moderationStatus: varchar("moderation_status").default("pending"), // pending | approved | removed
  
  // Verification (Ensures only real customers/contractors can review)
  isVerifiedBooking: boolean("is_verified_booking").default(true), // Booking must be completed
  verificationMethod: varchar("verification_method"), // blockchain | payment | gps
  
  // Visibility & Status
  isVisible: boolean("is_visible").default(true), // Can be hidden by admin
  isPublic: boolean("is_public").default(true), // Public on profile
  
  // Trust Score Impact (Calculated by AI Trust Scoring Engine)
  trustScoreImpact: decimal("trust_score_impact", { precision: 5, scale: 2 }), // -1.00 to +1.00
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("idx_contractor_reviews_booking").on(table.bookingId),
  reviewerIdx: index("idx_contractor_reviews_reviewer").on(table.reviewerId),
  subjectIdx: index("idx_contractor_reviews_subject").on(table.subjectId),
  typeIdx: index("idx_contractor_reviews_type").on(table.reviewType),
  flaggedIdx: index("idx_contractor_reviews_flagged").on(table.isFlagged),
}));

export const insertContractorReviewSchema = createInsertSchema(contractorReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContractorReview = z.infer<typeof insertContractorReviewSchema>;
export type ContractorReview = typeof contractorReviews.$inferSelect;

// AI TRUST SCORING ENGINE (2026 Spec - Microservice)
// Combines vetting status + review stars + policy violations
export const contractorTrustScores = pgTable("contractor_trust_scores", {
  id: serial("id").primaryKey(),
  
  // Contractor Identity
  contractorId: varchar("contractor_id").unique().notNull(), // Provider ID
  contractorType: varchar("contractor_type").notNull(), // sitter | walker | driver | station_operator
  
  // Transparent Trust Score (Visible to Owners) - 4.0 to 5.0 scale
  publicTrustScore: decimal("public_trust_score", { precision: 3, scale: 2 }).default("4.50"), // 4.00-5.00
  
  // Internal Risk Score (For Management Only) - 0 to 100 scale
  internalRiskScore: integer("internal_risk_score").default(50), // 0 (high risk) to 100 (low risk)
  
  // Component Scores (Weighted Average)
  vettingScore: decimal("vetting_score", { precision: 3, scale: 2 }), // Background check + KYC + certifications
  reviewScore: decimal("review_score", { precision: 3, scale: 2 }), // Average star rating from all reviews
  complianceScore: decimal("compliance_score", { precision: 3, scale: 2 }), // Policy violations, complaints
  experienceScore: decimal("experience_score", { precision: 3, scale: 2 }), // Completed bookings, tenure
  
  // Statistics
  totalReviews: integer("total_reviews").default(0),
  totalBookings: integer("total_bookings").default(0),
  totalViolations: integer("total_violations").default(0),
  totalComplaints: integer("total_complaints").default(0),
  
  // Status Flags
  isActiveContractor: boolean("is_active_contractor").default(true),
  isRecommended: boolean("is_recommended").default(false), // Top 10% contractors
  isPremiumBadge: boolean("is_premium_badge").default(false), // Elite contractors (5.0 score + 100+ bookings)
  
  // Last Calculation
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow(),
  calculationNotes: text("calculation_notes"), // AI reasoning for score changes
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  contractorIdx: uniqueIndex("idx_trust_contractor").on(table.contractorId),
  scoreIdx: index("idx_trust_public_score").on(table.publicTrustScore),
  recommendedIdx: index("idx_trust_recommended").on(table.isRecommended),
}));

export const insertContractorTrustScoreSchema = createInsertSchema(contractorTrustScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContractorTrustScore = z.infer<typeof insertContractorTrustScoreSchema>;
export type ContractorTrustScore = typeof contractorTrustScores.$inferSelect;

// REVIEW FLAGGING RULES (Automatic Detection)
// System automatically flags reviews containing specific keywords
export const reviewFlaggingRules = pgTable("review_flagging_rules", {
  id: serial("id").primaryKey(),
  
  // Rule Configuration
  keyword: varchar("keyword").notNull(), // damaged, late, aggressive, unsafe, stolen, rude
  flagReason: varchar("flag_reason").notNull(), // safety_concern | dispute | profanity
  severity: varchar("severity").default("medium"), // low | medium | high | critical
  language: varchar("language").default("en"), // en | he | ar | es | fr | ru
  
  // Auto-Actions
  autoHideReview: boolean("auto_hide_review").default(false), // Immediately hide from public
  requireModeration: boolean("require_moderation").default(true), // Send to admin queue
  notifyManagement: boolean("notify_management").default(false), // Send Slack alert
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  keywordIdx: index("idx_flagging_keyword").on(table.keyword),
  activeIdx: index("idx_flagging_active").on(table.isActive),
}));

export const insertReviewFlaggingRuleSchema = createInsertSchema(reviewFlaggingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReviewFlaggingRule = z.infer<typeof insertReviewFlaggingRuleSchema>;
export type ReviewFlaggingRule = typeof reviewFlaggingRules.$inferSelect;

// =================== PET WASH ACADEMY™ (TRAINER PLATFORM) ===================
// Professional pet trainers marketplace integrated with booking ecosystem

export const trainers = pgTable("trainers", {
  id: serial("id").primaryKey(),
  trainerId: varchar("trainer_id").unique().notNull(), // TR-YYYY-NNNN format
  
  // Firebase Auth Integration (like walkers/sitters)
  userId: varchar("user_id").unique().notNull(), // Firebase UID
  
  // Profile Information
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone").notNull(),
  profilePhotoUrl: varchar("profile_photo_url"),
  
  // Professional Details
  bio: text("bio"), // Short biography
  bioHe: text("bio_he"), // Hebrew biography
  specialties: text("specialties").array(), // obedience, agility, puppy_training, behavioral_modification, etc.
  certifications: text("certifications").array(), // URLs to certification documents
  yearsOfExperience: integer("years_of_experience").default(0),
  
  // Service Configuration
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(), // ₪ per hour
  currency: varchar("currency").default("ILS"),
  serviceTypes: text("service_types").array(), // in_home, park, station
  serviceArea: text("service_area"), // Geographic coverage
  languages: text("languages").array().default(sql`ARRAY['he', 'en']`), // Languages spoken
  
  // Availability
  availabilitySchedule: jsonb("availability_schedule"), // Weekly availability slots
  isAcceptingBookings: boolean("is_accepting_bookings").default(true),
  
  // Verification & Compliance (2026 Spec)
  verificationStatus: varchar("verification_status").default("pending"), // pending | approved | rejected | suspended
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"), // Admin ID who approved
  
  // KYC Documents (Firebase Storage)
  idDocumentUrl: varchar("id_document_url"), // Government ID
  certificationDocUrls: text("certification_doc_urls").array(), // Training certificates
  insuranceCertUrl: varchar("insurance_cert_url"), // Liability insurance
  
  // Ratings & Reviews (calculated from contractorReviews table)
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("4.50"), // 1.00-5.00
  totalReviews: integer("total_reviews").default(0),
  totalSessions: integer("total_sessions").default(0), // Completed bookings
  
  // Trust Score Integration
  trustScoreId: varchar("trust_score_id"), // Links to contractorTrustScores
  
  // Gold Badge (Certified Trainer)
  isCertified: boolean("is_certified").default(false), // Shows gold "Certified" badge
  
  // Financial (Payout System - 80% trainer, 20% platform by default)
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("20.00"), // Platform commission %
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isSuspended: boolean("is_suspended").default(false),
  suspensionReason: text("suspension_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex("idx_trainers_user").on(table.userId),
  emailIdx: index("idx_trainers_email").on(table.email),
  verificationIdx: index("idx_trainers_verification").on(table.verificationStatus),
  certifiedIdx: index("idx_trainers_certified").on(table.isCertified),
  activeIdx: index("idx_trainers_active").on(table.isActive),
}));

export const insertTrainerSchema = createInsertSchema(trainers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrainer = z.infer<typeof insertTrainerSchema>;
export type Trainer = typeof trainers.$inferSelect;

// Trainer Bookings (follows walker/sitter booking pattern)
export const trainerBookings = pgTable("trainer_bookings", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").unique().notNull(), // TRN-YYYY-NNNN format
  
  // Customer & Trainer
  userId: varchar("user_id").notNull(), // Firebase UID (customer)
  trainerId: integer("trainer_id").references(() => trainers.id).notNull(),
  trainerUserId: varchar("trainer_user_id").notNull(), // Trainer's Firebase UID
  
  // Pet Information
  petName: varchar("pet_name").notNull(),
  petBreed: varchar("pet_breed"),
  petAge: integer("pet_age"),
  specialRequirements: text("special_requirements"),
  
  // Session Details
  sessionDate: timestamp("session_date").notNull(),
  sessionDuration: integer("session_duration").notNull(), // Duration in minutes
  sessionType: varchar("session_type").notNull(), // in_home | park | station
  sessionLocation: text("session_location"), // Address or station name
  locationCoordinates: jsonb("location_coordinates"), // { lat, lng }
  
  // Training Focus
  trainingGoals: text("training_goals").array(), // obedience, leash_training, socialization, etc.
  customerNotes: text("customer_notes"),
  trainerNotes: text("trainer_notes"), // Post-session notes from trainer
  
  // Pricing
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 20% commission
  trainerPayout: decimal("trainer_payout", { precision: 10, scale: 2 }).notNull(), // 80% to trainer
  currency: varchar("currency").default("ILS"),
  
  // Payment Integration (Nayax/Pet Wash Wallet)
  paymentMethod: varchar("payment_method"), // nayax | wallet | apple_pay | google_pay
  paymentStatus: varchar("payment_status").default("pending"), // pending | completed | refunded | failed
  paymentIntentId: varchar("payment_intent_id"), // Nayax transaction ID
  paidAt: timestamp("paid_at"),
  
  // Escrow System (72-hour hold like Sitter Suite)
  escrowStatus: varchar("escrow_status").default("pending"), // pending | held | released | refunded
  escrowHeldAt: timestamp("escrow_held_at"),
  escrowReleasedAt: timestamp("escrow_released_at"),
  autoReleaseAt: timestamp("auto_release_at"), // 72 hours after session completion
  
  // Booking Status
  bookingStatus: varchar("booking_status").default("pending"), // pending | confirmed | completed | cancelled
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  cancelledBy: varchar("cancelled_by"), // user | trainer | admin
  
  // Notifications (Firebase Cloud Messaging)
  notificationsSent: boolean("notifications_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"), // 1 hour before session
  
  // Review System Integration
  customerReviewId: varchar("customer_review_id"), // Links to contractorReviews
  trainerReviewId: varchar("trainer_review_id"), // Trainer can review customer
  isReviewed: boolean("is_reviewed").default(false),
  
  // Audit Trail
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_trainer_bookings_user").on(table.userId),
  trainerIdx: index("idx_trainer_bookings_trainer").on(table.trainerId),
  statusIdx: index("idx_trainer_bookings_status").on(table.bookingStatus),
  paymentIdx: index("idx_trainer_bookings_payment").on(table.paymentStatus),
  dateIdx: index("idx_trainer_bookings_date").on(table.sessionDate),
}));

export const insertTrainerBookingSchema = createInsertSchema(trainerBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTrainerBooking = z.infer<typeof insertTrainerBookingSchema>;
export type TrainerBooking = typeof trainerBookings.$inferSelect;

// =================== OPERATIONS HANDBOOK SYSTEM ===================
// Multi-language staff manuals, handbooks, and task management for:
// - Dog Walkers (Walk My Pet™)
// - Pet Sitters (The Sitter Suite™)
// - Pet Transport Drivers (PetTrek™)
// - Hosts / Station Operators
// - Admin / Management

export const handbookCategories = pgTable("handbook_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameTranslations: jsonb("name_translations").$type<Record<string, string>>(), // { en, he, ar, ru, fr, es }
  description: text("description"),
  descriptionTranslations: jsonb("description_translations").$type<Record<string, string>>(),
  icon: varchar("icon", { length: 100 }), // lucide icon name
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const handbookManuals = pgTable("handbook_manuals", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => handbookCategories.id, { onDelete: 'set null' }),
  role: varchar("role", { length: 100 }).notNull(), // walker, sitter, driver, host, admin, all
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  visibility: varchar("visibility", { length: 50 }).default("published"), // draft, published, archived
  viewCount: integer("view_count").default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  roleIdx: index("idx_handbook_manuals_role").on(table.role),
  categoryIdx: index("idx_handbook_manuals_category").on(table.categoryId),
  visibilityIdx: index("idx_handbook_manuals_visibility").on(table.visibility),
}));

export const handbookVersions = pgTable("handbook_versions", {
  id: serial("id").primaryKey(),
  manualId: integer("manual_id").references(() => handbookManuals.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer("version_number").notNull(),
  language: varchar("language", { length: 10 }).notNull(), // en, he, ar, ru, fr, es
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary"),
  content: jsonb("content").notNull(), // Rich text JSON (Tiptap/ProseMirror format)
  mediaUrls: jsonb("media_urls").$type<string[]>(), // Array of CDN/asset URLs
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; type: string }>>(),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  manualIdx: index("idx_handbook_versions_manual").on(table.manualId),
  publishedIdx: index("idx_handbook_versions_published").on(table.publishedAt),
  uniqueManualLanguageVersion: uniqueIndex("idx_handbook_versions_unique").on(table.manualId, table.language, table.versionNumber),
}));

export const handbookManualStates = pgTable("handbook_manual_states", {
  id: serial("id").primaryKey(),
  manualId: integer("manual_id").references(() => handbookManuals.id, { onDelete: 'cascade' }).notNull(),
  language: varchar("language", { length: 10 }).notNull(), // en, he, ar, ru, fr, es
  currentVersionId: integer("current_version_id"), // FK removed - integrity enforced at application level
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueManualLanguage: uniqueIndex("idx_handbook_states_unique").on(table.manualId, table.language),
  manualIdx: index("idx_handbook_states_manual").on(table.manualId),
  versionIdx: index("idx_handbook_states_version").on(table.currentVersionId),
}));

export const handbookTasks = pgTable("handbook_tasks", {
  id: serial("id").primaryKey(),
  manualId: integer("manual_id").references(() => handbookManuals.id, { onDelete: 'cascade' }).notNull(),
  versionId: integer("version_id").references(() => handbookVersions.id, { onDelete: 'set null' }),
  assigneeRole: varchar("assignee_role", { length: 100 }),
  assigneeUserId: varchar("assignee_user_id"),
  title: varchar("title", { length: 500 }).notNull(),
  titleTranslations: jsonb("title_translations").$type<Record<string, string>>(),
  description: text("description"),
  descriptionTranslations: jsonb("description_translations").$type<Record<string, string>>(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, in_progress, completed, cancelled
  priority: varchar("priority", { length: 50 }).default("normal"), // low, normal, high, urgent
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  manualIdx: index("idx_handbook_tasks_manual").on(table.manualId),
  versionIdx: index("idx_handbook_tasks_version").on(table.versionId),
  statusIdx: index("idx_handbook_tasks_status").on(table.status),
  dueDateIdx: index("idx_handbook_tasks_due_date").on(table.dueDate),
  assigneeRoleIdx: index("idx_handbook_tasks_assignee_role").on(table.assigneeRole),
  assigneeUserIdx: index("idx_handbook_tasks_assignee_user").on(table.assigneeUserId),
}));

// Zod Schemas for Validation
export const insertHandbookCategorySchema = createInsertSchema(handbookCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHandbookCategory = z.infer<typeof insertHandbookCategorySchema>;
export type HandbookCategory = typeof handbookCategories.$inferSelect;

export const insertHandbookManualSchema = createInsertSchema(handbookManuals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHandbookManual = z.infer<typeof insertHandbookManualSchema>;
export type HandbookManual = typeof handbookManuals.$inferSelect;

export const insertHandbookVersionSchema = createInsertSchema(handbookVersions).omit({
  id: true,
  createdAt: true,
});
export type InsertHandbookVersion = z.infer<typeof insertHandbookVersionSchema>;
export type HandbookVersion = typeof handbookVersions.$inferSelect;

export const insertHandbookManualStateSchema = createInsertSchema(handbookManualStates).omit({
  id: true,
  updatedAt: true,
});
export type InsertHandbookManualState = z.infer<typeof insertHandbookManualStateSchema>;
export type HandbookManualState = typeof handbookManualStates.$inferSelect;

export const insertHandbookTaskSchema = createInsertSchema(handbookTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHandbookTask = z.infer<typeof insertHandbookTaskSchema>;
export type HandbookTask = typeof handbookTasks.$inferSelect;

// =================== STAFF ONBOARDING & FRAUD PREVENTION SYSTEM ===================
// Comprehensive onboarding for pet sitters, trainers, dog walkers, drivers, hosts
// Modeled after Airbnb, Uber, Booking.com best practices
// Includes fraud prevention, receipt verification, logbook tracking

export const staffApplications = pgTable("staff_applications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"), // If registered user
  applicationType: varchar("application_type", { length: 100 }).notNull(), // sitter, walker, driver, trainer, host, admin
  
  // Personal Information
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).notNull(),
  postalCode: varchar("postal_code", { length: 50 }),
  
  // Tax & Legal
  taxId: varchar("tax_id", { length: 50 }), // SSN or EIN for US
  businessName: varchar("business_name", { length: 255 }), // If contractor
  businessLicense: varchar("business_license", { length: 255 }),
  
  // Banking (for payouts)
  bankAccountName: varchar("bank_account_name", { length: 255 }),
  bankAccountNumber: varchar("bank_account_number", { length: 255 }),
  bankRoutingNumber: varchar("bank_routing_number", { length: 50 }),
  
  // Application Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, documents_required, under_review, background_check, approved, rejected
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"), // Admin user ID
  approvedAt: timestamp("approved_at"),
  
  // Metadata
  referralSource: varchar("referral_source", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Career Portal Fields (SEEK-inspired)
  applicationId: varchar("application_id", { length: 50 }).unique(), // APP-2025-XXXXX
  positionId: varchar("position_id", { length: 50 }), // References career_positions.positionId
  reviewStage: varchar("review_stage", { length: 50 }), // initial, technical, hr, final
  reviewerNotes: text("reviewer_notes"),
  
  // Fraud Detection & Smart Shortlisting
  fraudRiskScore: integer("fraud_risk_score").default(0), // 0-100
  shortlistScore: integer("shortlist_score"), // 0-100 calculated score
  shortlistRecommendation: varchar("shortlist_recommendation", { length: 30 }), // shortlist, reject, manual_review
  shortlistFlags: jsonb("shortlist_flags").default(sql`'[]'::jsonb`), // Array of flag objects
  
  // Background & Competency Checks
  criminalRecord: boolean("criminal_record").default(false),
  hasDrivingLicense: boolean("has_driving_license").default(false),
  drivingLicenseType: varchar("driving_license_type", { length: 20 }), // A, B, C, etc
  yearsOfExperience: integer("years_of_experience").default(0),
  references: jsonb("references").default(sql`'[]'::jsonb`), // Array of reference objects
  
  // Session & Autosave
  sessionId: varchar("session_id", { length: 255 }), // For draft tracking
  currentStep: integer("current_step").default(1),
  formData: jsonb("form_data"), // Autosaved form data
}, (table) => ({
  emailIdx: index("idx_staff_applications_email").on(table.email),
  statusIdx: index("idx_staff_applications_status").on(table.status),
  typeIdx: index("idx_staff_applications_type").on(table.applicationType),
  applicationIdIdx: index("idx_staff_applications_app_id").on(table.applicationId),
  positionIdIdx: index("idx_staff_applications_position").on(table.positionId),
  shortlistIdx: index("idx_staff_applications_shortlist").on(table.shortlistRecommendation),
}));

export const staffDocuments = pgTable("staff_documents", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => staffApplications.id, { onDelete: 'cascade' }).notNull(),
  documentType: varchar("document_type", { length: 100 }).notNull(), // id_front, id_back, selfie, insurance, vehicle_registration, business_license, certification, etc.
  documentUrl: text("document_url").notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, verified, rejected
  verificationMethod: varchar("verification_method", { length: 100 }), // manual, ocr, biometric
  verificationScore: decimal("verification_score", { precision: 5, scale: 2 }), // 0-100 confidence
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"),
  rejectionReason: text("rejection_reason"),
  expiryDate: date("expiry_date"), // For documents with expiration
  metadata: jsonb("metadata"), // OCR data, extracted info
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  applicationIdx: index("idx_staff_documents_application").on(table.applicationId),
  statusIdx: index("idx_staff_documents_status").on(table.status),
  typeIdx: index("idx_staff_documents_type").on(table.documentType),
}));

export const staffESignatures = pgTable("staff_esignatures", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => staffApplications.id, { onDelete: 'cascade' }).notNull(),
  documentName: varchar("document_name", { length: 255 }).notNull(), // Independent Contractor Agreement, NDA, Code of Conduct, etc.
  documentType: varchar("document_type", { length: 100 }).notNull(), // contract, nda, policy, waiver, tax_form
  docusealSubmissionId: varchar("docuseal_submission_id", { length: 255 }), // DocuSeal reference
  documentUrl: text("document_url"), // Signed document URL
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, sent, viewed, signed, completed
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  signatureData: jsonb("signature_data"), // Signature metadata from DocuSeal
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  applicationIdx: index("idx_staff_esignatures_application").on(table.applicationId),
  statusIdx: index("idx_staff_esignatures_status").on(table.status),
  docusealIdx: index("idx_staff_esignatures_docuseal").on(table.docusealSubmissionId),
}));

export const staffBackgroundChecks = pgTable("staff_background_checks", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").references(() => staffApplications.id, { onDelete: 'cascade' }).notNull(),
  provider: varchar("provider", { length: 100 }).notNull(), // checkr, hireright, manual
  checkType: varchar("check_type", { length: 100 }).notNull(), // criminal, driving, identity, employment
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, in_progress, clear, consider, rejected
  reportUrl: text("report_url"),
  reportData: jsonb("report_data"), // Full report from provider
  submittedAt: timestamp("submitted_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiryDate: date("expiry_date"), // Annual re-check date
  findings: text("findings"), // Summary of results
  decision: varchar("decision", { length: 50 }), // approved, requires_review, rejected
  reviewedBy: varchar("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  applicationIdx: index("idx_staff_background_checks_application").on(table.applicationId),
  statusIdx: index("idx_staff_background_checks_status").on(table.status),
  expiryIdx: index("idx_staff_background_checks_expiry").on(table.expiryDate),
}));

export const staffExpenses = pgTable("staff_expenses", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(), // Staff member user ID
  expenseType: varchar("expense_type", { length: 100 }).notNull(), // fuel, supplies, mileage, meal, other
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("ILS").notNull(),
  description: text("description").notNull(),
  
  // Receipt Verification (Fraud Prevention)
  receiptUrl: text("receipt_url"), // Uploaded receipt image
  receiptVerificationStatus: varchar("receipt_verification_status", { length: 50 }).default("pending"), // pending, verified, suspicious, rejected
  receiptOcrData: jsonb("receipt_ocr_data"), // Google Vision OCR results
  geminiValidation: jsonb("gemini_validation"), // AI fraud detection results
  fraudScore: decimal("fraud_score", { precision: 5, scale: 2 }), // 0-100 suspicion score
  fraudFlags: jsonb("fraud_flags").$type<string[]>(), // duplicate, fake, manipulated, excessive, etc.
  
  // Approval Workflow
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, approved, rejected, paid
  submittedAt: timestamp("submitted_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  
  // Audit Trail
  duplicateCheckHash: varchar("duplicate_check_hash", { length: 255 }), // Hash of receipt for duplicate detection
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_staff_expenses_employee").on(table.employeeId),
  statusIdx: index("idx_staff_expenses_status").on(table.status),
  verificationIdx: index("idx_staff_expenses_verification").on(table.receiptVerificationStatus),
  duplicateIdx: index("idx_staff_expenses_duplicate").on(table.duplicateCheckHash),
}));

export const staffLogbook = pgTable("staff_logbook", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(),
  logType: varchar("log_type", { length: 100 }).notNull(), // shift, job, break, travel
  jobId: varchar("job_id"), // Reference to booking/walk/transport job
  
  // Time Tracking
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  duration: integer("duration"), // Minutes
  
  // GPS Verification (Fraud Prevention)
  startLocation: jsonb("start_location").$type<{ latitude: number; longitude: number; accuracy: number }>(),
  endLocation: jsonb("end_location").$type<{ latitude: number; longitude: number; accuracy: number }>(),
  gpsVerified: boolean("gps_verified").default(false),
  gpsVerificationNotes: text("gps_verification_notes"),
  
  // Job Details
  description: text("description"),
  clientName: varchar("client_name", { length: 255 }),
  petNames: jsonb("pet_names").$type<string[]>(),
  
  // Approval
  status: varchar("status", { length: 50 }).default("pending"), // pending, approved, disputed, rejected
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_staff_logbook_employee").on(table.employeeId),
  jobIdx: index("idx_staff_logbook_job").on(table.jobId),
  statusIdx: index("idx_staff_logbook_status").on(table.status),
  startTimeIdx: index("idx_staff_logbook_start_time").on(table.startTime),
}));

export const franchiseOrders = pgTable("franchise_orders", {
  id: serial("id").primaryKey(),
  franchiseId: integer("franchise_id").notNull(), // Reference to franchise
  orderType: varchar("order_type", { length: 100 }).notNull(), // supplies, equipment, maintenance, inventory
  
  // Order Details
  items: jsonb("items").notNull(), // Array of order items
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  
  // Prepayment Requirement (CRITICAL - Franchises must pay in advance)
  paymentStatus: varchar("payment_status", { length: 50 }).default("payment_required").notNull(), // payment_required, payment_pending, paid, refunded
  paymentMethod: varchar("payment_method", { length: 100 }),
  paymentReference: varchar("payment_reference", { length: 255 }),
  paidAt: timestamp("paid_at"),
  
  // Order Processing (Only proceeds after payment)
  orderStatus: varchar("order_status", { length: 50 }).default("pending_payment").notNull(), // pending_payment, processing, shipped, delivered, cancelled
  processedAt: timestamp("processed_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  
  // Metadata
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  franchiseIdx: index("idx_franchise_orders_franchise").on(table.franchiseId),
  paymentStatusIdx: index("idx_franchise_orders_payment_status").on(table.paymentStatus),
  orderStatusIdx: index("idx_franchise_orders_order_status").on(table.orderStatus),
}));

// =================== JOB DISPATCH SYSTEM (UBER-STYLE) ===================

export const jobOffers = pgTable("job_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(), // Reference to booking in Firestore
  platform: varchar("platform", { length: 50 }).notNull(), // sitter-suite, walk-my-pet, pettrek
  
  // Operator Assignment
  operatorId: varchar("operator_id"), // Firebase UID of assigned operator
  operatorName: varchar("operator_name"),
  customerId: varchar("customer_id").notNull(), // Firebase UID of customer
  customerName: varchar("customer_name"),
  
  // Job Status (Uber-style flow)
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, offered, accepted, rejected, expired, cancelled
  
  // Service Details
  serviceType: varchar("service_type", { length: 100 }).notNull(), // pet_sitting, dog_walk, pet_transport
  serviceDate: timestamp("service_date").notNull(),
  duration: integer("duration"), // in hours or days depending on platform
  location: jsonb("location").$type<{ latitude: number; longitude: number; address: string }>(),
  geohash: varchar("geohash", { length: 20 }), // For proximity search
  
  // Pricing Details
  baseAmount: decimal("base_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  vat: decimal("vat", { precision: 10, scale: 2 }).notNull(),
  totalCharge: decimal("total_charge", { precision: 10, scale: 2 }).notNull(), // What customer pays
  operatorPayout: decimal("operator_payout", { precision: 10, scale: 2 }).notNull(), // What operator receives
  currency: varchar("currency", { length: 10 }).default("ILS").notNull(),
  
  // SLA Timestamps (Airbnb/Uber-level tracking)
  createdAt: timestamp("created_at").defaultNow(),
  offeredAt: timestamp("offered_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  expiredAt: timestamp("expired_at"),
  completedAt: timestamp("completed_at"),
  
  // Audit Trail
  offerHistory: jsonb("offer_history").$type<Array<{
    operatorId: string;
    action: 'offered' | 'accepted' | 'rejected';
    timestamp: string;
    reason?: string;
  }>>(),
  
  // Additional Metadata
  petIds: jsonb("pet_ids").$type<string[]>(),
  specialInstructions: text("special_instructions"),
  metadata: jsonb("metadata"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  operatorIdx: index("idx_job_offers_operator").on(table.operatorId),
  statusIdx: index("idx_job_offers_status").on(table.status),
  platformIdx: index("idx_job_offers_platform").on(table.platform),
  serviceDateIdx: index("idx_job_offers_service_date").on(table.serviceDate),
  geohashIdx: index("idx_job_offers_geohash").on(table.geohash),
}));

export const operatorPresence = pgTable("operator_presence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operatorId: varchar("operator_id").notNull().unique(), // Firebase UID
  operatorName: varchar("operator_name"),
  platform: varchar("platform", { length: 50 }).notNull(), // sitter-suite, walk-my-pet, pettrek
  
  // Availability
  status: varchar("status", { length: 50 }).default("offline").notNull(), // online, offline, busy, on_job
  
  // Location (for proximity matching)
  currentLocation: jsonb("current_location").$type<{ latitude: number; longitude: number; accuracy: number }>(),
  geohash: varchar("geohash", { length: 20 }),
  
  // Session Management
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  lastLocationUpdateAt: timestamp("last_location_update_at"),
  deviceInfo: jsonb("device_info").$type<{ deviceId: string; platform: string; appVersion: string }>(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  operatorIdx: uniqueIndex("idx_operator_presence_operator").on(table.operatorId),
  statusIdx: index("idx_operator_presence_status").on(table.status),
  geohashIdx: index("idx_operator_presence_geohash").on(table.geohash),
  lastActiveIdx: index("idx_operator_presence_last_active").on(table.lastActiveAt),
}));

// ISRAEL PRODUCTION SCHEMA - amountCents (integer), ILS-only, Nayax-only
export const paymentIntents = pgTable("payment_intents", {
  // Primary fields
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  platformId: varchar("platform_id", { length: 50 }).notNull(), // K9000_WASH, WALK_MY_PET, etc
  userId: varchar("user_id").notNull(), // Customer Firebase UID
  providerId: varchar("provider_id"), // Provider ID for marketplace bookings
  
  // Nayax transaction IDs
  transactionId: varchar("transaction_id"), // Nayax transaction ID (for refunds/webhooks)
  nayaxAuthorizationId: varchar("nayax_authorization_id"),
  nayaxCaptureId: varchar("nayax_capture_id"),
  
  // Payment amounts (INTEGER - agorot/cents)
  amountCents: integer("amount_cents").notNull(), // Total amount in agorot (ILS cents)
  
  // Currency (Israel only for now)
  currency: varchar("currency", { length: 3 }).default("ILS").notNull(),
  
  // Status (created, pending, succeeded, failed, voided, refunded)
  status: varchar("status", { length: 20 }).default("created").notNull(),
  
  // Payment method
  paymentMethod: varchar("payment_method", { length: 50 }), // card, apple_pay, google_pay
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // Error handling
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
}, (table) => ({
  bookingIdx: index("idx_payment_intents_booking").on(table.bookingId),
  platformIdx: index("idx_payment_intents_platform").on(table.platformId),
  userIdx: index("idx_payment_intents_user").on(table.userId),
  statusIdx: index("idx_payment_intents_status").on(table.status),
  transactionIdx: index("idx_payment_intents_transaction").on(table.transactionId),
}));

// Zod Schemas
export const insertStaffApplicationSchema = createInsertSchema(staffApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffApplication = z.infer<typeof insertStaffApplicationSchema>;
export type StaffApplication = typeof staffApplications.$inferSelect;

export const insertStaffDocumentSchema = createInsertSchema(staffDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffDocument = z.infer<typeof insertStaffDocumentSchema>;
export type StaffDocument = typeof staffDocuments.$inferSelect;

export const insertStaffESignatureSchema = createInsertSchema(staffESignatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffESignature = z.infer<typeof insertStaffESignatureSchema>;
export type StaffESignature = typeof staffESignatures.$inferSelect;

export const insertStaffBackgroundCheckSchema = createInsertSchema(staffBackgroundChecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffBackgroundCheck = z.infer<typeof insertStaffBackgroundCheckSchema>;
export type StaffBackgroundCheck = typeof staffBackgroundChecks.$inferSelect;

export const insertStaffExpenseSchema = createInsertSchema(staffExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffExpense = z.infer<typeof insertStaffExpenseSchema>;
export type StaffExpense = typeof staffExpenses.$inferSelect;

export const insertStaffLogbookSchema = createInsertSchema(staffLogbook).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffLogbook = z.infer<typeof insertStaffLogbookSchema>;
export type StaffLogbook = typeof staffLogbook.$inferSelect;

export const insertFranchiseOrderSchema = createInsertSchema(franchiseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFranchiseOrder = z.infer<typeof insertFranchiseOrderSchema>;
export type FranchiseOrder = typeof franchiseOrders.$inferSelect;

export const insertJobOfferSchema = createInsertSchema(jobOffers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobOffer = z.infer<typeof insertJobOfferSchema>;
export type JobOffer = typeof jobOffers.$inferSelect;

export const insertOperatorPresenceSchema = createInsertSchema(operatorPresence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOperatorPresence = z.infer<typeof insertOperatorPresenceSchema>;
export type OperatorPresence = typeof operatorPresence.$inferSelect;

export const insertPaymentIntentSchema = createInsertSchema(paymentIntents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type PaymentIntent = typeof paymentIntents.$inferSelect;

// =================== MODULAR SCHEMA EXPORTS ===================
// Re-export all schemas from domain modules

export * from "./schema-corporate";
export * from "./schema-hr";
export * from "./schema-operations";
export * from "./schema-logistics";
export * from "./schema-finance";
export * from "./schema-policy";
export * from "./schema-franchise";
export * from "./schema-chat";
export * from "./schema-gemini-watchdog";
export * from "./schema-integrations";
export * from "./schema-payroll";
export * from "./schema-compliance";

// ============================================================================
// SUPER-APP SCHEMA - 6 PLATFORMS (K9000, Walk My Pet, Sitter Suite, PetTrek, Groomers, Shared Services)
// ============================================================================

// Platform types enum
export const platformEnum = z.enum([
  'k9000',
  'walk_my_pet',
  'sitter_suite',
  'pettrek',
  'groomers',
  'shared_services'
]);

export type Platform = z.infer<typeof platformEnum>;

// Booking status enum
export const bookingStatusEnum = z.enum([
  'draft',
  'pending_payment',
  'pending_provider',
  'confirmed',
  'declined',
  'in_progress',
  'completed',
  'cancelled',
  'disputed',
  'refunded'
]);

// ===== PLATFORMS TABLE =====
export const platforms = pgTable("platforms", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  isActive: boolean("is_active").default(true),
  platformFeePercent: decimal("platform_fee_percent", { precision: 5, scale: 2 }),
  stripeConnectEnabled: boolean("stripe_connect_enabled").default(false),
  nayaxEnabled: boolean("nayax_enabled").default(false),
  
  // PLATFORM-SPECIFIC BOOKING BEHAVIOR (2025 Booking Calendar)
  bookingMode: varchar("booking_mode").default("SINGLE_SLOT"), // 'SINGLE_SLOT' | 'MULTI_DAY' | 'ARRIVAL_WINDOW'
  
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===== PETS TABLE =====
export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  species: varchar("species").notNull(),
  breed: varchar("breed"),
  age: integer("age"),
  dateOfBirth: date("date_of_birth"),
  weight: decimal("weight", { precision: 6, scale: 2 }),
  gender: varchar("gender"),
  size: varchar("size"),
  color: varchar("color"),
  microchipId: varchar("microchip_id"),
  photoUrl: varchar("photo_url"),
  allergies: text("allergies"),
  medications: text("medications"),
  specialNeeds: text("special_needs"),
  vetName: varchar("vet_name"),
  vetPhone: varchar("vet_phone"),
  vaccinationStatus: varchar("vaccination_status").default("unknown"),
  lastVaccinationDate: date("last_vaccination_date"),
  nextVaccinationDate: date("next_vaccination_date"),
  temperament: varchar("temperament"),
  goodWithKids: boolean("good_with_kids"),
  goodWithDogs: boolean("good_with_dogs"),
  goodWithCats: boolean("good_with_cats"),
  notes: text("notes"),
  lastWashDate: timestamp("last_wash_date"),
  lastWalkDate: timestamp("last_walk_date"),
  lastGroomDate: timestamp("last_groom_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("pet_user_idx").on(table.userId),
}));

// ===== PROVIDERS TABLE =====
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  platformId: varchar("platform_id").notNull().references(() => platforms.id),
  businessName: varchar("business_name"),
  bio: text("bio"),
  bioHe: text("bio_he"),
  photoUrl: varchar("photo_url"),
  languages: text("languages").array(),
  verificationStatus: varchar("verification_status").default("pending"),
  verificationDocuments: jsonb("verification_documents"),
  backgroundCheckStatus: varchar("background_check_status").default("pending"),
  backgroundCheckDate: timestamp("background_check_date"),
  insuranceProvider: varchar("insurance_provider"),
  insurancePolicyNumber: varchar("insurance_policy_number"),
  insuranceExpiryDate: date("insurance_expiry_date"),
  insuranceDocumentUrl: varchar("insurance_document_url"),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  totalReviews: integer("total_reviews").default(0),
  totalBookings: integer("total_bookings").default(0),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }).default("0"),
  isAvailable: boolean("is_available").default(true),
  acceptingNewClients: boolean("accepting_new_clients").default(true),
  serviceRadius: integer("service_radius"),
  stripeConnectAccountId: varchar("stripe_connect_account_id"),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false),
  payoutEnabled: boolean("payout_enabled").default(false),
  totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 }).default("0"),
  pendingPayouts: decimal("pending_payouts", { precision: 12, scale: 2 }).default("0"),
  platformData: jsonb("platform_data"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userPlatformUnique: uniqueIndex("provider_user_platform_unique").on(table.userId, table.platformId),
  platformIdx: index("provider_platform_idx").on(table.platformId),
  userIdx: index("provider_user_idx").on(table.userId),
  verificationIdx: index("provider_verification_idx").on(table.verificationStatus),
}));

// ===== LOCATIONS TABLE =====
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  providerId: integer("provider_id").references(() => providers.id),
  type: varchar("type").notNull(),
  name: varchar("name"),
  addressLine1: varchar("address_line1").notNull(),
  addressLine2: varchar("address_line2"),
  city: varchar("city").notNull(),
  state: varchar("state"),
  country: varchar("country").default("IL"),
  postalCode: varchar("postal_code"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  googlePlaceId: varchar("google_place_id"),
  phone: varchar("phone"),
  email: varchar("email"),
  instructions: text("instructions"),
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("location_user_idx").on(table.userId),
  typeIdx: index("location_type_idx").on(table.type),
  geoIdx: index("location_geo_idx").on(table.latitude, table.longitude),
}));

// ===== STATIONS TABLE =====
export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  stationCode: varchar("station_code").notNull().unique(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  franchiseId: integer("franchise_id"),
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  photoUrls: text("photo_urls").array(),
  status: varchar("status").default("operational"),
  isActive: boolean("is_active").default(true),
  iotDeviceId: varchar("iot_device_id"),
  iotStatus: jsonb("iot_status"),
  lastHeartbeat: timestamp("last_heartbeat"),
  pricePerWash: decimal("price_per_wash", { precision: 10, scale: 2 }),
  pricePerMinute: decimal("price_per_minute", { precision: 10, scale: 2 }),
  features: text("features").array(),
  operatingHours: jsonb("operating_hours"),
  totalWashes: integer("total_washes").default(0),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  averageUsageMinutes: integer("average_usage_minutes"),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("station_status_idx").on(table.status),
  locationIdx: index("station_location_idx").on(table.locationId),
}));

// ===== INVENTORY MANAGEMENT =====

// Supplies master catalog
export const supplies = pgTable("supplies", {
  id: serial("id").primaryKey(),
  sku: varchar("sku").unique().notNull(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(),
  unitType: varchar("unit_type").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"),
  reorderThreshold: integer("reorder_threshold").default(10),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("supply_category_idx").on(table.category),
  activeIdx: index("supply_active_idx").on(table.isActive),
}));

// Station-specific inventory levels
export const stationSupplies = pgTable("station_supplies", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => stations.id).notNull(),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  currentLevel: integer("current_level").default(0),
  reorderThreshold: integer("reorder_threshold"),
  lastRefillAt: timestamp("last_refill_at"),
  lastRefillAmount: integer("last_refill_amount"),
  lastRefillByUserId: varchar("last_refill_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  stationIdx: index("station_supply_station_idx").on(table.stationId),
  supplyIdx: index("station_supply_supply_idx").on(table.supplyId),
  levelIdx: index("station_supply_level_idx").on(table.currentLevel),
}));

// Inventory refill history
export const inventoryRefills = pgTable("inventory_refills", {
  id: serial("id").primaryKey(),
  stationSupplyId: integer("station_supply_id").references(() => stationSupplies.id).notNull(),
  amount: integer("amount").notNull(),
  previousLevel: integer("previous_level").notNull(),
  newLevel: integer("new_level").notNull(),
  refilledByUserId: varchar("refilled_by_user_id").notNull(),
  notes: text("notes"),
  refilledAt: timestamp("refilled_at").defaultNow(),
}, (table) => ({
  stationSupplyIdx: index("inventory_refill_station_supply_idx").on(table.stationSupplyId),
  refilledAtIdx: index("inventory_refill_date_idx").on(table.refilledAt),
}));

// ===== LOGISTICS & FLEET MANAGEMENT =====

// Logistics tasks for field operations (deliveries, installations, etc.)
export const logisticsTasks = pgTable("logistics_tasks", {
  id: serial("id").primaryKey(),
  taskNumber: varchar("task_number").unique().notNull(),
  type: varchar("type").notNull(),
  status: varchar("status").default("pending"),
  stationId: integer("station_id").references(() => stations.id).notNull(),
  description: text("description").notNull(),
  assignedToUserId: varchar("assigned_to_user_id"),
  preferredWindowStart: timestamp("preferred_window_start"),
  preferredWindowEnd: timestamp("preferred_window_end"),
  failureReason: text("failure_reason"),
  createdByUserId: varchar("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  statusIdx: index("logistics_task_status_idx").on(table.status),
  assignedUserIdx: index("logistics_task_assigned_user_idx").on(table.assignedToUserId),
  stationIdx: index("logistics_task_station_idx").on(table.stationId),
  typeIdx: index("logistics_task_type_idx").on(table.type),
}));

// Fleet vehicles for logistics operations
export const logisticsVehicles = pgTable("logistics_vehicles", {
  id: serial("id").primaryKey(),
  label: varchar("label").notNull(),
  type: varchar("type").notNull(),
  plateNumber: varchar("plate_number").unique().notNull(),
  driverUserId: varchar("driver_user_id"),
  capacityKg: integer("capacity_kg"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  driverIdx: index("logistics_vehicle_driver_idx").on(table.driverUserId),
  activeIdx: index("logistics_vehicle_active_idx").on(table.isActive),
}));

// ===== MOBILE FIELD OPERATIONS =====

// Field updates for technicians (mobile app)
export const fieldUpdates = pgTable("field_updates", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => stations.id).notNull(),
  taskId: integer("task_id").references(() => logisticsTasks.id),
  createdByUserId: varchar("created_by_user_id").notNull(),
  message: text("message").notNull(),
  status: varchar("status"), // "before", "during", "after", "issue"
  tags: jsonb("tags"), // ["installation", "maintenance", "before", "after"]
  metadata: jsonb("metadata"), // Device info, GPS coords
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  stationIdx: index("field_update_station_idx").on(table.stationId),
  taskIdx: index("field_update_task_idx").on(table.taskId),
  createdAtIdx: index("field_update_created_at_idx").on(table.createdAt),
  statusIdx: index("field_update_status_idx").on(table.status),
}));

// Field update photos
export const fieldUpdatePhotos = pgTable("field_update_photos", {
  id: serial("id").primaryKey(),
  fieldUpdateId: integer("field_update_id").references(() => fieldUpdates.id, { onDelete: 'cascade' }).notNull(),
  fileName: varchar("file_name").notNull(),
  fileUrl: varchar("file_url").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  mimeType: varchar("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => ({
  fieldUpdateIdx: index("field_update_photo_field_update_idx").on(table.fieldUpdateId),
}));

// Staff devices for push notifications
export const staffDevices = pgTable("staff_devices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  platform: varchar("platform").notNull(), // "ios", "android"
  deviceModel: varchar("device_model"),
  osVersion: varchar("os_version"),
  appVersion: varchar("app_version"),
  pushToken: varchar("push_token"),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("staff_device_user_idx").on(table.userId),
  platformIdx: index("staff_device_platform_idx").on(table.platform),
  pushTokenIdx: index("staff_device_push_token_idx").on(table.pushToken),
}));

// ===== VEHICLES TABLE =====
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id).notNull(),
  make: varchar("make").notNull(),
  model: varchar("model").notNull(),
  year: integer("year").notNull(),
  color: varchar("color"),
  licensePlate: varchar("license_plate").notNull().unique(),
  vin: varchar("vin"),
  type: varchar("type").notNull(),
  capacity: integer("capacity"),
  features: text("features").array(),
  sizeSupport: text("size_support").array(),
  registrationDocumentUrl: varchar("registration_document_url"),
  insuranceDocumentUrl: varchar("insurance_document_url"),
  inspectionDocumentUrl: varchar("inspection_document_url"),
  verificationStatus: varchar("verification_status").default("pending"),
  insuranceProvider: varchar("insurance_provider"),
  insurancePolicyNumber: varchar("insurance_policy_number"),
  insuranceExpiryDate: date("insurance_expiry_date"),
  lastInspectionDate: date("last_inspection_date"),
  nextInspectionDate: date("next_inspection_date"),
  totalTrips: integer("total_trips").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("vehicle_provider_idx").on(table.providerId),
  verificationIdx: index("vehicle_verification_idx").on(table.verificationStatus),
}));

// ===== BOOKINGS TABLE =====
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingNumber: varchar("booking_number").notNull().unique(),
  platformId: varchar("platform_id").notNull().references(() => platforms.id),
  userId: varchar("user_id").notNull(),
  providerId: integer("provider_id").references(() => providers.id),
  pickupLocationId: integer("pickup_location_id").references(() => locations.id),
  dropoffLocationId: integer("dropoff_location_id").references(() => locations.id),
  stationId: integer("station_id").references(() => stations.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  duration: integer("duration"),
  timezone: varchar("timezone").default("Asia/Jerusalem"),
  status: varchar("status").default("draft").notNull(),
  paymentStatus: varchar("payment_status").default("pending"),
  paymentIntentId: varchar("payment_intent_id"),
  paymentMethod: varchar("payment_method"),
  payoutStatus: varchar("payout_status").default("pending"),
  payoutDate: timestamp("payout_date"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).default("0"),
  providerPayout: decimal("provider_payout", { precision: 12, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  serviceType: varchar("service_type"),
  serviceDescription: text("service_description"),
  specialRequests: text("special_requests"),
  platformData: jsonb("platform_data"),
  cancellationReason: text("cancellation_reason"),
  cancelledBy: varchar("cancelled_by"),
  cancelledAt: timestamp("cancelled_at"),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }),
  refundProcessedAt: timestamp("refund_processed_at"),
  customerReviewId: integer("customer_review_id"),
  providerReviewId: integer("provider_review_id"),
  confirmedAt: timestamp("confirmed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  platformProviderTimeIdx: index("booking_platform_provider_time_idx").on(table.platformId, table.providerId, table.startTime),
  platformUserStatusIdx: index("booking_platform_user_status_idx").on(table.platformId, table.userId, table.status),
  statusIdx: index("booking_status_idx").on(table.status),
  dateIdx: index("booking_date_idx").on(table.startTime),
}));

// ===== BOOKING PETS JOIN TABLE =====
export const bookingPets = pgTable("booking_pets", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: 'cascade' }).notNull(),
  petId: integer("pet_id").references(() => pets.id).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  bookingPetUnique: uniqueIndex("booking_pet_unique").on(table.bookingId, table.petId),
  bookingIdx: index("booking_pet_booking_idx").on(table.bookingId),
  petIdx: index("booking_pet_pet_idx").on(table.petId),
}));

// ===== BOOKING ITEMS TABLE =====
export const bookingItems = pgTable("booking_items", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: 'cascade' }).notNull(),
  itemType: varchar("item_type").notNull(),
  name: varchar("name").notNull(),
  nameHe: varchar("name_he"),
  description: text("description"),
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("booking_item_booking_idx").on(table.bookingId),
}));

// ===== AVAILABILITY SLOTS TABLE =====
export const availabilitySlots = pgTable("availability_slots", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => providers.id, { onDelete: 'cascade' }).notNull(),
  platformId: varchar("platform_id").notNull().references(() => platforms.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  timezone: varchar("timezone").default("Asia/Jerusalem"),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRule: varchar("recurrence_rule"),
  recurrenceEnd: timestamp("recurrence_end"),
  status: varchar("status").default("available"), // available | held | booked | cancelled
  bookingId: varchar("booking_id").references(() => bookings.id),
  bufferBefore: integer("buffer_before").default(0),
  bufferAfter: integer("buffer_after").default(0),
  notes: text("notes"),
  
  // 5-MINUTE PAYMENT LOCK SYSTEM (2025 Booking Calendar Integration)
  lockedByUid: varchar("locked_by_uid"), // Firebase UID of user who locked slot
  lockedAt: timestamp("locked_at"), // When lock was acquired
  lockExpiresAt: timestamp("lock_expires_at"), // Lock expiry (5 minutes from lockedAt)
  lockToken: varchar("lock_token").unique(), // Unique token to prevent race conditions
  modeOverride: varchar("mode_override"), // Optional: 'SINGLE_SLOT' | 'MULTI_DAY' | 'ARRIVAL_WINDOW'
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerTimeIdx: index("availability_provider_time_idx").on(table.providerId, table.startTime),
  statusIdx: index("availability_status_idx").on(table.status),
  lockTokenIdx: uniqueIndex("availability_lock_token_idx").on(table.lockToken),
  lockExpiryIdx: index("availability_lock_expiry_idx").on(table.lockExpiresAt),
}));

// ===== PAYMENTS TABLE =====
export const superAppPayments = pgTable("super_app_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  userId: varchar("user_id").notNull(),
  gateway: varchar("gateway").notNull(),
  gatewayTransactionId: varchar("gateway_transaction_id"),
  paymentIntentId: varchar("payment_intent_id"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  status: varchar("status").default("pending"),
  paymentMethod: varchar("payment_method"),
  cardBrand: varchar("card_brand"),
  cardLast4: varchar("card_last4"),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }),
  refundReason: text("refund_reason"),
  refundedAt: timestamp("refunded_at"),
  metadata: jsonb("metadata"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("super_app_payment_booking_idx").on(table.bookingId),
  userIdx: index("super_app_payment_user_idx").on(table.userId),
  statusIdx: index("super_app_payment_status_idx").on(table.status),
}));

// ===== PAYOUTS TABLE - ISRAELI BANK TRANSFER ONLY (NO STRIPE) =====
export const superAppPayouts = pgTable("super_app_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: integer("provider_id").references(() => providers.id).notNull(),
  bookingId: varchar("booking_id").references(() => bookings.id),
  
  // Israeli bank transfer fields (NO STRIPE EVER)
  bankTransferReference: varchar("bank_transfer_reference"), // Israeli bank ACH reference number
  providerBankIban: varchar("provider_bank_iban"), // Provider's Israeli bank IBAN
  providerBankName: varchar("provider_bank_name"), // Bank name (e.g., Bank Hapoalim, Leumi)
  
  // Payout amounts
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  
  // Status and processing
  status: varchar("status").default("pending"), // pending | in_escrow | released | processing | completed | failed
  escrowReleaseDate: timestamp("escrow_release_date"), // 72 hours after booking completion
  failureReason: text("failure_reason"),
  scheduledFor: timestamp("scheduled_for"),
  processedAt: timestamp("processed_at"),
  paidAt: timestamp("paid_at"),
  
  // AI Verification (Gemini 2.5 Flash)
  aiVerified: boolean("ai_verified"),
  aiVerificationScore: integer("ai_verification_score"),
  aiVerificationId: varchar("ai_verification_id"),
  aiVerifiedAt: timestamp("ai_verified_at"),
  aiVerificationNotes: text("ai_verification_notes"),
  aiRiskLevel: varchar("ai_risk_level"), // low | medium | high | critical
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("super_app_payout_provider_idx").on(table.providerId),
  statusIdx: index("super_app_payout_status_idx").on(table.status),
  aiVerifiedIdx: index("super_app_payout_ai_verified_idx").on(table.aiVerified),
}));

// ===== BOOKING PHOTOS TABLE (for AI verification) =====
export const bookingPhotos = pgTable("booking_photos", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  providerId: integer("provider_id").references(() => providers.id),
  photoUrl: text("photo_url").notNull(),
  photoType: varchar("photo_type").default("during"), // before | during | after
  gpsLatitude: decimal("gps_latitude", { precision: 10, scale: 7 }),
  gpsLongitude: decimal("gps_longitude", { precision: 10, scale: 7 }),
  capturedAt: timestamp("captured_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  metadata: jsonb("metadata"),
}, (table) => ({
  bookingIdx: index("booking_photo_booking_idx").on(table.bookingId),
  providerIdx: index("booking_photo_provider_idx").on(table.providerId),
}));

export const insertBookingPhotoSchema = createInsertSchema(bookingPhotos).omit({ id: true });
export type InsertBookingPhoto = z.infer<typeof insertBookingPhotoSchema>;
export type SelectBookingPhoto = typeof bookingPhotos.$inferSelect;

// ===== REVIEWS TABLE =====
export const superAppReviews = pgTable("super_app_reviews", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  platformId: varchar("platform_id").notNull().references(() => platforms.id),
  reviewerId: varchar("reviewer_id").notNull(),
  reviewerType: varchar("reviewer_type").notNull(),
  revieweeId: varchar("reviewee_id").notNull(),
  revieweeType: varchar("reviewee_type").notNull(),
  rating: integer("rating").notNull(),
  title: varchar("title"),
  comment: text("comment"),
  commentHe: text("comment_he"),
  categories: jsonb("categories"),
  photoUrls: text("photo_urls").array(),
  videoUrls: text("video_urls").array(),
  isVerifiedPurchase: boolean("is_verified_purchase").default(true),
  providerResponse: text("provider_response"),
  providerRespondedAt: timestamp("provider_responded_at"),
  isReported: boolean("is_reported").default(false),
  reportReason: text("report_reason"),
  moderationStatus: varchar("moderation_status").default("approved"),
  helpfulCount: integer("helpful_count").default(0),
  notHelpfulCount: integer("not_helpful_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("super_app_review_booking_idx").on(table.bookingId),
  platformIdx: index("super_app_review_platform_idx").on(table.platformId),
  revieweeIdx: index("super_app_review_reviewee_idx").on(table.revieweeId),
  ratingIdx: index("super_app_review_rating_idx").on(table.rating),
}));

// ===== MESSAGES TABLE =====
export const superAppMessages = pgTable("super_app_messages", {
  id: serial("id").primaryKey(),
  conversationId: varchar("conversation_id").notNull(),
  bookingId: varchar("booking_id").references(() => bookings.id),
  platformId: varchar("platform_id").notNull().references(() => platforms.id),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"),
  attachments: jsonb("attachments"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  isSystemMessage: boolean("is_system_message").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  conversationIdx: index("super_app_message_conversation_idx").on(table.conversationId),
  senderIdx: index("super_app_message_sender_idx").on(table.senderId),
  recipientIdx: index("super_app_message_recipient_idx").on(table.recipientId),
  createdIdx: index("super_app_message_created_idx").on(table.createdAt),
}));

// ===== NOTIFICATIONS TABLE =====
export const superAppNotifications = pgTable("super_app_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type").notNull(),
  platformId: varchar("platform_id").references(() => platforms.id),
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  body: text("body").notNull(),
  bodyHe: text("body_he"),
  channels: text("channels").array(),
  pushSent: boolean("push_sent").default(false),
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  actionUrl: varchar("action_url"),
  actionType: varchar("action_type"),
  bookingId: varchar("booking_id").references(() => bookings.id),
  relatedId: varchar("related_id"),
  metadata: jsonb("metadata"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("super_app_notification_user_idx").on(table.userId),
  typeIdx: index("super_app_notification_type_idx").on(table.type),
  readIdx: index("super_app_notification_read_idx").on(table.isRead),
}));

// ===== MEMBERSHIPS TABLE =====
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  platformId: varchar("platform_id").notNull().references(() => platforms.id),
  planName: varchar("plan_name").notNull(),
  planType: varchar("plan_type").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  billingInterval: varchar("billing_interval").notNull(),
  currency: varchar("currency").default("ILS"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  status: varchar("status").default("active"),
  bookingsPerInterval: integer("bookings_per_interval"),
  bookingsUsed: integer("bookings_used").default(0),
  startDate: timestamp("start_date").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAt: timestamp("cancel_at"),
  cancelledAt: timestamp("cancelled_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("membership_user_idx").on(table.userId),
  platformIdx: index("membership_platform_idx").on(table.platformId),
  statusIdx: index("membership_status_idx").on(table.status),
}));

// Zod Schemas for Super-App Tables
export const insertPlatformSchema = createInsertSchema(platforms);
export type InsertPlatform = z.infer<typeof insertPlatformSchema>;
export type SelectPlatform = typeof platforms.$inferSelect;

export const insertPetSchema = createInsertSchema(pets).omit({ id: true });
export type InsertPet = z.infer<typeof insertPetSchema>;
export type SelectPet = typeof pets.$inferSelect;

export const insertProviderSchema = createInsertSchema(providers).omit({ id: true });
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type SelectProvider = typeof providers.$inferSelect;

export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type SelectLocation = typeof locations.$inferSelect;

export const insertStationSchema = createInsertSchema(stations).omit({ id: true });
export type InsertStation = z.infer<typeof insertStationSchema>;
export type SelectStation = typeof stations.$inferSelect;

export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type SelectVehicle = typeof vehicles.$inferSelect;

export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type SelectBooking = typeof bookings.$inferSelect;

export const insertBookingPetSchema = createInsertSchema(bookingPets).omit({ id: true });
export type InsertBookingPet = z.infer<typeof insertBookingPetSchema>;
export type SelectBookingPet = typeof bookingPets.$inferSelect;

export const insertBookingItemSchema = createInsertSchema(bookingItems).omit({ id: true });
export type InsertBookingItem = z.infer<typeof insertBookingItemSchema>;
export type SelectBookingItem = typeof bookingItems.$inferSelect;

export const insertAvailabilitySlotSchema = createInsertSchema(availabilitySlots).omit({ id: true });
export type InsertAvailabilitySlot = z.infer<typeof insertAvailabilitySlotSchema>;
export type SelectAvailabilitySlot = typeof availabilitySlots.$inferSelect;

export const insertSuperAppPaymentSchema = createInsertSchema(superAppPayments).omit({ id: true });
export type InsertSuperAppPayment = z.infer<typeof insertSuperAppPaymentSchema>;
export type SelectSuperAppPayment = typeof superAppPayments.$inferSelect;

export const insertSuperAppPayoutSchema = createInsertSchema(superAppPayouts).omit({ id: true });
export type InsertSuperAppPayout = z.infer<typeof insertSuperAppPayoutSchema>;
export type SelectSuperAppPayout = typeof superAppPayouts.$inferSelect;

export const insertSuperAppReviewSchema = createInsertSchema(superAppReviews).omit({ id: true });
export type InsertSuperAppReview = z.infer<typeof insertSuperAppReviewSchema>;
export type SelectSuperAppReview = typeof superAppReviews.$inferSelect;

export const insertSuperAppMessageSchema = createInsertSchema(superAppMessages).omit({ id: true });
export type InsertSuperAppMessage = z.infer<typeof insertSuperAppMessageSchema>;
export type SelectSuperAppMessage = typeof superAppMessages.$inferSelect;

export const insertSuperAppNotificationSchema = createInsertSchema(superAppNotifications).omit({ id: true });
export type InsertSuperAppNotification = z.infer<typeof insertSuperAppNotificationSchema>;
export type SelectSuperAppNotification = typeof superAppNotifications.$inferSelect;

export const insertMembershipSchema = createInsertSchema(memberships).omit({ id: true });
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type SelectMembership = typeof memberships.$inferSelect;

// ============================================================================
// UNIFIED MARKETPLACE TYPES (Discriminated Unions for Frontend)
// ============================================================================

/**
 * Unified marketplace platform IDs
 */
export type MarketplacePlatformId = 
  | 'walk_my_pet'
  | 'sitter_suite'
  | 'pet_trek'
  | 'groomers'
  | 'k9000';

/**
 * Base provider fields shared across all platforms
 */
interface BaseMarketplaceProvider {
  id: number | string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  bio: string | null;
  profilePictureUrl: string | null;
  rating: string | null;
  totalBookings: number | null;
  isActive: boolean | null;
  isVerified: boolean | null;
  priceDisplay: string; // Formatted price for UI
  createdAt: Date | null;
}

/**
 * Walker-specific provider (Walk My Pet)
 */
export interface WalkerProvider extends BaseMarketplaceProvider {
  kind: 'walker';
  platform: 'walk_my_pet';
  walkerId: string;
  hourlyRate: string | null;
  bodyCamera: boolean | null;
  droneAccess: boolean | null;
  certifications: string[] | null;
  serviceArea: string | null;
  yearsOfExperience: number | null;
}

/**
 * Sitter-specific provider (Sitter Suite)
 */
export interface SitterProvider extends BaseMarketplaceProvider {
  kind: 'sitter';
  platform: 'sitter_suite';
  sitterId?: number;
  pricePerDayCents: number | null;
  yearsOfExperience: number | null;
  hasOwnPets: boolean | null;
  petTypes: string[] | null;
}

/**
 * Driver-specific provider (PetTrek)
 */
export interface DriverProvider extends BaseMarketplaceProvider {
  kind: 'driver';
  platform: 'pet_trek';
  driverId?: string;
  pricePerKm: string | null;
  vehicleType: string | null;
  vehicleCapacity: number | null;
  hasAirConditioning: boolean | null;
  hasPetSafetyGear: boolean | null;
}

/**
 * Groomer-specific provider (Groomers Marketplace)
 */
export interface GroomerProvider extends BaseMarketplaceProvider {
  kind: 'groomer';
  platform: 'groomers';
  groomerId?: string;
  pricePerSession: string | null;
  specializations: string[] | null;
  mobileService: boolean | null;
  acceptedPetSizes: string[] | null;
}

/**
 * Discriminated union of all provider types
 */
export type MarketplaceProvider = 
  | WalkerProvider 
  | SitterProvider 
  | DriverProvider 
  | GroomerProvider;

/**
 * Unified search filters for all marketplace platforms
 */
export const marketplaceSearchFiltersSchema = z.object({
  platform: z.enum(['walk_my_pet', 'sitter_suite', 'pet_trek', 'groomers', 'k9000']),
  
  // Location filters
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().min(1).max(50).default(10).optional(),
  city: z.string().optional(),
  
  // Quality filters
  minRating: z.number().min(0).max(5).optional(),
  verifiedOnly: z.boolean().default(false).optional(),
  
  // Price filters
  maxPrice: z.number().optional(),
  minPrice: z.number().optional(),
  
  // Availability filters
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  
  // Platform-specific filters (optional)
  bodyCamera: z.boolean().optional(), // Walker-specific
  droneAccess: z.boolean().optional(), // Walker-specific
  hasOwnPets: z.boolean().optional(), // Sitter-specific
  petTypes: z.array(z.string()).optional(), // Sitter-specific
  vehicleType: z.string().optional(), // Driver-specific
  mobileService: z.boolean().optional(), // Groomer-specific
  
  // Pagination
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().min(0).default(0).optional(),
});

export type MarketplaceSearchFilters = z.infer<typeof marketplaceSearchFiltersSchema>;

/**
 * Unified marketplace search response
 */
export interface MarketplaceSearchResponse {
  providers: MarketplaceProvider[];
  total: number;
  platform: MarketplacePlatformId;
  filters: MarketplaceSearchFilters;
}

// ===== FINANCE & SETTLEMENTS - PARTNER REVENUE SHARING =====

/**
 * Partners table - Manages revenue sharing partners (municipalities, franchises, etc.)
 */
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // "municipality", "shopping_center", "pet_store_chain", "gas_station_chain", "franchise", "other"
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  revenueSharePercent: decimal("revenue_share_percent", { precision: 5, scale: 2 }), // e.g., "15.00" for 15%
  contractStart: timestamp("contract_start"),
  contractEnd: timestamp("contract_end"),
  isActive: boolean("is_active").default(true),
  billingAddress: text("billing_address"),
  taxId: varchar("tax_id"), // For Israeli compliance
  bankDetails: jsonb("bank_details"), // Encrypted bank info
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Partner agreements - Specific revenue sharing agreements per station/location
 */
export const partnerAgreements = pgTable("partner_agreements", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id).notNull(),
  stationId: integer("station_id").references(() => stations.id),
  revenueSharePercent: decimal("revenue_share_percent", { precision: 5, scale: 2 }).notNull(),
  minimumMonthlyAmount: decimal("minimum_monthly_amount", { precision: 10, scale: 2 }),
  maximumMonthlyAmount: decimal("maximum_monthly_amount", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Settlements - Automated revenue sharing settlements with audit trail
 */
export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  settlementNumber: varchar("settlement_number").unique().notNull(), // "SETTLE-2025-001"
  partnerId: integer("partner_id").references(() => partners.id).notNull(),
  periodType: varchar("period_type").default("monthly"), // "weekly", "monthly", "quarterly"
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  grossRevenue: decimal("gross_revenue", { precision: 12, scale: 2 }).notNull(),
  partnerShare: decimal("partner_share", { precision: 12, scale: 2 }).notNull(),
  petwashShare: decimal("petwash_share", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }),
  status: varchar("status").default("pending"), // "pending", "approved", "paid", "disputed"
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  paymentReference: varchar("payment_reference"),
  notes: text("notes"),
  auditHash: varchar("audit_hash"), // SHA-256 for immutability
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * CPI Index History - Israeli Consumer Price Index (מדד המחירים לצרכן)
 * Legal Requirement: Israeli law requires automatic indexation for rent, mortgages, taxes, wages
 * Data Source: Bank of Israel / CBS (Central Bureau of Statistics)
 * Update Schedule: Monthly on the 15th
 */
export const cpiIndexHistory = pgTable("cpi_index_history", {
  id: serial("id").primaryKey(),
  month: varchar("month").notNull(), // "2025-01" format (YYYY-MM)
  indexValue: decimal("index_value", { precision: 10, scale: 2 }).notNull(), // 104.10
  yearOverYearChange: decimal("year_over_year_change", { precision: 5, scale: 2 }), // 2.5 (%)
  source: varchar("source").default("Bank of Israel"), // "CBS", "Bank of Israel", "Manual"
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = typeof partners.$inferInsert;
export type PartnerAgreement = typeof partnerAgreements.$inferSelect;
export type InsertPartnerAgreement = typeof partnerAgreements.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;
export type InsertSettlement = typeof settlements.$inferInsert;
export type CPIIndexHistory = typeof cpiIndexHistory.$inferSelect;
export type InsertCPIIndexHistory = typeof cpiIndexHistory.$inferInsert;

// Zod validation schemas
export const insertPartnerSchema = createInsertSchema(partners, {
  type: z.enum(['municipality', 'shopping_center', 'pet_store_chain', 'gas_station_chain', 'franchise', 'other']),
  contactEmail: z.string().email().optional(),
  revenueSharePercent: z.string().regex(/^\d+\.\d{2}$/).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updatePartnerSchema = insertPartnerSchema.partial();

export const insertPartnerAgreementSchema = createInsertSchema(partnerAgreements, {
  revenueSharePercent: z.string().regex(/^\d+\.\d{2}$/),
}).omit({ id: true, createdAt: true });

export const updatePartnerAgreementSchema = insertPartnerAgreementSchema.partial();

export const insertSettlementSchema = createInsertSchema(settlements, {
  periodType: z.enum(['weekly', 'monthly', 'quarterly']),
  status: z.enum(['pending', 'approved', 'paid', 'disputed']),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateSettlementSchema = insertSettlementSchema.partial();

// ===== LOGISTICS & FLEET MANAGEMENT TYPES =====

export type LogisticsTask = typeof logisticsTasks.$inferSelect;
export type InsertLogisticsTask = typeof logisticsTasks.$inferInsert;
export type LogisticsVehicle = typeof logisticsVehicles.$inferSelect;
export type InsertLogisticsVehicle = typeof logisticsVehicles.$inferInsert;

// ===== MOBILE FIELD OPERATIONS TYPES =====

export type FieldUpdate = typeof fieldUpdates.$inferSelect;
export type InsertFieldUpdate = typeof fieldUpdates.$inferInsert;
export type FieldUpdatePhoto = typeof fieldUpdatePhotos.$inferSelect;
export type InsertFieldUpdatePhoto = typeof fieldUpdatePhotos.$inferInsert;
export type StaffDevice = typeof staffDevices.$inferSelect;
export type InsertStaffDevice = typeof staffDevices.$inferInsert;

// Zod validation schemas
export const insertFieldUpdateSchema = createInsertSchema(fieldUpdates, {
  message: z.string().min(1).max(5000),
  status: z.enum(['before', 'during', 'after', 'issue']).optional(),
}).omit({ id: true, createdAt: true });

export const insertFieldUpdatePhotoSchema = createInsertSchema(fieldUpdatePhotos, {
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/),
  fileSizeBytes: z.number().max(5 * 1024 * 1024), // 5MB max
}).omit({ id: true, uploadedAt: true });

export const insertStaffDeviceSchema = createInsertSchema(staffDevices, {
  platform: z.enum(['ios', 'android']),
  pushToken: z.string().optional(),
}).omit({ id: true, createdAt: true, lastSeenAt: true });

export const updateStaffDeviceSchema = insertStaffDeviceSchema.partial();

export const insertLogisticsTaskSchema = createInsertSchema(logisticsTasks, {
  type: z.enum(['supply_delivery', 'parts_delivery', 'installation', 'deinstallation', 'pickup']),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed']).default('pending'),
});

export const updateLogisticsTaskSchema = insertLogisticsTaskSchema.partial().omit({ 
  id: true, 
  taskNumber: true, 
  createdAt: true,
  createdByUserId: true 
});

export const insertLogisticsVehicleSchema = createInsertSchema(logisticsVehicles, {
  type: z.enum(['van', 'small_truck', 'car', 'bike']),
});

export const updateLogisticsVehicleSchema = insertLogisticsVehicleSchema.partial().omit({ 
  id: true, 
  createdAt: true 
});

// ============================================================================
// HEALTH & SAFETY MODULE - Incident Reporting System
// ============================================================================

// Health & Safety incidents table
export const healthSafetyIncidents = pgTable("health_safety_incidents", {
  id: serial("id").primaryKey(),
  incidentNumber: varchar("incident_number").unique().notNull(), // "INC-2025-001"
  stationId: integer("station_id").references(() => stations.id).notNull(),
  reportedByUserId: varchar("reported_by_user_id").notNull(), // Firebase UID
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  type: varchar("type").notNull(), // "slip_and_fall", "electrical", "water_leak", "injury", "equipment_malfunction", "other"
  severity: varchar("severity").notNull(), // "low", "medium", "high", "critical"
  status: varchar("status").default("open"), // "open", "in_review", "resolved", "closed"
  actionTaken: text("action_taken"),
  resolutionNotes: text("resolution_notes"),
  resolvedByUserId: varchar("resolved_by_user_id"),
  resolvedAt: timestamp("resolved_at"),
  reportedAt: timestamp("reported_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_hs_incidents_station").on(table.stationId),
  index("idx_hs_incidents_status").on(table.status),
  index("idx_hs_incidents_severity").on(table.severity),
  index("idx_hs_incidents_reported").on(table.reportedAt),
]);

// Incident photos table
export const incidentPhotos = pgTable("incident_photos", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").references(() => healthSafetyIncidents.id, { onDelete: "cascade" }).notNull(),
  fileName: varchar("file_name").notNull(),
  fileUrl: varchar("file_url").notNull(), // Firebase Storage
  fileSizeBytes: integer("file_size_bytes"),
  mimeType: varchar("mime_type"),
  uploadedByUserId: varchar("uploaded_by_user_id").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
}, (table) => [
  index("idx_incident_photos_incident").on(table.incidentId),
]);

// Type exports
export type HealthSafetyIncident = typeof healthSafetyIncidents.$inferSelect;
export type InsertHealthSafetyIncident = typeof healthSafetyIncidents.$inferInsert;
export type IncidentPhoto = typeof incidentPhotos.$inferSelect;
export type InsertIncidentPhoto = typeof incidentPhotos.$inferInsert;

// Zod validation schemas
export const insertHealthSafetyIncidentSchema = createInsertSchema(healthSafetyIncidents, {
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  type: z.enum(['slip_and_fall', 'electrical', 'water_leak', 'injury', 'equipment_malfunction', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'in_review', 'resolved', 'closed']).optional(),
}).omit({ id: true, incidentNumber: true, createdAt: true, updatedAt: true, reportedAt: true });

export const updateHealthSafetyIncidentSchema = insertHealthSafetyIncidentSchema.partial();

export const insertIncidentPhotoSchema = createInsertSchema(incidentPhotos, {
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/),
  fileSizeBytes: z.number().max(5 * 1024 * 1024), // 5MB max
}).omit({ id: true, uploadedAt: true });

// ===== INVENTORY MANAGEMENT TYPES & SCHEMAS =====

// Type exports
export type Supply = typeof supplies.$inferSelect;
export type InsertSupply = typeof supplies.$inferInsert;
export type StationSupply = typeof stationSupplies.$inferSelect;
export type InsertStationSupply = typeof stationSupplies.$inferInsert;
export type InventoryRefill = typeof inventoryRefills.$inferSelect;
export type InsertInventoryRefill = typeof inventoryRefills.$inferInsert;

// Zod validation schemas
export const insertSupplySchema = createInsertSchema(supplies, {
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  category: z.enum(['shampoo', 'conditioner', 'disinfectant', 'towels', 'accessories', 'other']),
  unitType: z.enum(['liters', 'bottles', 'units', 'boxes', 'kg']),
  unitCost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  reorderThreshold: z.number().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateSupplySchema = insertSupplySchema.partial();

export const insertStationSupplySchema = createInsertSchema(stationSupplies, {
  currentLevel: z.number().min(0).optional(),
  reorderThreshold: z.number().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateStationSupplySchema = insertStationSupplySchema.partial();

export const insertInventoryRefillSchema = createInsertSchema(inventoryRefills, {
  amount: z.number().min(1),
  previousLevel: z.number().min(0),
  newLevel: z.number().min(0),
  notes: z.string().max(1000).optional(),
}).omit({ id: true, refilledAt: true });

// ============================================================================
// ISRAELI CONTRACTOR COMPLIANCE SYSTEM - Marketplace Model (Like Airbnb)
// ============================================================================

export const providerTaxCompliance = pgTable("provider_tax_compliance", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").notNull(), // walker_id, sitter_id, or driver_id
  providerType: varchar("provider_type").notNull(), // "walker", "sitter", "driver", "groomer", "trainer"
  
  // Israeli Tax Registration (MANDATORY)
  taxIdType: varchar("tax_id_type").notNull(), // "osek_patur" (עוסק פטור) or "osek_murshe" (עוסק מורשה)
  taxId: varchar("tax_id").notNull(), // Israeli Tax ID number
  taxRegistrationNumber: varchar("tax_registration_number"), // ח.פ או מספר עוסק
  isVatRegistered: boolean("is_vat_registered").default(false), // Must be true if earning >₪120,000/year
  vatNumber: varchar("vat_number"), // Only if isVatRegistered=true
  
  // National Insurance (Bituach Leumi) Registration
  nationalInsuranceNumber: varchar("national_insurance_number").notNull(), // מספר ביטוח לאומי
  isBituachLeumiActive: boolean("is_bituach_leumi_active").default(true), // Active coverage
  
  // Verification Status
  verificationStatus: varchar("verification_status").default("pending"), // "pending", "verified", "rejected", "expired"
  verifiedAt: timestamp("verified_at"),
  verifiedByUserId: varchar("verified_by_user_id"), // Admin who verified
  rejectionReason: text("rejection_reason"),
  expiresAt: timestamp("expires_at"), // Tax registration must be renewed annually
  
  // Document Uploads
  taxRegistrationDocumentUrl: varchar("tax_registration_document_url"), // Uploaded proof
  nationalInsuranceDocumentUrl: varchar("national_insurance_document_url"),
  
  // Compliance Flags
  isCompliant: boolean("is_compliant").default(false), // Overall compliance status
  riskLevel: varchar("risk_level").default("low"), // "low", "medium", "high" (employee misclassification risk)
  lastComplianceCheckAt: timestamp("last_compliance_check_at"),
  nextComplianceCheckAt: timestamp("next_compliance_check_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_provider_tax_provider").on(table.providerId),
  index("idx_provider_tax_status").on(table.verificationStatus),
  index("idx_provider_tax_expires").on(table.expiresAt),
]);

export const providerCommissions = pgTable("provider_commissions", {
  id: serial("id").primaryKey(),
  commissionId: varchar("commission_id").unique().notNull(), // "COMM-2025-001"
  providerId: varchar("provider_id").notNull(),
  providerType: varchar("provider_type").notNull(),
  bookingId: integer("booking_id").notNull(), // Reference to walk_bookings, sitter_bookings, etc.
  
  // Commission Calculation (Pet Wash takes 15-25% broker fee)
  customerPaidAmount: decimal("customer_paid_amount", { precision: 10, scale: 2 }).notNull(), // Total customer payment (ILS)
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // 15.00 to 25.00 (percentage)
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(), // Platform fee (ILS)
  providerEarnings: decimal("provider_earnings", { precision: 10, scale: 2 }).notNull(), // Provider gets this
  
  // Israeli VAT Tracking
  includesVat: boolean("includes_vat").default(true), // Israeli VAT 18%
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }), // VAT portion
  
  // Payment Status
  status: varchar("status").default("pending"), // "pending", "paid", "held", "refunded"
  paidToProviderAt: timestamp("paid_to_provider_at"),
  paymentMethod: varchar("payment_method"), // "bank_transfer", "direct_deposit"
  paymentReferenceId: varchar("payment_reference_id"),
  
  // Invoice Generation
  invoiceGenerated: boolean("invoice_generated").default(false),
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: varchar("invoice_url"),
  
  transactionDate: timestamp("transaction_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_provider_comm_provider").on(table.providerId),
  index("idx_provider_comm_status").on(table.status),
  index("idx_provider_comm_date").on(table.transactionDate),
]);

export const providerIndependenceScore = pgTable("provider_independence_score", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").unique().notNull(),
  providerType: varchar("provider_type").notNull(),
  
  // Independence Metrics (Higher score = Lower employee risk)
  totalClients: integer("total_clients").default(1), // Number of different platforms/clients
  exclusivityScore: decimal("exclusivity_score", { precision: 5, scale: 2 }).default("100.00"), // 0-100 (100=exclusive to PetWash, 0=many clients)
  
  // Revenue Distribution (Diversification = Independence)
  petwashRevenuePercent: decimal("petwash_revenue_percent", { precision: 5, scale: 2 }).default("100.00"), // % of total income from PetWash
  otherPlatformsRevenue: decimal("other_platforms_revenue", { precision: 10, scale: 2 }).default("0.00"), // Revenue from other sources
  
  // Work Pattern Analysis
  hasOwnEquipment: boolean("has_own_equipment").default(false), // Owns car, grooming tools, etc.
  canRefuseGigs: boolean("can_refuse_gigs").default(true), // Can decline bookings
  setOwnRates: boolean("set_own_rates").default(false), // Can set pricing
  hasSubstitutes: boolean("has_substitutes").default(false), // Can delegate work
  
  // Risk Calculation (Lower = Safer)
  employeeRiskScore: decimal("employee_risk_score", { precision: 5, scale: 2 }).default("0.00"), // 0-100 (0=safe contractor, 100=high employee risk)
  riskLevel: varchar("risk_level").default("low"), // "low", "medium", "high"
  
  // Recommendations
  complianceRecommendations: jsonb("compliance_recommendations"), // Array of suggestions to improve independence
  
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_provider_independence_provider").on(table.providerId),
  index("idx_provider_independence_risk").on(table.riskLevel),
]);

export const complianceVerificationLogs = pgTable("compliance_verification_logs", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").notNull(),
  providerType: varchar("provider_type").notNull(),
  verificationType: varchar("verification_type").notNull(), // "tax_registration", "national_insurance", "independence_check", "monthly_audit"
  
  // Verification Results
  checkStatus: varchar("check_status").notNull(), // "passed", "failed", "warning"
  findings: jsonb("findings"), // Detailed results
  actionRequired: text("action_required"),
  
  // Auditor Info
  performedByUserId: varchar("performed_by_user_id"), // Admin or system
  performedBySystem: boolean("performed_by_system").default(true), // Auto-check vs manual review
  
  // Compliance Actions
  actionTaken: text("action_taken"),
  notificationSent: boolean("notification_sent").default(false),
  providerNotifiedAt: timestamp("provider_notified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_compliance_logs_provider").on(table.providerId),
  index("idx_compliance_logs_type").on(table.verificationType),
  index("idx_compliance_logs_status").on(table.checkStatus),
  index("idx_compliance_logs_date").on(table.createdAt),
]);

// Type exports
export type ProviderTaxCompliance = typeof providerTaxCompliance.$inferSelect;
export type InsertProviderTaxCompliance = typeof providerTaxCompliance.$inferInsert;
export type ProviderCommission = typeof providerCommissions.$inferSelect;
export type InsertProviderCommission = typeof providerCommissions.$inferInsert;
export type ProviderIndependenceScore = typeof providerIndependenceScore.$inferSelect;
export type InsertProviderIndependenceScore = typeof providerIndependenceScore.$inferInsert;
export type ComplianceVerificationLog = typeof complianceVerificationLogs.$inferSelect;
export type InsertComplianceVerificationLog = typeof complianceVerificationLogs.$inferInsert;

// Zod validation schemas
export const insertProviderTaxComplianceSchema = createInsertSchema(providerTaxCompliance, {
  providerId: z.string().min(1),
  providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
  taxIdType: z.enum(['osek_patur', 'osek_murshe']),
  taxId: z.string().min(1).max(20),
  nationalInsuranceNumber: z.string().min(1).max(20),
  verificationStatus: z.enum(['pending', 'verified', 'rejected', 'expired']).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateProviderTaxComplianceSchema = insertProviderTaxComplianceSchema.partial();

export const insertProviderCommissionSchema = createInsertSchema(providerCommissions, {
  providerId: z.string().min(1),
  providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
  bookingId: z.number().min(1),
  customerPaidAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  commissionRate: z.string().regex(/^\d+(\.\d{1,2})?$/),
  commissionAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  providerEarnings: z.string().regex(/^\d+(\.\d{1,2})?$/),
  status: z.enum(['pending', 'paid', 'held', 'refunded']).optional(),
}).omit({ id: true, commissionId: true, createdAt: true, transactionDate: true });

// ============================================================================
// ISRAELI CONTRACTOR COMPREHENSIVE PROFILE - Extended Tables
// ============================================================================

export const contractorDocuments = pgTable("contractor_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(), // Links to provider ID
  type: varchar("type").notNull(), // "ID_CARD", "DRIVERS_LICENSE", "CAR_REGISTRATION", "BUSINESS_REGISTRATION", "INSURANCE_POLICY", "POLICE_CLEARANCE", "TRAINING_CERTIFICATE", "OTHER"
  country: varchar("country").default("IL"), // "IL", "AU", "US", "UK", "EU", "OTHER"
  url: varchar("url").notNull(), // Storage URL
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  verifiedByUserId: varchar("verified_by_user_id"),
  notesInternal: text("notes_internal"),
}, (table) => [
  index("idx_contractor_docs_contractor").on(table.contractorId),
  index("idx_contractor_docs_type").on(table.type),
  index("idx_contractor_docs_verified").on(table.verifiedAt),
]);

export const contractorInsurance = pgTable("contractor_insurance", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").unique().notNull(),
  providerName: varchar("provider_name"), // Insurance company name
  policyNumber: varchar("policy_number"),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  coversThirdParty: boolean("covers_third_party").default(false),
  coversProfessionalLiability: boolean("covers_professional_liability").default(false),
  coversAnimalsUnderCare: boolean("covers_animals_under_care").default(false),
  lastVerifiedAt: timestamp("last_verified_at"),
  documentId: varchar("document_id"), // Links to contractorDocuments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contractor_insurance_contractor").on(table.contractorId),
  index("idx_contractor_insurance_expiry").on(table.validUntil),
]);

export const contractorBackgroundChecks = pgTable("contractor_background_checks", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").unique().notNull(),
  providerName: varchar("provider_name"), // Background check provider
  reportId: varchar("report_id"),
  completedAt: timestamp("completed_at"),
  result: varchar("result").default("PENDING"), // "PASS", "FAIL", "PENDING", "NOT_REQUIRED"
  findings: jsonb("findings"), // Detailed results
  documentId: varchar("document_id"), // Links to contractorDocuments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contractor_bgcheck_contractor").on(table.contractorId),
  index("idx_contractor_bgcheck_result").on(table.result),
]);

export const contractorBankDetails = pgTable("contractor_bank_details", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").unique().notNull(),
  bankName: varchar("bank_name"), // e.g., "Bank Leumi", "Mizrahi-Tefahot"
  bankCode: varchar("bank_code"), // Israeli bank code
  branchCode: varchar("branch_code"),
  accountNumber: varchar("account_number"), // ⚠️ Should be encrypted in production
  accountHolderName: varchar("account_holder_name"),
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedByUserId: varchar("verified_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contractor_bank_contractor").on(table.contractorId),
  index("idx_contractor_bank_verified").on(table.isVerified),
]);

export const contractorServiceAreas = pgTable("contractor_service_areas", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").notNull(),
  country: varchar("country").default("IL"),
  city: varchar("city"),
  regionName: varchar("region_name"),
  radiusKm: decimal("radius_km", { precision: 6, scale: 2 }), // Service radius in kilometers
  centerLat: decimal("center_lat", { precision: 10, scale: 7 }), // GPS latitude
  centerLng: decimal("center_lng", { precision: 10, scale: 7 }), // GPS longitude
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contractor_areas_contractor").on(table.contractorId),
  index("idx_contractor_areas_city").on(table.city),
]);

export const contractorCapabilities = pgTable("contractor_capabilities", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").notNull(),
  serviceType: varchar("service_type").notNull(), // "SELF_SERVICE_STATION_CLEANING", "MOBILE_GROOMING", "PET_SITTING", "DOG_WALKING", "PET_TAXI", "TRAINING", "VET_VISIT_ASSIST", "OTHER"
  isEnabled: boolean("is_enabled").default(true), // Contractor toggled on
  platformApproved: boolean("platform_approved").default(false), // Admin approval required
  notesInternal: text("notes_internal"),
  approvedByUserId: varchar("approved_by_user_id"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_contractor_cap_contractor").on(table.contractorId),
  index("idx_contractor_cap_service").on(table.serviceType),
  index("idx_contractor_cap_approved").on(table.platformApproved),
  uniqueIndex("idx_contractor_cap_unique").on(table.contractorId, table.serviceType),
]);

// Extend existing providers table to support contractor base profile fields
export const contractorProfiles = pgTable("contractor_profiles", {
  id: varchar("id").primaryKey(), // Links to user ID or provider ID
  displayName: varchar("display_name").notNull(),
  legalName: varchar("legal_name").notNull(),
  email: varchar("email").notNull(),
  phoneE164: varchar("phone_e164").notNull(), // E.164 format: +972541234567
  whatsappOptIn: boolean("whatsapp_opt_in").default(false),
  countryOfOperation: varchar("country_of_operation").default("IL"),
  primaryCity: varchar("primary_city"),
  languageCodes: jsonb("language_codes").default(sql`'["he","en"]'::jsonb`), // ["he", "en"]
  acceptedPlatformTermsAt: timestamp("accepted_platform_terms_at"),
  acceptedIndependentStatusAt: timestamp("accepted_independent_status_at"),
  acceptedPrivacyPolicyAt: timestamp("accepted_privacy_policy_at"),
  complianceStatus: varchar("compliance_status").default("PENDING"), // "PENDING", "PARTIALLY_APPROVED", "APPROVED", "SUSPENDED", "BLOCKED"
  riskLevel: varchar("risk_level").default("LOW"), // "LOW", "MEDIUM", "HIGH"
  lastComplianceCheckAt: timestamp("last_compliance_check_at"),
  lastComplianceSummary: text("last_compliance_summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  archivedAt: timestamp("archived_at"),
}, (table) => [
  index("idx_contractor_profile_status").on(table.complianceStatus),
  index("idx_contractor_profile_country").on(table.countryOfOperation),
]);

// Type exports for new tables
export type ContractorDocument = typeof contractorDocuments.$inferSelect;
export type InsertContractorDocument = typeof contractorDocuments.$inferInsert;
export type ContractorInsurance = typeof contractorInsurance.$inferSelect;
export type InsertContractorInsurance = typeof contractorInsurance.$inferInsert;
export type ContractorBackgroundCheck = typeof contractorBackgroundChecks.$inferSelect;
export type InsertContractorBackgroundCheck = typeof contractorBackgroundChecks.$inferInsert;
export type ContractorBankDetails = typeof contractorBankDetails.$inferSelect;
export type InsertContractorBankDetails = typeof contractorBankDetails.$inferInsert;
export type ContractorServiceArea = typeof contractorServiceAreas.$inferSelect;
export type InsertContractorServiceArea = typeof contractorServiceAreas.$inferInsert;
export type ContractorCapability = typeof contractorCapabilities.$inferSelect;
export type InsertContractorCapability = typeof contractorCapabilities.$inferInsert;
export type ContractorProfile = typeof contractorProfiles.$inferSelect;
export type InsertContractorProfile = typeof contractorProfiles.$inferInsert;

// Zod validation schemas
export const insertContractorDocumentSchema = createInsertSchema(contractorDocuments, {
  contractorId: z.string().min(1),
  type: z.enum(['ID_CARD', 'DRIVERS_LICENSE', 'CAR_REGISTRATION', 'BUSINESS_REGISTRATION', 'INSURANCE_POLICY', 'POLICE_CLEARANCE', 'TRAINING_CERTIFICATE', 'OTHER']),
  country: z.enum(['IL', 'AU', 'US', 'UK', 'EU', 'OTHER']).optional(),
  url: z.string().url(),
}).omit({ id: true, uploadedAt: true });

export const insertContractorInsuranceSchema = createInsertSchema(contractorInsurance, {
  contractorId: z.string().min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertContractorBackgroundCheckSchema = createInsertSchema(contractorBackgroundChecks, {
  contractorId: z.string().min(1),
  result: z.enum(['PASS', 'FAIL', 'PENDING', 'NOT_REQUIRED']).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertContractorBankDetailsSchema = createInsertSchema(contractorBankDetails, {
  contractorId: z.string().min(1),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertContractorServiceAreaSchema = createInsertSchema(contractorServiceAreas, {
  contractorId: z.string().min(1),
  country: z.enum(['IL', 'AU', 'US', 'UK', 'EU', 'OTHER']).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertContractorCapabilitySchema = createInsertSchema(contractorCapabilities, {
  contractorId: z.string().min(1),
  serviceType: z.enum(['SELF_SERVICE_STATION_CLEANING', 'MOBILE_GROOMING', 'PET_SITTING', 'DOG_WALKING', 'PET_TAXI', 'TRAINING', 'VET_VISIT_ASSIST', 'OTHER']),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertContractorProfileSchema = createInsertSchema(contractorProfiles, {
  id: z.string().min(1),
  displayName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200),
  email: z.string().email(),
  phoneE164: z.string().regex(/^\+[1-9]\d{1,14}$/),
  countryOfOperation: z.enum(['IL', 'AU', 'US', 'UK', 'EU', 'OTHER']).optional(),
  complianceStatus: z.enum(['PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'SUSPENDED', 'BLOCKED']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
}).omit({ createdAt: true, updatedAt: true });

export const insertProviderIndependenceScoreSchema = createInsertSchema(providerIndependenceScore, {
  providerId: z.string().min(1),
  providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
}).omit({ id: true, lastCalculatedAt: true, updatedAt: true });

export const insertComplianceVerificationLogSchema = createInsertSchema(complianceVerificationLogs, {
  providerId: z.string().min(1),
  providerType: z.enum(['walker', 'sitter', 'driver', 'groomer', 'trainer']),
  verificationType: z.enum(['tax_registration', 'national_insurance', 'independence_check', 'monthly_audit']),
  checkStatus: z.enum(['passed', 'failed', 'warning']),
}).omit({ id: true, createdAt: true });

// ========================================
// Mobile App & Global Compliance Brain
// ========================================

// Devices table for mobile app tracking
export const devices = pgTable("devices", {
  id: varchar("id").primaryKey(), // device_id from mobile app
  userId: varchar("user_id").notNull(),
  platform: varchar("platform").notNull(), // "ios" or "android"
  osVersion: varchar("os_version"),
  appVersion: varchar("app_version"),
  pushToken: varchar("push_token"), // FCM/APNS push token
  isBlocked: boolean("is_blocked").default(false),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_devices_user").on(table.userId),
  index("idx_devices_last_seen").on(table.lastSeenAt),
]);

// Refresh tokens table for mobile app authentication
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  deviceId: varchar("device_id"),
  jti: varchar("jti").notNull(), // JWT ID - unique identifier for this specific token instance
  tokenHash: varchar("token_hash").notNull(), // bcrypt hashed refresh token
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  index("idx_refresh_tokens_user").on(table.userId),
  index("idx_refresh_tokens_device").on(table.deviceId),
  index("idx_refresh_tokens_expires").on(table.expiresAt),
  index("idx_refresh_tokens_jti").on(table.jti), // Fast lookup by JWT ID
]);

// Identity Verifications table (passport, drivers license, ID card)
export const identityVerifications = pgTable("identity_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  documentType: varchar("document_type").notNull(), // "id_card", "drivers_license", "passport"
  status: varchar("status").default("pending"), // "pending", "approved", "rejected", "expired"
  provider: varchar("provider"), // "SUMSUB", "ONFIDO", "TRULIOO", "mobile_app"
  details: jsonb("details"), // { country:"IL", biometricVerified:true, mrzChecked:true, ... }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_identity_verifications_contractor").on(table.contractorId),
  index("idx_identity_verifications_status").on(table.status),
]);

// Identity Document Files table
export const identityDocumentFiles = pgTable("identity_document_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identityVerificationId: varchar("identity_verification_id").notNull(),
  filePath: varchar("file_path").notNull(), // relative path or GCS URL
  mimeType: varchar("mime_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_identity_files_verification").on(table.identityVerificationId),
]);

// Liveness Checks table (selfie with face matching)
export const livenessChecks = pgTable("liveness_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  status: varchar("status").notNull(), // "passed", "failed"
  riskScore: real("risk_score").notNull(), // 0.0 - 1.0
  failureReason: text("failure_reason"),
  selfieUrl: varchar("selfie_url"), // URL to selfie image
  faceMatchScore: real("face_match_score"), // 0.0 - 1.0 (80%+ required)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_liveness_checks_contractor").on(table.contractorId),
  index("idx_liveness_checks_status").on(table.status),
]);

// Criminal Background Checks table
export const criminalBackgroundChecks = pgTable("criminal_background_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  country: varchar("country").notNull(),
  status: varchar("status").notNull(), // "clear", "record_found", "pending"
  detailsMasked: text("details_masked"), // Redacted details for privacy
  blockingOffenses: jsonb("blocking_offenses"), // ["animal_cruelty", "sex_offense", "violence"]
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_criminal_checks_contractor").on(table.contractorId),
  index("idx_criminal_checks_status").on(table.status),
]);

// Driver Safety Profiles table
export const driverSafetyProfiles = pgTable("driver_safety_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").unique().notNull(),
  licenseNumber: varchar("license_number"),
  licenseClass: varchar("license_class"),
  licenseExpiryDate: date("license_expiry_date"),
  licenseCountry: varchar("license_country").default("IL"),
  hasActiveBan: boolean("has_active_ban").default(false),
  banExpiryDate: date("ban_expiry_date"),
  pointsOnLicense: integer("points_on_license").default(0),
  lastIncidentDate: timestamp("last_incident_date"),
  safetyScore: real("safety_score").default(1.0), // 0.0 - 1.0
  riskLevel: varchar("risk_level").default("medium"), // "low", "medium", "high"
  declaresCleanRecord: boolean("declares_clean_record").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_driver_safety_contractor").on(table.contractorId),
  index("idx_driver_safety_ban").on(table.hasActiveBan),
]);

// Contractor Ratings table
export const contractorRatings = pgTable("contractor_ratings", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").notNull(),
  raterType: varchar("rater_type").notNull(), // "customer", "dispatcher", "internal"
  score: integer("score").notNull(), // 1-5 stars
  comment: text("comment"),
  jobId: varchar("job_id"), // Reference to specific job
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_contractor_ratings_contractor").on(table.contractorId),
  index("idx_contractor_ratings_score").on(table.score),
  index("idx_contractor_ratings_created").on(table.createdAt),
]);

// Contractor Incidents table
export const contractorIncidents = pgTable("contractor_incidents", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").notNull(),
  type: varchar("type").notNull(), // "pet_injury", "customer_complaint", "safety_violation", "driving_accident", "fraud", "late", "no_show", "other"
  severity: varchar("severity").notNull(), // "low", "medium", "high", "critical"
  description: text("description").notNull(),
  occurredAt: timestamp("occurred_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  autoBlocked: boolean("auto_blocked").default(false), // Critical incidents auto-block contractor
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_contractor_incidents_contractor").on(table.contractorId),
  index("idx_contractor_incidents_type").on(table.type),
  index("idx_contractor_incidents_severity").on(table.severity),
  index("idx_contractor_incidents_occurred").on(table.occurredAt),
]);

// Assignments table (jobs that need contractor assignment)
export const assignments = pgTable("assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  city: varchar("city"),
  country: varchar("country").default("IL"),
  type: varchar("type").notNull(), // "install", "service", "delivery", "cleaning", "grooming", "sitting", "walking"
  scheduledFor: timestamp("scheduled_for"),
  status: varchar("status").default("pending"), // "pending", "assigned", "completed", "cancelled"
  assignedContractorId: varchar("assigned_contractor_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_assignments_status").on(table.status),
  index("idx_assignments_scheduled").on(table.scheduledFor),
  index("idx_assignments_contractor").on(table.assignedContractorId),
]);

// Compliance Decisions table (Global Compliance Brain output)
export const complianceDecisions = pgTable("compliance_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").notNull(),
  assignmentId: varchar("assignment_id"),
  decision: varchar("decision").notNull(), // "approved", "pending", "rejected", "blocked"
  score: real("score").notNull(), // 0.0 - 1.0
  reasons: jsonb("reasons").notNull(), // Array of failure codes
  triggeredRules: jsonb("triggered_rules").notNull(), // Detailed rule violations
  decidedBy: varchar("decided_by").default("system"), // "system" or admin user id
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_compliance_decisions_contractor").on(table.contractorId),
  index("idx_compliance_decisions_assignment").on(table.assignmentId),
  index("idx_compliance_decisions_decision").on(table.decision),
  index("idx_compliance_decisions_created").on(table.createdAt),
]);

// Compliance Audit Logs table (Blockchain-style audit trail)
export const complianceAuditLogs = pgTable("compliance_audit_logs", {
  id: serial("id").primaryKey(),
  contractorId: varchar("contractor_id").notNull(),
  assignmentId: varchar("assignment_id"),
  decisionId: varchar("decision_id"),
  action: varchar("action").notNull(), // "evaluate", "manual_override", "status_change", "identity_upload", "document_verified"
  actorType: varchar("actor_type").notNull(), // "system", "admin"
  actorId: varchar("actor_id"), // User ID of admin who took action
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_compliance_audit_logs_contractor").on(table.contractorId),
  index("idx_compliance_audit_logs_decision").on(table.decisionId),
  index("idx_compliance_audit_logs_action").on(table.action),
  index("idx_compliance_audit_logs_created").on(table.createdAt),
]);

// ===========================================================
// PET WASH LTD – GLOBAL BACKEND FRAMEWORK 2025
// Unified Contractors + Drivers + Ratings + Identity + Compliance Layer
// ===========================================================

// Contractors table (unified contractor management)
export const contractors = pgTable("contractors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 50 }),
  roleType: varchar("role_type", { length: 50 }).notNull(), // sitter, driver, groomer, courier, etc
  status: varchar("status", { length: 50 }).default("pending"), // pending, active, blocked
  riskScore: real("risk_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_contractors_email").on(table.email),
  index("idx_contractors_status").on(table.status),
  index("idx_contractors_role_type").on(table.roleType),
]);

// Identity Documents table
export const identityDocuments = pgTable("identity_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").references(() => contractors.id),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  documentNumber: varchar("document_number", { length: 100 }).notNull(),
  issuedCountry: varchar("issued_country", { length: 50 }),
  expiryDate: varchar("expiry_date", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_identity_documents_contractor").on(table.contractorId),
]);

// Drivers table
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").references(() => contractors.id),
  vehicleType: varchar("vehicle_type", { length: 100 }),
  licenseNumber: varchar("license_number", { length: 100 }),
  licenseExpiry: varchar("license_expiry", { length: 50 }),
  areasOfService: text("areas_of_service"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_drivers_contractor").on(table.contractorId),
]);

// Ratings table
export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractorId: varchar("contractor_id").references(() => contractors.id),
  givenByUserId: varchar("given_by_user_id"),
  score: integer("score"),
  category: varchar("category", { length: 50 }), // communication, reliability, etc
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ratings_contractor").on(table.contractorId),
]);

// ===========================================================
// ISRAELI SUBCONTRACTOR AGREEMENT 2025 - Digital Signatures
// Legal-compliant digital signature storage for Israeli contractors
// CRITICAL: This table stores legally-binding digital signatures
// that meet Israeli digital signature and evidence requirements for 2025/2026
// ===========================================================
export const subcontractorSignatures = pgTable("subcontractor_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`), // UUID for signature ID
  subcontractorId: varchar("subcontractor_id").notNull(), // Contractor ID from contractors table or users table
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  agreementVersion: varchar("agreement_version", { length: 50 }).notNull(), // e.g., "2025.01", "2025.02", "2026.01"
  signedAt: timestamp("signed_at").notNull(), // Timestamp when signature was created
  ipAddress: varchar("ip_address", { length: 100 }), // REQUIRED for Israeli digital signature law 2025
  userAgent: text("user_agent"), // REQUIRED for Israeli digital signature law 2025
  deviceInfo: text("device_info"), // REQUIRED for Israeli digital signature law 2025
  signatureMethod: varchar("signature_method", { length: 50 }).notNull(), // typed_name, drawn_signature, otp_code, external_provider
  signaturePayload: text("signature_payload").notNull(), // SHA-256 hash of signature data
  agreementSnapshotJson: jsonb("agreement_snapshot_json").notNull(), // Full agreement JSON at time of signing - REQUIRED for evidence
  agreedToPrivacy: boolean("agreed_to_privacy").notNull().default(true),
  agreedToTerms: boolean("agreed_to_terms").notNull().default(true),
  auditTrailId: varchar("audit_trail_id", { length: 255 }), // Audit trail reference - REQUIRED for Israeli compliance 2025
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_subcontractor_signatures_subcontractor").on(table.subcontractorId),
  index("idx_subcontractor_signatures_email").on(table.email),
  index("idx_subcontractor_signatures_version").on(table.agreementVersion),
  index("idx_subcontractor_signatures_signed_at").on(table.signedAt),
]);

// Type exports for new tables
export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type IdentityVerification = typeof identityVerifications.$inferSelect;
export type InsertIdentityVerification = typeof identityVerifications.$inferInsert;
export type IdentityDocumentFile = typeof identityDocumentFiles.$inferSelect;
export type InsertIdentityDocumentFile = typeof identityDocumentFiles.$inferInsert;
export type LivenessCheck = typeof livenessChecks.$inferSelect;
export type InsertLivenessCheck = typeof livenessChecks.$inferInsert;
export type CriminalBackgroundCheck = typeof criminalBackgroundChecks.$inferSelect;
export type InsertCriminalBackgroundCheck = typeof criminalBackgroundChecks.$inferInsert;
export type DriverSafetyProfile = typeof driverSafetyProfiles.$inferSelect;
export type InsertDriverSafetyProfile = typeof driverSafetyProfiles.$inferInsert;
export type ContractorRating = typeof contractorRatings.$inferSelect;
export type InsertContractorRating = typeof contractorRatings.$inferInsert;
export type ContractorIncident = typeof contractorIncidents.$inferSelect;
export type InsertContractorIncident = typeof contractorIncidents.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;
export type ComplianceDecision = typeof complianceDecisions.$inferSelect;
export type InsertComplianceDecision = typeof complianceDecisions.$inferInsert;
export type ComplianceAuditLog = typeof complianceAuditLogs.$inferSelect;
export type InsertComplianceAuditLog = typeof complianceAuditLogs.$inferInsert;

// Framework 2025 type exports
export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = typeof contractors.$inferInsert;
export type IdentityDocument = typeof identityDocuments.$inferSelect;
export type InsertIdentityDocument = typeof identityDocuments.$inferInsert;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = typeof ratings.$inferInsert;
export type SubcontractorSignature = typeof subcontractorSignatures.$inferSelect;
export type InsertSubcontractorSignature = typeof subcontractorSignatures.$inferInsert;

// Framework 2025 Zod validation schemas
export const insertContractorSchema = createInsertSchema(contractors, {
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  country: z.string().optional(),
  roleType: z.enum(["sitter", "driver", "groomer", "courier", "walker", "trainer", "vet"]),
  status: z.enum(["pending", "active", "blocked"]).default("pending"),
}).omit({ id: true, createdAt: true, updatedAt: true, riskScore: true });

export const insertIdentityDocumentSchema = createInsertSchema(identityDocuments, {
  contractorId: z.string().uuid("Invalid contractor ID"),
  documentType: z.enum(["passport", "drivers_license", "national_id"]),
  documentNumber: z.string().min(1, "Document number is required"),
  issuedCountry: z.string().optional(),
  expiryDate: z.string().optional(),
}).omit({ id: true, createdAt: true });

export const insertDriverSchema = createInsertSchema(drivers, {
  contractorId: z.string().uuid("Invalid contractor ID"),
  vehicleType: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  areasOfService: z.string().optional(),
  isActive: z.boolean().default(true),
}).omit({ id: true, createdAt: true });

export const insertRatingSchema = createInsertSchema(ratings, {
  contractorId: z.string().uuid("Invalid contractor ID"),
  givenByUserId: z.string().uuid("Invalid user ID"),
  score: z.number().int().min(1).max(5, "Score must be between 1 and 5"),
  category: z.enum(["communication", "reliability", "professionalism", "quality"]),
  comment: z.string().optional(),
}).omit({ id: true, createdAt: true });

export const evaluateComplianceSchema = z.object({
  contractorId: z.string().uuid("Invalid contractor ID"),
});

// Israeli Subcontractor Agreement 2025 - Zod validation schema
export const insertSubcontractorSignatureSchema = createInsertSchema(subcontractorSignatures, {
  subcontractorId: z.string().min(1, "Subcontractor ID is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  agreementVersion: z.string().min(1, "Agreement version is required"),
  signedAt: z.date(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  deviceInfo: z.string().optional(),
  signatureMethod: z.enum(["typed_name", "drawn_signature", "otp_code", "external_provider"]),
  signaturePayload: z.string().min(1, "Signature payload is required"),
  agreementSnapshotJson: z.any(), // JSONB object - full agreement snapshot
  agreedToPrivacy: z.boolean().default(true),
  agreedToTerms: z.boolean().default(true),
  auditTrailId: z.string().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// =================== CAREER PORTAL SYSTEM ===================
// SEEK.com.au inspired career portal with fraud prevention and application tracking

export const careerPositions = pgTable("career_positions", {
  id: serial("id").primaryKey(),
  positionId: varchar("position_id", { length: 50 }).unique().notNull(), // POS-WALKER-001
  
  // Position Details
  title: varchar("title", { length: 255 }).notNull(), // Pet Walker, Driver, Host, Sitter
  titleHe: varchar("title_he", { length: 255 }), // Hebrew title
  department: varchar("department", { length: 100 }).notNull(), // operations, logistics, care, admin
  roleType: varchar("role_type", { length: 50 }).notNull(), // walker, driver, sitter, host, supplier, admin
  
  // Description
  shortDescription: text("short_description").notNull(),
  shortDescriptionHe: text("short_description_he"),
  fullDescription: text("full_description").notNull(),
  fullDescriptionHe: text("full_description_he"),
  
  // Requirements
  requirements: jsonb("requirements").default(sql`'[]'::jsonb`), // Array of requirement strings
  requirementsHe: jsonb("requirements_he").default(sql`'[]'::jsonb`),
  qualifications: jsonb("qualifications").default(sql`'[]'::jsonb`),
  benefits: jsonb("benefits").default(sql`'[]'::jsonb`),
  
  // Location & Type
  location: varchar("location", { length: 255 }).notNull(), // Tel Aviv, Nationwide, Remote
  locationType: varchar("location_type", { length: 50 }).default("hybrid"), // remote, onsite, hybrid, field
  employmentType: varchar("employment_type", { length: 50 }).notNull(), // contractor, part-time, full-time
  
  // Compensation (ranges for transparency)
  salaryRangeMin: decimal("salary_range_min", { precision: 10, scale: 2 }),
  salaryRangeMax: decimal("salary_range_max", { precision: 10, scale: 2 }),
  salaryCurrency: varchar("salary_currency", { length: 10 }).default("ILS"),
  salaryPeriod: varchar("salary_period", { length: 20 }).default("hourly"), // hourly, daily, weekly, monthly
  commissionStructure: text("commission_structure"),
  
  // Availability & Priority
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  urgencyLevel: varchar("urgency_level", { length: 20 }).default("normal"), // normal, urgent, critical
  openPositions: integer("open_positions").default(1),
  
  // Application Requirements
  requiresResume: boolean("requires_resume").default(true),
  requiresCoverLetter: boolean("requires_cover_letter").default(false),
  requiresBackgroundCheck: boolean("requires_background_check").default(true),
  requiresDrivingLicense: boolean("requires_driving_license").default(false),
  minimumAge: integer("minimum_age").default(18),
  
  // SEO & Display
  slug: varchar("slug", { length: 255 }).unique(), // pet-walker-tel-aviv
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: varchar("meta_description", { length: 500 }),
  
  // Statistics
  viewCount: integer("view_count").default(0),
  applicationCount: integer("application_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  roleTypeIdx: index("idx_career_positions_role_type").on(table.roleType),
  isActiveIdx: index("idx_career_positions_active").on(table.isActive),
  locationIdx: index("idx_career_positions_location").on(table.location),
  slugIdx: index("idx_career_positions_slug").on(table.slug),
}));

// SEEK-inspired fraud prevention signals for applications
export const applicationFraudSignals = pgTable("application_fraud_signals", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(), // References staffApplications.id
  
  // Detection Metadata
  signalType: varchar("signal_type", { length: 50 }).notNull(), // duplicate, velocity, pattern, identity, device
  severity: varchar("severity", { length: 20 }).notNull(), // low, medium, high, critical
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(), // 0-100
  
  // Signal Details
  description: text("description").notNull(),
  evidenceJson: jsonb("evidence_json"), // Supporting data for the signal
  
  // Device & IP Fingerprinting (SEEK-inspired)
  ipAddress: varchar("ip_address", { length: 100 }),
  ipCountry: varchar("ip_country", { length: 10 }),
  deviceFingerprint: varchar("device_fingerprint", { length: 255 }),
  userAgent: text("user_agent"),
  
  // Duplicate Detection
  matchedApplicationIds: jsonb("matched_application_ids").default(sql`'[]'::jsonb`), // Other apps with same email/phone/device
  matchType: varchar("match_type", { length: 50 }), // email, phone, device, name, address
  
  // Resolution
  status: varchar("status", { length: 20 }).default("pending"), // pending, reviewed, cleared, confirmed_fraud
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  applicationIdx: index("idx_fraud_signals_application").on(table.applicationId),
  signalTypeIdx: index("idx_fraud_signals_type").on(table.signalType),
  severityIdx: index("idx_fraud_signals_severity").on(table.severity),
  statusIdx: index("idx_fraud_signals_status").on(table.status),
}));

// Application step progress tracking (multi-step wizard)
export const applicationStepProgress = pgTable("application_step_progress", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull(),
  
  // Step Tracking
  stepNumber: integer("step_number").notNull(),
  stepName: varchar("step_name", { length: 100 }).notNull(), // personal_info, experience, documents, consent, review
  status: varchar("status", { length: 20 }).default("pending"), // pending, in_progress, completed, skipped
  
  // Completion Data
  completedAt: timestamp("completed_at"),
  dataSnapshot: jsonb("data_snapshot"), // Data entered at this step
  validationErrors: jsonb("validation_errors"),
  
  // Session Tracking (for autosave)
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  sessionId: varchar("session_id", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  applicationIdx: index("idx_step_progress_application").on(table.applicationId),
  stepIdx: index("idx_step_progress_step").on(table.stepNumber),
}));

// Career portal Zod schemas and type exports
export const insertCareerPositionSchema = createInsertSchema(careerPositions, {
  title: z.string().min(2, "Position title is required"),
  roleType: z.enum(["walker", "driver", "sitter", "host", "supplier", "admin", "trainer"]),
  department: z.string().min(1, "Department is required"),
  shortDescription: z.string().min(10, "Short description is required"),
  fullDescription: z.string().min(20, "Full description is required"),
  location: z.string().min(1, "Location is required"),
  employmentType: z.enum(["contractor", "part-time", "full-time"]),
}).omit({ 
  id: true, 
  positionId: true,  // Auto-generated on backend
  slug: true,        // Auto-generated on backend
  createdAt: true, 
  updatedAt: true, 
  publishedAt: true, 
  expiresAt: true,
  viewCount: true, 
  applicationCount: true 
});

export type InsertCareerPosition = z.infer<typeof insertCareerPositionSchema>;
export type CareerPosition = typeof careerPositions.$inferSelect;

export const insertApplicationFraudSignalSchema = createInsertSchema(applicationFraudSignals, {
  signalType: z.enum(["duplicate", "velocity", "pattern", "identity", "device"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(100),
  description: z.string().min(1, "Description is required"),
}).omit({ id: true, createdAt: true });

export type InsertApplicationFraudSignal = z.infer<typeof insertApplicationFraudSignalSchema>;
export type ApplicationFraudSignal = typeof applicationFraudSignals.$inferSelect;

export type ApplicationStepProgress = typeof applicationStepProgress.$inferSelect;

// ==================== PROVIDER TRAINING SYSTEM (Pet Wash™) ====================

// Training modules configuration (stored in code, referenced here for tracking)
export const providerTrainingModules = pgTable("provider_training_modules", {
  id: serial("id").primaryKey(),
  moduleId: varchar("module_id", { length: 50 }).unique().notNull(), // gen-001, sit-001, etc.
  platform: varchar("platform", { length: 50 }).notNull(), // sitter_suite, walk_my_pet, pettrek, k9000, general
  moduleNumber: integer("module_number").notNull(),
  titleHe: varchar("title_he", { length: 255 }).notNull(),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  descriptionHe: text("description_he"),
  descriptionEn: text("description_en"),
  durationMinutes: integer("duration_minutes").default(15),
  requiredForCertification: boolean("required_for_certification").default(true),
  videoUrl: varchar("video_url", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  platformIdx: index("idx_training_modules_platform").on(table.platform),
  moduleIdIdx: index("idx_training_modules_module_id").on(table.moduleId),
}));

// Provider training progress tracking
export const providerTrainingProgress = pgTable("provider_training_progress", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  
  // Progress tracking
  started: boolean("started").default(false),
  startedAt: timestamp("started_at"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // Video progress (percentage watched)
  videoProgress: integer("video_progress").default(0), // 0-100
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("idx_training_progress_provider").on(table.providerId),
  moduleIdx: index("idx_training_progress_module").on(table.moduleId),
  platformIdx: index("idx_training_progress_platform").on(table.platform),
  providerModuleUnique: unique("uq_training_progress_provider_module").on(table.providerId, table.moduleId),
}));

// Quiz results tracking (100% pass required)
export const providerTrainingQuizResults = pgTable("provider_training_quiz_results", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  moduleId: varchar("module_id", { length: 50 }).notNull(),
  
  // Quiz results
  score: integer("score").notNull(), // 0-100
  passed: boolean("passed").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  
  // Detailed results
  answers: jsonb("answers"), // [{questionId, selectedOptionId}]
  incorrectQuestions: jsonb("incorrect_questions"), // [{questionId, correctOptionId, selectedOptionId}]
  
  submittedAt: timestamp("submitted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  providerIdx: index("idx_quiz_results_provider").on(table.providerId),
  moduleIdx: index("idx_quiz_results_module").on(table.moduleId),
  passedIdx: index("idx_quiz_results_passed").on(table.passed),
}));

// Provider certificates (issued after training complete)
export const providerCertificates = pgTable("provider_certificates", {
  id: serial("id").primaryKey(),
  certificateId: varchar("certificate_id", { length: 50 }).unique().notNull(), // CERT-SITTER-XXXXXXXX
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  providerName: varchar("provider_name", { length: 255 }).notNull(),
  
  // Certificate details
  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // 2 years from issue
  status: varchar("status", { length: 20 }).default("active"), // active, expired, revoked, suspended
  
  // Verification
  verificationHash: varchar("verification_hash", { length: 64 }),
  verificationUrl: varchar("verification_url", { length: 500 }),
  
  // PDF storage
  pdfUrl: varchar("pdf_url", { length: 500 }),
  qrCodeUrl: varchar("qr_code_url", { length: 500 }),
  
  // Revocation info
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by", { length: 255 }),
  revocationReason: text("revocation_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("idx_certificates_provider").on(table.providerId),
  platformIdx: index("idx_certificates_platform").on(table.platform),
  statusIdx: index("idx_certificates_status").on(table.status),
  certificateIdIdx: index("idx_certificates_cert_id").on(table.certificateId),
}));

// Police check / background verification (Israeli תעודת יושר)
export const providerPoliceChecks = pgTable("provider_police_checks", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  
  // Document details
  documentType: varchar("document_type", { length: 50 }).default("police_clearance"), // police_clearance, criminal_background
  documentUrl: varchar("document_url", { length: 500 }), // GCS URL
  documentFileName: varchar("document_file_name", { length: 255 }),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, under_review, approved, rejected, expired
  
  // Verification details
  issuedAt: timestamp("issued_at"), // Date on the document
  expiresAt: timestamp("expires_at"), // Usually valid for 3-6 months
  
  // Review
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  
  // Badge issued flag
  badgeIssued: boolean("badge_issued").default(false),
  badgeIssuedAt: timestamp("badge_issued_at"),
  
  // Biometric verification fields (Israeli Law 2025 compliance)
  biometricVerified: boolean("biometric_verified").default(false),
  biometricMatchScore: varchar("biometric_match_score", { length: 10 }), // 0-100%
  idDocumentUrl: varchar("id_document_url", { length: 500 }), // תעודת זהות ביומטרית
  selfieUrl: varchar("selfie_url", { length: 500 }), // Current selfie for face matching
  biometricVerifiedAt: timestamp("biometric_verified_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("idx_police_checks_provider").on(table.providerId),
  statusIdx: index("idx_police_checks_status").on(table.status),
}));

// Admin provider approval queue
export const providerApprovalQueue = pgTable("provider_approval_queue", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  
  // Application status
  status: varchar("status", { length: 20 }).default("pending"), // pending, under_review, approved, rejected, on_hold
  priority: varchar("priority", { length: 20 }).default("normal"), // low, normal, high, urgent
  
  // Checklist items (Pet Wash™ 7-point verification)
  photoApproved: boolean("photo_approved").default(false),
  certificateApproved: boolean("certificate_approved").default(false),
  idVerified: boolean("id_verified").default(false),
  addressVerified: boolean("address_verified").default(false),
  policeCheckApproved: boolean("police_check_approved").default(false),
  insuranceVerified: boolean("insurance_verified").default(false),
  pricingApproved: boolean("pricing_approved").default(false),
  
  // Review details
  assignedTo: varchar("assigned_to", { length: 255 }),
  assignedAt: timestamp("assigned_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  
  // Approval outcome
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("idx_approval_queue_provider").on(table.providerId),
  statusIdx: index("idx_approval_queue_status").on(table.status),
  priorityIdx: index("idx_approval_queue_priority").on(table.priority),
  platformIdx: index("idx_approval_queue_platform").on(table.platform),
}));

// Training Zod schemas and type exports
export const insertProviderTrainingProgressSchema = createInsertSchema(providerTrainingProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderTrainingProgress = z.infer<typeof insertProviderTrainingProgressSchema>;
export type ProviderTrainingProgress = typeof providerTrainingProgress.$inferSelect;

export const insertProviderTrainingQuizResultSchema = createInsertSchema(providerTrainingQuizResults).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
});
export type InsertProviderTrainingQuizResult = z.infer<typeof insertProviderTrainingQuizResultSchema>;
export type ProviderTrainingQuizResult = typeof providerTrainingQuizResults.$inferSelect;

export const insertProviderCertificateSchema = createInsertSchema(providerCertificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderCertificate = z.infer<typeof insertProviderCertificateSchema>;
export type ProviderCertificate = typeof providerCertificates.$inferSelect;

export const insertProviderPoliceCheckSchema = createInsertSchema(providerPoliceChecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderPoliceCheck = z.infer<typeof insertProviderPoliceCheckSchema>;
export type ProviderPoliceCheck = typeof providerPoliceChecks.$inferSelect;

export const insertProviderApprovalQueueSchema = createInsertSchema(providerApprovalQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderApprovalQueue = z.infer<typeof insertProviderApprovalQueueSchema>;
export type ProviderApprovalQueue = typeof providerApprovalQueue.$inferSelect;

// ============================================================================
// PIN AUTHENTICATION SYSTEM - December 2025 Edition
// Modern passwordless PIN login following Apple/Google/Microsoft standards
// ============================================================================

// User PIN credentials (device-bound, hashed, with rate limiting)
export const userPins = pgTable("user_pins", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(), // Links to users or customers table
  userType: varchar("user_type", { length: 20 }).notNull().default("customer"), // "user" or "customer"
  
  // PIN Security (bcrypt hashed, never stored in plaintext)
  pinHash: varchar("pin_hash", { length: 255 }).notNull(), // bcrypt hash of 4-6 digit PIN
  pinLength: integer("pin_length").notNull().default(6), // 4, 5, or 6 digits
  
  // Device Binding (optional - for enhanced security)
  deviceId: varchar("device_id", { length: 255 }), // UUID of trusted device
  deviceName: varchar("device_name", { length: 100 }), // "iPhone 15 Pro", "Galaxy S24"
  deviceType: varchar("device_type", { length: 50 }), // "ios", "android", "web", "kiosk"
  
  // Rate Limiting & Security
  failedAttempts: integer("failed_attempts").default(0).notNull(), // Reset after successful login
  lockoutUntil: timestamp("lockout_until"), // Temporary lockout after too many failures
  lastFailedAt: timestamp("last_failed_at"),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isPrimary: boolean("is_primary").default(true).notNull(), // Main PIN for this user
  
  // Audit
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_user_pins_user").on(table.userId),
  deviceIdx: index("idx_user_pins_device").on(table.deviceId),
  activeIdx: index("idx_user_pins_active").on(table.isActive),
}));

// PIN authentication audit log (immutable security trail)
export const pinAuthLogs = pgTable("pin_auth_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  userType: varchar("user_type", { length: 20 }).notNull(),
  
  // Action details
  action: varchar("action", { length: 30 }).notNull(), // "login_success", "login_failed", "pin_created", "pin_changed", "pin_reset", "lockout_triggered"
  
  // Context
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"),
  deviceId: varchar("device_id", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }),
  
  // Security metadata
  failedAttemptNumber: integer("failed_attempt_number"), // Which attempt was this (1-5)
  lockoutDuration: integer("lockout_duration"), // Minutes of lockout if triggered
  
  // Geolocation (optional)
  country: varchar("country", { length: 2 }), // ISO country code
  city: varchar("city", { length: 100 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_pin_auth_logs_user").on(table.userId),
  actionIdx: index("idx_pin_auth_logs_action").on(table.action),
  createdIdx: index("idx_pin_auth_logs_created").on(table.createdAt),
}));

// PIN Zod schemas and type exports
export const insertUserPinSchema = createInsertSchema(userPins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  failedAttempts: true,
  lockoutUntil: true,
  lastFailedAt: true,
  lastUsedAt: true,
});
export type InsertUserPin = z.infer<typeof insertUserPinSchema>;
export type UserPin = typeof userPins.$inferSelect;

export const insertPinAuthLogSchema = createInsertSchema(pinAuthLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertPinAuthLog = z.infer<typeof insertPinAuthLogSchema>;
export type PinAuthLog = typeof pinAuthLogs.$inferSelect;

// ============================================================================
// USER REGISTRATION TRACKING SYSTEM - MadPaws-style stamping
// Comprehensive tracking of all user registrations with audit trail
// ============================================================================

export const userRegistrations = pgTable("user_registrations", {
  id: serial("id").primaryKey(),
  
  // User identification
  userId: varchar("user_id", { length: 255 }).notNull(), // Firebase UID
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  
  // Registration type
  registrationType: varchar("registration_type", { length: 30 }).notNull(), // "customer", "provider", "staff", "admin"
  registrationMethod: varchar("registration_method", { length: 30 }).notNull(), // "email", "google", "apple", "phone", "passkey"
  platformSource: varchar("platform_source", { length: 50 }), // "web", "ios", "android", "kiosk"
  
  // Location stamping
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  country: varchar("country", { length: 2 }), // ISO country code
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  timezone: varchar("timezone", { length: 50 }),
  
  // Device stamping
  deviceId: varchar("device_id", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }), // "desktop", "mobile", "tablet", "kiosk"
  deviceModel: varchar("device_model", { length: 100 }),
  osName: varchar("os_name", { length: 50 }),
  osVersion: varchar("os_version", { length: 50 }),
  browserName: varchar("browser_name", { length: 50 }),
  browserVersion: varchar("browser_version", { length: 50 }),
  userAgent: text("user_agent"),
  
  // Marketing attribution
  referralCode: varchar("referral_code", { length: 50 }),
  referredBy: varchar("referred_by", { length: 255 }), // userId of referrer
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  utmContent: varchar("utm_content", { length: 100 }),
  utmTerm: varchar("utm_term", { length: 100 }),
  landingPage: text("landing_page"),
  
  // Compliance & consent
  privacyConsentAt: timestamp("privacy_consent_at"),
  marketingConsentAt: timestamp("marketing_consent_at"),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  ageVerifiedAt: timestamp("age_verified_at"),
  
  // Verification status
  emailVerified: boolean("email_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),
  identityVerified: boolean("identity_verified").default(false),
  
  // Security audit
  registrationHash: varchar("registration_hash", { length: 64 }), // SHA-256 of registration data
  previousHash: varchar("previous_hash", { length: 64 }), // Blockchain-style chain
  
  // Timestamps
  registeredAt: timestamp("registered_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdx: index("idx_user_registrations_user").on(table.userId),
  emailIdx: index("idx_user_registrations_email").on(table.email),
  typeIdx: index("idx_user_registrations_type").on(table.registrationType),
  dateIdx: index("idx_user_registrations_date").on(table.registeredAt),
  countryIdx: index("idx_user_registrations_country").on(table.country),
}));

export const insertUserRegistrationSchema = createInsertSchema(userRegistrations).omit({
  id: true,
  registeredAt: true,
  updatedAt: true,
});
export type InsertUserRegistration = z.infer<typeof insertUserRegistrationSchema>;
export type UserRegistration = typeof userRegistrations.$inferSelect;

// ============================================================================
// ENHANCED BOOKING SEARCH SYSTEM - MadPaws-style with pet filters
// ============================================================================

export const bookingSearchFiltersSchema = z.object({
  // Service type
  serviceType: z.enum(['pet_sitting', 'dog_walking', 'grooming', 'pet_taxi', 'daycare', 'training', 'k9000_wash']),
  
  // Pet information
  petCount: z.number().min(1).max(10).optional(),
  petTypes: z.array(z.enum(['dog', 'cat', 'bird', 'rabbit', 'hamster', 'fish', 'reptile', 'other'])).optional(),
  petNames: z.array(z.string()).optional(),
  petSizes: z.array(z.enum(['tiny', 'small', 'medium', 'large', 'giant'])).optional(),
  petIds: z.array(z.number()).optional(), // Specific pet profile IDs
  
  // Location filters
  area: z.string().optional(), // City or neighborhood name
  city: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().min(1).max(50).default(10).optional(),
  
  // Date range
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  
  // Provider preferences
  minRating: z.number().min(0).max(5).optional(),
  verifiedOnly: z.boolean().default(false).optional(),
  policeCheckRequired: z.boolean().optional(),
  experienceYears: z.number().optional(),
  
  // Price range
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  
  // Special requirements
  specialNeeds: z.boolean().optional(),
  medicationAdmin: z.boolean().optional(),
  hasYard: z.boolean().optional(),
  noOtherPets: z.boolean().optional(),
  
  // Pagination
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().min(0).default(0).optional(),
  
  // Sorting
  sortBy: z.enum(['rating', 'price', 'distance', 'reviews', 'experience']).default('rating').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

export type BookingSearchFilters = z.infer<typeof bookingSearchFiltersSchema>;

// =============================================
// MADPAWS-STYLE BOOKING REQUESTS TABLE
// Complete booking flow: request → meet & greet → payment → service → completion
// =============================================

export const bookingRequestStatusEnum = pgEnum('booking_request_status', [
  'pending',           // Initial request sent to provider
  'accepted',          // Provider accepted, awaiting meet & greet
  'declined',          // Provider declined the request
  'meet_greet_scheduled', // Meet & Greet date set
  'meet_greet_completed', // Meet & Greet done, awaiting payment
  'payment_pending',   // Awaiting payment from owner
  'confirmed',         // Payment received, booking confirmed
  'in_progress',       // Service currently happening
  'completed',         // Service completed, pending review
  'reviewed',          // Owner left review
  'cancelled',         // Cancelled by either party
  'disputed'           // Payment/service dispute
]);

export const bookingRequests = pgTable("booking_requests", {
  id: serial("id").primaryKey(),
  requestId: varchar("request_id", { length: 24 }).notNull().unique(), // Nanoid for public reference
  
  // Parties
  ownerId: varchar("owner_id", { length: 128 }).notNull(), // Pet owner Firebase UID
  providerId: varchar("provider_id", { length: 128 }).notNull(), // Service provider Firebase UID
  providerProfileId: integer("provider_profile_id"), // Sitter/Walker profile ID
  providerType: varchar("provider_type", { length: 32 }).notNull(), // sitter, walker, trainer, driver, k9000
  
  // Service details
  serviceType: varchar("service_type", { length: 32 }).notNull(), // pet_sitting, dog_walking, etc.
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Pet information
  petIds: text("pet_ids").array(), // Array of pet profile IDs
  petCount: integer("pet_count").notNull().default(1),
  petDetails: jsonb("pet_details"), // Cached pet info for reference
  
  // Pricing
  dailyRateCents: integer("daily_rate_cents"),
  hourlyRateCents: integer("hourly_rate_cents"),
  totalDays: integer("total_days"),
  totalHours: decimal("total_hours"),
  subtotalCents: integer("subtotal_cents").notNull(),
  serviceFeePercent: decimal("service_fee_percent").default("15"), // 15% platform fee
  serviceFeeCents: integer("service_fee_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("ILS").notNull(),
  
  // Status tracking
  status: bookingRequestStatusEnum("status").default("pending").notNull(),
  statusHistory: jsonb("status_history").default([]), // [{status, timestamp, note}]
  
  // Meet & Greet
  meetGreetDate: timestamp("meet_greet_date"),
  meetGreetLocation: text("meet_greet_location"),
  meetGreetNotes: text("meet_greet_notes"),
  meetGreetCompletedAt: timestamp("meet_greet_completed_at"),
  
  // Messages
  ownerMessage: text("owner_message"), // Initial request message
  providerResponse: text("provider_response"),
  specialRequirements: text("special_requirements"),
  
  // Payment
  paymentMethod: varchar("payment_method", { length: 32 }), // nayax, apple_pay, etc.
  paymentTransactionId: varchar("payment_transaction_id", { length: 64 }),
  paymentHeldAt: timestamp("payment_held_at"), // Escrow start
  paymentReleasedAt: timestamp("payment_released_at"), // Payment to provider
  
  // Service tracking
  serviceStartedAt: timestamp("service_started_at"),
  serviceCompletedAt: timestamp("service_completed_at"),
  photoUpdates: jsonb("photo_updates").default([]), // [{url, caption, timestamp}]
  
  // Completion & Review
  ownerConfirmedAt: timestamp("owner_confirmed_at"),
  ownerRating: decimal("owner_rating"),
  ownerReview: text("owner_review"),
  providerRating: decimal("provider_rating"), // Provider rates owner
  providerReview: text("provider_review"),
  
  // Cancellation
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 16 }), // owner, provider, system
  cancellationReason: text("cancellation_reason"),
  refundCents: integer("refund_cents"),
  refundProcessedAt: timestamp("refund_processed_at"),
  
  // Metadata
  searchId: varchar("search_id", { length: 24 }), // Link to original search
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingRequestSchema = createInsertSchema(bookingRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BookingRequest = typeof bookingRequests.$inferSelect;
export type InsertBookingRequest = z.infer<typeof insertBookingRequestSchema>;

// Schema for creating a new booking request from search results
export const createBookingRequestSchema = z.object({
  providerId: z.string(),
  providerProfileId: z.number().optional(),
  providerType: z.enum(['sitter', 'walker', 'trainer', 'driver', 'groomer', 'k9000']),
  serviceType: z.enum(['pet_sitting', 'dog_walking', 'grooming', 'pet_taxi', 'daycare', 'training', 'k9000_wash']),
  startDate: z.string(), // ISO date
  endDate: z.string(),
  petIds: z.array(z.string()).optional(),
  petCount: z.number().min(1).max(10),
  message: z.string().optional(),
  specialRequirements: z.string().optional(),
  searchId: z.string().optional(),
});

export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;

// Schema for provider response to booking request
export const providerBookingResponseSchema = z.object({
  requestId: z.string(),
  action: z.enum(['accept', 'decline', 'counter']),
  response: z.string().optional(),
  meetGreetDate: z.string().optional(), // ISO date for meet & greet
  meetGreetLocation: z.string().optional(),
  counterOffer: z.object({
    dailyRateCents: z.number().optional(),
    hourlyRateCents: z.number().optional(),
  }).optional(),
});

export type ProviderBookingResponse = z.infer<typeof providerBookingResponseSchema>;

export interface BookingSearchResult {
  providers: Array<{
    id: number;
    userId: string;
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
    rating: number;
    totalReviews: number;
    totalBookings: number;
    pricePerNight: number | null;
    pricePerHour: number | null;
    city: string;
    distance?: number;
    isVerified: boolean;
    hasPoliceCheck: boolean;
    yearsExperience: number;
    acceptedPetTypes: string[];
    maxPets: number;
    bio: string | null;
    badges: string[];
    responseTime: string;
    lastActive: Date | null;
  }>;
  total: number;
  filters: BookingSearchFilters;
  searchId: string; // For analytics tracking
}

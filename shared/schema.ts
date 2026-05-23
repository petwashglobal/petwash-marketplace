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
  numeric,
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
  phone: varchar("phone").unique(),
  dateOfBirth: varchar("date_of_birth"),
  address: text("address"),
  street: text("street"),
  streetNumber: varchar("street_number"),        // Building/house number, e.g. "18"
  apartment: varchar("apartment"),               // Apt / floor / entrance, e.g. "דירה 4"
  city: varchar("city"),
  postalCode: varchar("postal_code"),
  country: varchar("country").default("IL"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  // Temporary address — for users without a permanent address or on the move
  addressIsTemporary: boolean("address_is_temporary").default(false),
  temporaryAddress: text("temporary_address"),   // Full formatted temporary address
  temporaryLat: decimal("temporary_lat", { precision: 10, scale: 7 }),
  temporaryLng: decimal("temporary_lng", { precision: 10, scale: 7 }),
  temporaryPostal: varchar("temporary_postal"),
  gender: varchar("gender"),
  idNumber: varchar("id_number"),              // Government ID / Teudat Zehut
  carPlate: varchar("car_plate"),              // Primary vehicle plate (providers)
  carPlate2: varchar("car_plate_2"),           // Secondary vehicle plate
  emergencyContactName: varchar("emergency_contact_name"),
  emergencyContactPhone: varchar("emergency_contact_phone"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false), // User-facing 2FA toggle (UI alias for mfaRequired)
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
  loyaltyBalanceCents: integer("loyalty_balance_cents").notNull().default(0), // Cached loyalty credit balance in agorot (source of truth = loyalty_ledger)
  referralCode: varchar("referral_code", { length: 8 }).unique(), // This user's shareable referral code (auto-generated on signup)
  referredByCode: varchar("referred_by_code", { length: 8 }),     // Code used when user signed up (links to referrals.code)

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
  
  role: varchar("role").default("customer"),
  userStatus: varchar("user_status").default("new"),
  signupIntent: varchar("signup_intent"),
  accessLevel: integer("access_level").default(1),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  blocked: boolean("blocked").default(false),
  profileCompletedAt: timestamp("profile_completed_at"),
  providerApprovedAt: timestamp("provider_approved_at"),
  staffApprovedAt: timestamp("staff_approved_at"),
  mfaRequired: boolean("mfa_required").default(false),
  mfaEnrolled: boolean("mfa_enrolled").default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  termsVersion: varchar("terms_version"),
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  privacyVersion: varchar("privacy_version"),

  authProvider: varchar("auth_provider"),
  phoneE164: varchar("phone_e164"),
  phoneCountry: varchar("phone_country", { length: 5 }),
  emailVerified: boolean("email_verified").default(false),
  phoneVerified: boolean("phone_verified").default(false),
  timezone: varchar("timezone"),
  locale: varchar("locale"),
  riskLevel: varchar("risk_level").default("low"),
  regionCode: text("region_code").default('IL'),
  legalHold: boolean("legal_hold").default(false),
  lastLoginAt: timestamp("last_login_at"),
  softDeleteAt: timestamp("soft_delete_at"),
  deviceId: varchar("device_id"),
  membershipNumber: varchar("membership_number", { length: 20 }).unique(), // PWM-XXXXXXX

  // ACTIVATION STATE MACHINE (Phase 1)
  activationStatus: varchar("activation_status", { length: 30 }).notNull().default("draft"),
  // draft | mobile_verified | email_verified | active | suspended | deleted
  mobileVerifiedAt: timestamp("mobile_verified_at"),
  emailVerifiedAt: timestamp("email_verified_at"),
  accountActivatedAt: timestamp("account_activated_at"),
  acceptedTermsAt: timestamp("accepted_terms_at"),
  lastActivationEmailSentAt: timestamp("last_activation_email_sent_at"),
  activationVersion: integer("activation_version").notNull().default(1),

  // CUSTOMER JOURNEY STATE MACHINE (intelligence layer)
  // visitor | browsing | authenticated | ready_to_book | booked
  journeyState: varchar("journey_state", { length: 30 }).default("visitor"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── User Saved Addresses (on-demand address book) ──────────────────────────
export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  label: varchar("label", { length: 64 }).default("other"), // home | work | other | custom
  customLabel: varchar("custom_label", { length: 80 }),     // for label = "custom"
  address: text("address").notNull(),                        // full formatted address
  street: varchar("street", { length: 200 }),
  streetNumber: varchar("street_number", { length: 30 }),
  apartment: varchar("apartment", { length: 50 }),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  isDefault: boolean("is_default").default(false),
  usageCount: integer("usage_count").default(1).notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_addresses_user").on(table.userId),
]);

export const insertUserAddressSchema = createInsertSchema(userAddresses).omit({ id: true, createdAt: true, lastUsedAt: true });
export type InsertUserAddress = z.infer<typeof insertUserAddressSchema>;
export type UserAddress = typeof userAddresses.$inferSelect;

// ── User Intelligence Profiles (customer trust/behavior scoring) ─────────────
export const userIntelligenceProfiles = pgTable("user_intelligence_profiles", {
  userId: varchar("user_id", { length: 128 }).primaryKey(),
  userType: varchar("user_type", { length: 20 }).notNull().default("customer"),
  trustScore: decimal("trust_score", { precision: 5, scale: 2 }).default("50").notNull(),
  behaviorScore: decimal("behavior_score", { precision: 5, scale: 2 }).default("50").notNull(),
  riskLevel: decimal("risk_level", { precision: 5, scale: 2 }).default("0").notNull(),
  bookingHistoryCount: integer("booking_history_count").default(0).notNull(),
  cancellationRate: decimal("cancellation_rate", { precision: 5, scale: 4 }).default("0").notNull(),
  noShowCount: integer("no_show_count").default(0).notNull(),
  repeatUsageCount: integer("repeat_usage_count").default(0).notNull(),
  recentActivityDaysAgo: integer("recent_activity_days_ago"),
  preferences: jsonb("preferences").default({}).notNull(),
  lastComputedAt: timestamp("last_computed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_intelligence_user").on(table.userId),
  index("idx_user_intelligence_trust").on(table.trustScore),
]);

export const insertUserIntelligenceProfileSchema = createInsertSchema(userIntelligenceProfiles).omit({
  createdAt: true, updatedAt: true, lastComputedAt: true,
});
export type InsertUserIntelligenceProfile = z.infer<typeof insertUserIntelligenceProfileSchema>;
export type UserIntelligenceProfile = typeof userIntelligenceProfiles.$inferSelect;

// Verification Tokens — persistent store for OTP + email activation tokens
export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: varchar("type", { length: 30 }).notNull(), // email_activation | mobile_otp
  tokenHash: varchar("token_hash", { length: 128 }).notNull(), // SHA256 of token
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  attempts: integer("attempts").default(0).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | used | expired | locked
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_vtok_user_type").on(table.userId, table.type, table.status),
  index("idx_vtok_hash").on(table.tokenHash),
]);

export const insertVerificationTokenSchema = createInsertSchema(verificationTokens).omit({ id: true, createdAt: true });
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = typeof verificationTokens.$inferInsert;

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
  status: varchar("status").default("pending"), // "queued" | "sent" | "delivered" | "failed" | "permanently_failed"
  payload: jsonb("payload"), // Variables used in template
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  // Financial event linkage
  bookingId: varchar("booking_id"),
  transactionId: varchar("transaction_id"),
  eventType: varchar("event_type"), // "booking_confirmed" | "egift_purchased" | "prestige_joined" | "provider_approved" | "payout_issued"
  // Retry fields
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  nextRetryAt: timestamp("next_retry_at"),
  permanentlyFailed: boolean("permanently_failed").notNull().default(false),
  // Idempotency + provider tracking
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  providerMessageId: varchar("provider_message_id", { length: 255 }), // Twilio SID, FCM message ID
  // Rendered in-app content — populated when channel='in_app'
  title: varchar("title", { length: 500 }),
  body: text("body"),
  deepLink: varchar("deep_link", { length: 500 }),
}, (table) => [
  index("idx_notification_logs_template").on(table.templateKey),
  index("idx_notification_logs_user").on(table.recipientUserId),
  index("idx_notification_logs_status").on(table.status),
  index("idx_notification_logs_channel").on(table.channel),
  index("idx_notification_logs_created").on(table.createdAt),
]);

// Financial Documents — rendered receipts, earnings notices, eGift receipts, membership receipts
// PetWash is merchant of record: customer gets a receipt from PetWash; provider gets an earnings/payout statement
export const financialDocuments = pgTable("financial_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentReference: varchar("document_reference", { length: 64 }).notNull().unique(),
  userId: varchar("user_id").notNull(),
  bookingId: varchar("booking_id"),
  transactionId: varchar("transaction_id"),
  documentType: varchar("document_type", { length: 60 }).notNull(),
  // "booking_receipt" | "booking_earnings_notice" | "egift_receipt" | "membership_receipt" | "provider_payout_statement"
  // Additional document types for business events:
  // "refund_receipt" | "cancellation_notice" | "provider_rejection_notice" | "egift_redemption_receipt"
  issuedByEntity: varchar("issued_by_entity", { length: 100 }).notNull().default("PetWash"),
  documentPayloadJson: jsonb("document_payload_json").notNull(),
  renderedHtml: text("rendered_html").notNull(),
  renderedPdfUrl: varchar("rendered_pdf_url"),
  idempotencyKey: varchar("idempotency_key", { length: 255 }), // Prevents duplicate documents on repeated callbacks
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_fin_docs_user").on(table.userId),
  index("idx_fin_docs_booking").on(table.bookingId),
  index("idx_fin_docs_type").on(table.documentType),
  index("idx_fin_docs_issued").on(table.issuedAt),
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
  // ── Full coupon engine fields ──────────────────────────────────────────────
  campaignName: varchar("campaign_name", { length: 120 }),
  discountType: varchar("discount_type", { length: 30 }).default("fixed"),
  // fixed | percent | free_service | free_wash | package_credit
  currency: varchar("currency", { length: 3 }).default("ILS"),
  minSpendCents: integer("min_spend_cents").default(0),
  channelSource: varchar("channel_source", { length: 30 }),
  // sms | push | email | admin | app_banner | qr | referral
  scopeType: varchar("scope_type", { length: 30 }).default("global"),
  // global | kiosk | booking | sitter | walker | loyalty | wallet_topup | first_order
  scopeValue: varchar("scope_value", { length: 120 }),
  stackable: boolean("stackable").default(false),
  maxTotalRedemptions: integer("max_total_redemptions"),
  maxRedemptionsPerUser: integer("max_redemptions_per_user").default(1),
  totalRedemptions: integer("total_redemptions").default(0),
  createdByUserId: varchar("created_by_user_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User coupon usage (legacy — kept for backward compatibility)
export const userCoupons = pgTable("user_coupons", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  couponId: integer("coupon_id").references(() => coupons.id).notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

// Coupon eligibility rules — birthday, tier, first_order, holiday, city, etc.
export const couponEligibilityRules = pgTable("coupon_eligibility_rules", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").references(() => coupons.id, { onDelete: "cascade" }).notNull(),
  ruleType: varchar("rule_type", { length: 40 }).notNull(),
  // birthday | loyalty_tier | first_order | holiday | city | country | user_segment
  ruleValue: varchar("rule_value", { length: 120 }),
  // e.g. "silver" for loyalty_tier, "IL" for country, "birthday_30d" for birthday
  createdAt: timestamp("created_at").defaultNow(),
});

// Coupon redemptions — authoritative ledger entry for every coupon use
export const couponRedemptions = pgTable("coupon_redemptions", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").references(() => coupons.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orderType: varchar("order_type", { length: 40 }).notNull(),
  // kiosk_wash | sitter_booking | walker_booking | wallet_topup | loyalty_reward
  orderId: varchar("order_id", { length: 120 }),
  amountBeforeCents: integer("amount_before_cents").notNull(),
  discountAmountCents: integer("discount_amount_cents").notNull(),
  amountAfterCents: integer("amount_after_cents").notNull(),
  currency: varchar("currency", { length: 3 }).default("ILS"),
  redeemedAt: timestamp("redeemed_at").defaultNow(),
});

// Coupon delivery events — track send → deliver → open → click → redeem
export const couponDeliveryEvents = pgTable("coupon_delivery_events", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id").references(() => coupons.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(), // sms | push | email | in_app
  messageId: varchar("message_id", { length: 120 }),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  redeemedAt: timestamp("redeemed_at"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type CouponEligibilityRule = typeof couponEligibilityRules.$inferSelect;
export type CouponDeliveryEvent = typeof couponDeliveryEvents.$inferSelect;

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

// ─────────────────────────────────────────────────────────────────────────────
// K9000 Wash Usage Events — unified log for BOTH payment flows
//
// ─────────────────────────────────────────────────────────────────────────────
// FLOW A — Direct Terminal Sale (transaction_source = "nayax")
//   Guest pays by card/NFC at the Nayax terminal.
//   No PetWash wallet is involved.
//   Handler: POST /api/k9000/wash/start_cycle
//
// FLOW B — PetWash Wallet/Credit Redemption (transaction_source = "petwash")
//   Authenticated user scans a 45-sec HMAC-signed QR from the PetWash app.
//   Server debits the appropriate credit type BEFORE machine activation.
//   Handler: POST /api/k9000/redeem-wash (via K9000RedemptionService)
//
// REPORTING — redemption_source values (used by finance/fraud/support)
// ─────────────────────────────────────────────────────────────────────────────
//   "nayax"           → Flow A: direct card/NFC terminal payment
//   "wash_package"    → Flow B: prepaid wash-package credit (washPackageCredits)
//   "wallet_balance"  → Flow B: cash wallet ILS deduction (cashWalletBalanceCents)
//   "gift_credit"     → Flow B: eGift balance (egiftBalanceCents)
//   "loyalty_benefit" → Flow B: loyalty-tier free wash (loyaltyPointsBalance)
//   "promo_coupon"    → Flow B: promotional/coupon credit (promoBalanceCents)
//
// This table is the ONLY unified K9000 usage log for analytics and loyalty credits.
// Financial documents (PW-EGR, PW-RFD, etc.) are ONLY created for petwash rows.
// Nayax rows NEVER trigger FinancialDocumentService.
// ─────────────────────────────────────────────────────────────────────────────
export const k9000WashEvents = pgTable("k9000_wash_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Source discrimination — CRITICAL SEPARATION
  transactionSource: varchar("transaction_source").notNull(), // "petwash" | "nayax"
  redemptionSource: varchar("redemption_source").notNull(),   // "egift" | "nayax" | "loyalty_voucher"

  // PetWash-side references (populated for transaction_source = "petwash")
  egiftId: varchar("egift_id"),
  userId: varchar("user_id").references(() => users.id),
  documentReference: varchar("document_reference"), // PW-EGR-xxx link to financial_documents

  // Nayax-side references (populated for transaction_source = "nayax")
  nayaxTransactionId: varchar("nayax_transaction_id"),
  nayaxTerminalId: varchar("nayax_terminal_id"),
  nayaxSessionId: varchar("nayax_session_id"),

  // Shared wash context
  stationId: varchar("station_id"),
  baySide: varchar("bay_side"),
  platform: varchar("platform"),          // "k9000", "walk_my_pet", etc.
  product: varchar("product"),            // wash type / package name
  amountCents: integer("amount_cents"),   // Always in agorot (ILS cents)
  currency: varchar("currency", { length: 3 }).default("ILS"),

  // Loyalty & analytics
  loyaltyPointsAwarded: integer("loyalty_points_awarded").default(0),
  loyaltyEventLogged: boolean("loyalty_event_logged").default(false),

  // Status
  status: varchar("status").notNull().default("completed"), // "completed" | "failed" | "reversed"
  failureReason: text("failure_reason"),

  // Idempotency — prevent double-logging on webhook retry
  idempotencyKey: varchar("idempotency_key").unique(),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_k9000_wash_source").on(table.transactionSource),
  index("idx_k9000_wash_redemption").on(table.redemptionSource),
  index("idx_k9000_wash_user").on(table.userId),
  index("idx_k9000_wash_station").on(table.stationId),
  index("idx_k9000_wash_egift").on(table.egiftId),
  index("idx_k9000_wash_nayax_tx").on(table.nayaxTransactionId),
  index("idx_k9000_wash_created").on(table.createdAt),
]);

export type K9000WashEvent = typeof k9000WashEvents.$inferSelect;
export type InsertK9000WashEvent = typeof k9000WashEvents.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// STATION BAYS — per-bay registry for every K9000 Twin station
//
// Physical reality:
//   One K9000 Twin station = two completely independent wash bays (left + right).
//   Each bay has its OWN:
//     • Nayax card reader (yellow terminal)
//     • Nayax DOT QR reader (black round scanner)
//     • Wash tub / platform
//     • Session state
//   The shared central cabinet contains the main control board only.
//
// Rules:
//   - Card payment on left bay → starts left bay ONLY
//   - QR redemption on right bay → starts right bay ONLY
//   - Both bays can run simultaneously for two different customers
//   - No booking, no reservation — real-time readiness only
// ─────────────────────────────────────────────────────────────────────────────
export const stationBays = pgTable("station_bays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Station this bay belongs to
  stationId: varchar("station_id").notNull(),      // FK to kioskMachines.kioskId
  stationCode: varchar("station_code"),             // human-readable, e.g. K9000-TLV-001

  // Physical side
  side: varchar("side", { length: 5 }).notNull(),  // "left" | "right"
  bayLabel: varchar("bay_label", { length: 50 }),  // e.g. "Bay 1 (Left)"
  bayLabelHe: varchar("bay_label_he", { length: 50 }), // Hebrew label

  // Hardware IDs — each bay has its own readers
  nayaxTerminalId: varchar("nayax_terminal_id"),   // Nayax card reader terminal ID for THIS bay
  nayaxQrReaderId: varchar("nayax_qr_reader_id"),  // Nayax DOT QR reader ID for THIS bay

  // Real-time status — NO booking state, only live readiness
  // ready       = tub is empty, hardware OK, customer can use now
  // busy        = wash session in progress (currentSessionId is set)
  // cleanup     = paid time ended, 30-sec complimentary tub-clean window (still unavailable)
  // fault       = hardware error, needs attention
  // maintenance = intentionally taken offline by staff
  // offline     = no power / no connectivity
  status: varchar("status", { length: 20 }).notNull().default("ready"),

  // Active session (null when bay is ready)
  currentSessionId: varchar("current_session_id"), // FK to bay_sessions.id, null when free

  // Telemetry snapshot (last push from IoT controller)
  lastHeartbeat: timestamp("last_heartbeat"),
  waterTempC: decimal("water_temp_c", { precision: 5, scale: 2 }),
  shampooLevelPct: integer("shampoo_level_pct"),    // 0–100
  conditionerLevelPct: integer("conditioner_level_pct"),
  lastFaultCode: varchar("last_fault_code"),
  lastFaultAt: timestamp("last_fault_at"),

  // Stats
  totalSessions: integer("total_sessions").default(0),
  totalRevenueCents: integer("total_revenue_cents").default(0),
  lastSessionAt: timestamp("last_session_at"),

  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bay_station").on(table.stationId),
  index("idx_bay_status").on(table.status),
  index("idx_bay_side").on(table.side),
  index("idx_bay_terminal").on(table.nayaxTerminalId),
  index("idx_bay_qr_reader").on(table.nayaxQrReaderId),
  // Unique: only one bay per side per station
  uniqueIndex("uq_station_side").on(table.stationId, table.side),
]);

export type StationBay = typeof stationBays.$inferSelect;
export type InsertStationBay = typeof stationBays.$inferInsert;
export const insertStationBaySchema = createInsertSchema(stationBays).omit({ id: true, createdAt: true, updatedAt: true });

// ─────────────────────────────────────────────────────────────────────────────
// BAY SESSIONS — one row per wash session, scoped to a specific bay
//
// Created when a customer activates a wash (card OR wallet QR).
// Closed when the wash completes or times out.
// There is NO booking or reservation. Sessions are always live events.
//
// Source discrimination (maps to k9000_wash_events.redemption_source):
//   terminal_card    → direct Nayax card/NFC payment (Flow A)
//   wash_package     → prepaid wash-package credit (Flow B)
//   wallet_balance   → cash wallet ILS deduction (Flow B)
//   gift_credit      → eGift balance (Flow B)
//   loyalty_benefit  → loyalty-tier free wash (Flow B)
//   promo_coupon     → promotional/coupon credit (Flow B)
// ─────────────────────────────────────────────────────────────────────────────
export const baySessions = pgTable("bay_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Location — always tied to a specific bay at a specific station
  bayId: varchar("bay_id").notNull(),              // FK to station_bays.id
  stationId: varchar("station_id").notNull(),      // denormalized for fast queries
  side: varchar("side", { length: 5 }).notNull(), // "left" | "right" — denormalized

  // Customer — null for anonymous terminal-card payments
  userId: varchar("user_id"),                      // FK to users.id, nullable
  isAnonymous: boolean("is_anonymous").default(false),

  // Payment source — how this session was initiated
  // terminal_card | wash_package | wallet_balance | gift_credit | loyalty_benefit | promo_coupon
  source: varchar("source", { length: 30 }).notNull(),

  // Financial
  amountCents: integer("amount_cents").default(0), // in agorot (ILS cents)
  currency: varchar("currency", { length: 3 }).default("ILS"),

  // Nayax references (populated for terminal_card sessions)
  nayaxTransactionId: varchar("nayax_transaction_id"),
  nayaxTerminalId: varchar("nayax_terminal_id"),

  // Wash program selected by customer
  washProgram: varchar("wash_program", { length: 30 }), // basic | standard | premium | deluxe

  // Session lifecycle
  // pending     = payment/redemption accepted, waiting for IoT start confirmation
  // active      = wash in progress (IoT confirmed start)
  // cleanup     = paid time ended; 30-sec complimentary tub-clean window; bay still busy
  // completed   = cleanup window elapsed; session fully closed; bay ready for next user
  // timed_out   = no IoT confirmation within timeout window
  // aborted     = customer / staff cancelled mid-session
  // fault       = hardware fault during wash
  //
  // Normal lifecycle: pending → active → cleanup → completed
  // Failure paths:    pending → timed_out | aborted
  //                   active  → fault | aborted
  //                   cleanup → completed (always; cleanup does not fail financially)
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  startedAt: timestamp("started_at").defaultNow(),
  activatedAt: timestamp("activated_at"),          // when IoT confirmed start
  endedAt: timestamp("ended_at"),                  // set when cleanup completes (NOT when paid time ends)
  expectedDurationSeconds: integer("expected_duration_seconds"),
  actualDurationSeconds: integer("actual_duration_seconds"), // paid wash time only; excludes cleanup

  // Complimentary tub-clean window (K9000 operator manual: "GRACE TIME" / "30 secs free disinfect")
  // Bay stays busy during this window; no financial charge; not billable duration.
  complimentaryCleanupSeconds: integer("complimentary_cleanup_seconds").default(30),
  cleanupStartedAt: timestamp("cleanup_started_at"),   // when paid time ended and cleanup began
  cleanupEndsAt:    timestamp("cleanup_ends_at"),       // cleanupStartedAt + complimentaryCleanupSeconds

  // Cross-references
  washEventId: varchar("wash_event_id"),           // FK to k9000_wash_events.id
  correlationId: varchar("correlation_id"),        // tracing across logs

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_baysession_bay").on(table.bayId),
  index("idx_baysession_station").on(table.stationId),
  index("idx_baysession_user").on(table.userId),
  index("idx_baysession_status").on(table.status),
  index("idx_baysession_source").on(table.source),
  index("idx_baysession_started").on(table.startedAt),
]);

export type BaySession = typeof baySessions.$inferSelect;
export type InsertBaySession = typeof baySessions.$inferInsert;
export const insertBaySessionSchema = createInsertSchema(baySessions).omit({ id: true, createdAt: true, updatedAt: true });

// ─────────────────────────────────────────────────────────────────────────────
// BAY READERS — one row per physical reader attached to a bay
//
// Each K9000 bay has exactly two readers:
//   card_reader  → Nayax yellow card/NFC terminal
//   qr_reader    → Nayax DOT black QR scanner
//
// This table allows a reader to be remapped (e.g. hardware replacement)
// without touching the stationBays row. Also used for fault attribution:
// a fault can be pinned to a specific reader, not just "the bay".
// ─────────────────────────────────────────────────────────────────────────────
export const bayReaders = pgTable("bay_readers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  bayId:     varchar("bay_id").notNull(),       // FK → station_bays.id
  stationId: varchar("station_id").notNull(),   // denormalized for fast queries
  side:      varchar("side", { length: 5 }).notNull(), // "left" | "right"

  // Reader type — one reader per type per bay
  readerType: varchar("reader_type", { length: 20 }).notNull(), // "card_reader" | "qr_reader"

  // Nayax hardware identifiers
  nayaxDeviceId:  varchar("nayax_device_id"),   // Nayax device ID / serial
  nayaxTerminalId: varchar("nayax_terminal_id"),// Nayax terminal ID (card readers)

  // Operational state
  // online   = reachable and responding
  // offline  = no heartbeat within threshold
  // fault    = hardware error reported
  // replaced = decommissioned, superseded by a new row
  status: varchar("status", { length: 20 }).notNull().default("online"),

  lastHeartbeat: timestamp("last_heartbeat"),
  lastFaultCode: varchar("last_fault_code"),
  lastFaultAt:   timestamp("last_fault_at"),

  isActive:  boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reader_bay").on(table.bayId),
  index("idx_reader_station").on(table.stationId),
  index("idx_reader_type").on(table.readerType),
  index("idx_reader_nayax_device").on(table.nayaxDeviceId),
  // Each bay has exactly one reader of each type
  uniqueIndex("uq_bay_reader_type").on(table.bayId, table.readerType),
]);

export type BayReader = typeof bayReaders.$inferSelect;
export type InsertBayReader = typeof bayReaders.$inferInsert;
export const insertBayReaderSchema = createInsertSchema(bayReaders).omit({ id: true, createdAt: true, updatedAt: true });

// ─────────────────────────────────────────────────────────────────────────────
// BAY FAULTS — hardware fault log, one row per fault event
//
// Faults are raised by IoT telemetry (POST /api/k9000/telemetry) or by the
// Nayax webhook. Each fault is associated with a specific bay and optionally
// with the specific reader that reported it.
//
// A fault blocks the bay (status → "fault") until it is resolved.
// Resolution can be manual (staff) or automatic (self-heal on next heartbeat).
// ─────────────────────────────────────────────────────────────────────────────
export const bayFaults = pgTable("bay_faults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  bayId:     varchar("bay_id").notNull(),       // FK → station_bays.id
  stationId: varchar("station_id").notNull(),   // denormalized
  side:      varchar("side", { length: 5 }).notNull(), // "left" | "right"

  // Fault details
  faultCode:        varchar("fault_code", { length: 50 }).notNull(), // e.g. "E04_WATER_LOW"
  severity:         varchar("severity", { length: 10 }).notNull().default("error"), // "warning" | "error" | "critical"
  description:      text("description"),
  descriptionHe:    text("description_he"),

  // Reader that raised the fault, if applicable
  readerId:      varchar("reader_id"),          // FK → bay_readers.id, nullable
  readerType:    varchar("reader_type", { length: 20 }), // "card_reader" | "qr_reader"

  // Session that was in progress when the fault occurred, if any
  sessionId:     varchar("session_id"),         // FK → bay_sessions.id, nullable

  // Raw telemetry payload from IoT
  rawPayload: text("raw_payload"),              // JSON string from IoT controller

  // Resolution
  // open      = active, bay is blocked
  // resolved  = manually cleared by staff
  // auto_healed = resolved automatically by next heartbeat
  status: varchar("status", { length: 20 }).notNull().default("open"),
  resolvedAt:   timestamp("resolved_at"),
  resolvedBy:   varchar("resolved_by"),         // staff userId or "system"
  resolutionNote: text("resolution_note"),

  reportedAt: timestamp("reported_at").defaultNow(),
  createdAt:  timestamp("created_at").defaultNow(),
  updatedAt:  timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fault_bay").on(table.bayId),
  index("idx_fault_station").on(table.stationId),
  index("idx_fault_status").on(table.status),
  index("idx_fault_severity").on(table.severity),
  index("idx_fault_reported").on(table.reportedAt),
]);

export type BayFault = typeof bayFaults.$inferSelect;
export type InsertBayFault = typeof bayFaults.$inferInsert;
export const insertBayFaultSchema = createInsertSchema(bayFaults).omit({ id: true, createdAt: true, updatedAt: true });

// ─────────────────────────────────────────────────────────────────────────────
// BAY EVENTS — operational event log, one row per event per bay
//
// Immutable append-only log. Used for:
//   - Session lifecycle events (session_started, session_completed, etc.)
//   - Reader events (qr_scanned, card_swiped)
//   - Fault events (fault_raised, fault_resolved)
//   - Maintenance events (maintenance_start, maintenance_end)
//   - Telemetry snapshots (heartbeat)
//
// These are distinct from bay_sessions (sessions are per-wash lifecycle)
// and bay_faults (faults are unresolved states). Events are the audit trail.
// ─────────────────────────────────────────────────────────────────────────────
export const bayEvents = pgTable("bay_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  bayId:     varchar("bay_id").notNull(),       // FK → station_bays.id
  stationId: varchar("station_id").notNull(),   // denormalized
  side:      varchar("side", { length: 5 }).notNull(), // "left" | "right"

  // Event classification
  eventType: varchar("event_type", { length: 50 }).notNull(),
  // session_started | session_completed | session_timed_out | session_aborted
  // qr_scanned | card_swiped | card_declined
  // fault_raised | fault_resolved | fault_auto_healed
  // maintenance_start | maintenance_end
  // heartbeat | telemetry_update
  // bay_opened | bay_closed (physical door / panel)

  // Related records (nullable — depends on event type)
  sessionId:     varchar("session_id"),         // FK → bay_sessions.id
  faultId:       varchar("fault_id"),           // FK → bay_faults.id
  readerId:      varchar("reader_id"),          // FK → bay_readers.id
  userId:        varchar("user_id"),            // customer or staff

  // Source of the event
  // iot_controller | nayax_webhook | petwash_server | staff_panel
  source: varchar("source", { length: 30 }).notNull().default("petwash_server"),

  // Payload — arbitrary JSON from the event source
  metadata: text("metadata"),                  // JSON string

  occurredAt: timestamp("occurred_at").defaultNow(),
  createdAt:  timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bayevent_bay").on(table.bayId),
  index("idx_bayevent_station").on(table.stationId),
  index("idx_bayevent_type").on(table.eventType),
  index("idx_bayevent_session").on(table.sessionId),
  index("idx_bayevent_occurred").on(table.occurredAt),
]);

export type BayEvent = typeof bayEvents.$inferSelect;
export type InsertBayEvent = typeof bayEvents.$inferInsert;
export const insertBayEventSchema = createInsertSchema(bayEvents).omit({ id: true, createdAt: true });

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

// Financial Documents types
export type FinancialDocument = typeof financialDocuments.$inferSelect;
export type InsertFinancialDocument = typeof financialDocuments.$inferInsert;

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

// Sitter Profiles (Marketplace Providers) - DEEP ONBOARDING MARKETPLACE PLATFORM
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
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): canonical
  // citySymbol from shared/data/israel-cities.ts. Nullable
  // until Phase-3 UI cutover writes it alongside the legacy
  // city varchar. No reader trusts this column yet.
  citySymbol: varchar("city_symbol", { length: 20 }),
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
  
  // Health & Safety (marketplace platform host details)
  personalAllergies: text("personal_allergies"), // Sitter's own allergies (e.g., to certain pet foods)
  smokingStatus: varchar("smoking_status"), // non_smoker | smoker | outdoor_only
  hasOtherPets: boolean("has_other_pets").default(false),
  otherPetsDetails: text("other_pets_details"), // If they have their own pets at home
  
  // Home Environment (For boarding services)
  homeType: varchar("home_type"), // apartment | house | studio | farm
  yardSize: varchar("yard_size"), // none | small | medium | large
  homePhotos: text("home_photos").array(), // URLs to home environment photos
  
  // Pricing & Services - Flexible Provider Pricing
  pricePerDayCents: integer("price_per_day_cents").notNull(), // Base price in cents (full 24h day)
  pricePerHourCents: integer("price_per_hour_cents"), // Hourly rate (optional)
  minimumHours: integer("minimum_hours").default(2), // Minimum booking hours
  minimumDays: integer("minimum_days").default(1), // Minimum booking days for overnight
  
  // Package Pricing (day/night bundles)
  pricingPackages: jsonb("pricing_packages").$type<Array<{
    id: string; // Unique package ID
    name: string; // "יום שלם", "לילה שלם", "סוף שבוע"
    nameEn?: string; // "Full Day", "Overnight", "Weekend"
    durationHours: number; // Duration in hours (24 = full day, 12 = half day, etc.)
    priceCents: number; // Package price in cents
    description?: string; // Package details
    isPopular?: boolean; // Highlight as popular option
  }>>(),
  
  // Duration-Based Discount Tiers (longer = cheaper)
  discountTiers: jsonb("discount_tiers").$type<{
    weeklyDiscountPercent: number; // e.g., 10 = 10% off for 7+ days
    biweeklyDiscountPercent: number; // e.g., 15 = 15% off for 14+ days
    monthlyDiscountPercent: number; // e.g., 25 = 25% off for 30+ days
    customTiers?: Array<{
      minDays: number;
      discountPercent: number;
      label?: string; // "הנחת שבוע", "חבילת חודש"
    }>;
  }>(),
  
  // Extra Services (add-ons with additional fees)
  extraServices: jsonb("extra_services").$type<Array<{
    id: string;
    name: string; // "הזנת תרופות", "טיפול מיוחד", "לינה בחדר נפרד"
    nameEn?: string;
    priceCents: number; // Additional fee
    description?: string;
  }>>(),
  
  // Provider Verification Level (Bronze/Silver/Gold)
  verificationLevel: varchar("verification_level").default("pending"), // pending | bronze | silver | gold
  verificationBadges: text("verification_badges").array(), // ["identity_verified", "background_checked", "insurance_active"]
  
  // Insurance & Liability
  hasLiabilityInsurance: boolean("has_liability_insurance").default(false),
  insurancePolicyNumber: varchar("insurance_policy_number"),
  insuranceProvider: varchar("insurance_provider"), // Harel, Menora, Clal, etc.
  insuranceExpiryDate: date("insurance_expiry_date"),
  maxCoverageAmountCents: integer("max_coverage_amount_cents"), // Policy limit
  
  serviceTypes: text("service_types").array(), // ["boarding", "daycare", "drop_in", "walking"]
  
  // Availability Calendar (marketplace platform calendar)
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
  
  // House Policies & Rules (marketplace-style)
  housePolicies: jsonb("house_policies").$type<{
    maxPetsAtOnce: number;
    acceptsUnvaccinatedPets: boolean;
    acceptsPuppies: boolean; // Under 6 months
    acceptsSeniorPets: boolean; // Over 10 years
    acceptsSpecialNeeds: boolean;
    cancellationPolicy: 'flexible' | 'moderate' | 'strict'; // marketplace platform
    additionalRules: string[];
  }>(),
  
  // PROPERTY DETAILS (marketplace platform-Level Discretion)
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
  
  // ENTRY INSTRUCTIONS (marketplace platform Check-In Details)
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
  
  // HOUSE MANUAL (marketplace platform Guidebook)
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
  selfiePhotoUrl: varchar("selfie_photo_url"), // Current selfie with clear face (uploaded during KYC)
  idPhotoUrl: varchar("id_photo_url"), // Government ID photo (uploaded during KYC)
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
}, (table) => [
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): symbol-
  // backed lookup index. Legacy `city` column still indexed
  // implicitly via marketplace ilike scans; this index serves
  // the Phase-4 read-switch.
  index("idx_sitter_profiles_city_symbol").on(table.citySymbol),
]);

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
  platformServiceFeeCents: integer("platform_service_fee_cents").notNull(), // 15% platform commission
  brokerCutCents: integer("broker_cut_cents").notNull(), // 15% platform commission (same as service fee)
  sitterPayoutCents: integer("sitter_payout_cents").notNull(), // 85% of base (100% - 15%)
  totalChargeCents: integer("total_charge_cents").notNull(), // base + platform fee
  
  // Payment Integration (NAYAX ONLY - Like marketplace platform)
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

  // Address snapshot (coordinates are the truth — never postcode)
  serviceAddressText: text("service_address_text"),
  serviceAddressLat: decimal("service_address_lat", { precision: 10, scale: 7 }),
  serviceAddressLng: decimal("service_address_lng", { precision: 10, scale: 7 }),

  // Provider Reassignment (booking-expiry poller)
  reassignmentCount: integer("reassignment_count").default(0),
  previousProviders: text("previous_providers").array(),
  lastReassignedAt: timestamp("last_reassigned_at"),
});

// Sitter Reviews (on-demand)
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
  updatedAt: true,
  selfiePhotoUrl: true,
  idPhotoUrl: true,
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
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): canonical
  // citySymbol from shared/data/israel-cities.ts. Nullable
  // until Phase-3 UI cutover writes it alongside the legacy
  // city varchar. No reader trusts this column yet.
  citySymbol: varchar("city_symbol", { length: 20 }),
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
  
  // Pricing - Flexible Provider Pricing
  baseHourlyRate: decimal("base_hourly_rate", { precision: 10, scale: 2 }).notNull(), // Walker sets their rate
  minimumMinutes: integer("minimum_minutes").default(30), // Minimum walk duration
  currency: varchar("currency").default("ILS"), // ILS, USD, GBP, AUD, CAD
  
  // Package Pricing (bundle walks)
  walkPackages: jsonb("walk_packages").$type<Array<{
    id: string;
    name: string; // "טיול קצר", "טיול ארוך", "חבילה שבועית"
    nameEn?: string;
    durationMinutes: number;
    priceCents: number;
    description?: string;
    isPopular?: boolean;
  }>>(),
  
  // Extra Services (add-ons)
  extraServices: jsonb("extra_services").$type<Array<{
    id: string;
    name: string; // "אימון בסיסי", "משחקים בפארק", "צילומים"
    nameEn?: string;
    priceCents: number;
    description?: string;
  }>>(),
  
  // Availability
  isAvailable: boolean("is_available").default(true),
  maxDailyWalks: integer("max_daily_walks").default(5),
  
  // Banking (for payouts - Nayax Israel ONLY)
  bankAccountVerified: boolean("bank_account_verified").default(false),
  nayaxPayoutAccountId: varchar("nayax_payout_account_id"), // Nayax payout account
  
  // Platform Commission (flat 15% across all platforms)
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("15.00"), // 15% platform commission
  
  // Status
  isActive: boolean("is_active").default(true),
  suspensionReason: text("suspension_reason"),
  suspendedUntil: timestamp("suspended_until"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): symbol-
  // backed lookup index. Marketplace + booking-search reads
  // keep using the legacy `city` column until Phase 4.
  index("idx_walker_profiles_city_symbol").on(table.citySymbol),
]);

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
  platformFeeOwner: decimal("platform_fee_owner", { precision: 10, scale: 2 }).notNull(), // 15% platform commission
  platformFeeSitter: decimal("platform_fee_sitter", { precision: 10, scale: 2 }).notNull(), // 15% platform commission
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(), // What owner pays
  walkerPayout: decimal("walker_payout", { precision: 10, scale: 2 }).notNull(), // What walker receives (85%)
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
  
  // Bathroom Markers (Pet Wash™ pee/poo flags)
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
  
  // Emergency/ASAP Walk Features (Pet Wash™ "Book Now" model)
  isEmergencyWalk: boolean("is_emergency_walk").default(false), // ASAP booking with 90-min arrival
  emergencySurgeMultiplier: decimal("emergency_surge_multiplier", { precision: 3, scale: 2 }), // 1.0 = no surge, 1.5 = 50% increase, 2.0 = double
  emergencySurgeReason: text("emergency_surge_reason"), // High demand, Peak hours, etc.

  // Provider Reassignment (booking-expiry poller)
  reassignmentCount: integer("reassignment_count").default(0),     // How many times reassigned
  previousProviders: text("previous_providers").array(),           // walkerId[] already attempted
  lastReassignedAt: timestamp("last_reassigned_at"),

  // Payment session linkage — correlates a Nayax payment session with this booking.
  // Populated by the Nayax webhook once payment is confirmed.
  paymentSessionId: varchar("payment_session_id", { length: 128 }),

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

// =================== PROVIDER ONBOARDING SYSTEM (ON-DEMAND) ===================
// Invite codes and KYC verification for walkers, sitters, and station operators

// PROVIDER INVITE CODES (on-demand model driver codes)
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

  // Israel-safe self-declaration (2026 spec). See migration 0019 and
  // shared/legal/providerDeclaration.ts. Police clearance is OPTIONAL
  // unless requires_enhanced_verification is true (driver, sitter,
  // home-access, key-holding, overnight, or pet-transport services).
  selfDeclarationNoRelevantConvictions: boolean("self_declaration_no_relevant_convictions").notNull().default(false),
  selfDeclarationAt: timestamp("self_declaration_at"),
  selfDeclarationIp: varchar("self_declaration_ip", { length: 64 }),
  requiresEnhancedVerification: boolean("requires_enhanced_verification").notNull().default(false),
  enhancedVerificationReasons: text("enhanced_verification_reasons").array().notNull().default(sql`ARRAY[]::text[]`),
  
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
  status: varchar("status").default("draft"), // draft | pending_review | under_review | approved | rejected | withdrawn
  onboardingStep: integer("onboarding_step").default(0),
  onboardingComplete: boolean("onboarding_complete").default(false),
  submittedAt: timestamp("submitted_at"),
  reviewedBy: varchar("reviewed_by"), // Admin user ID
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  // KYC2026 Queryable Fields (promoted from backgroundCheckNotes for admin filtering + analytics)
  kycDocumentType: varchar("kyc_document_type"), // passport | national_id | drivers_license | disability_certificate | retirement_certificate
  kycIdLastFour: varchar("kyc_id_last_four", { length: 4 }), // last 4 digits of document number (redacted)
  kycOcrConfidence: decimal("kyc_ocr_confidence", { precision: 5, scale: 2 }), // 0-100 OCR text confidence
  kycLivenessScore: decimal("kyc_liveness_score", { precision: 5, scale: 2 }), // 0-100 heuristic liveness confidence
  kycDecisionFlags: text("kyc_decision_flags"), // JSON array — flags that forced pending_review (e.g. ["ocr_name_missing","expiry_missing"])
  kycFraudRiskLevel: varchar("kyc_fraud_risk_level", { length: 20 }), // low | medium | high | critical

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

// =================== PROVIDER INTAKE QUEUE (Google Forms Integration) ===================
// Management-assisted provider onboarding via Google Forms with manual approval workflow

export const providerIntakeQueue = pgTable("provider_intake_queue", {
  id: serial("id").primaryKey(),
  intakeId: varchar("intake_id").unique().notNull(), // INT-YYYY-NNNNNN
  
  // Google Forms Sync
  googleFormResponseId: varchar("google_form_response_id").unique(), // Google Forms response ID
  googleSheetRowNumber: integer("google_sheet_row_number"), // Row number in source sheet
  syncedFromSheetId: varchar("synced_from_sheet_id"), // Google Sheet ID
  syncedAt: timestamp("synced_at"), // When data was pulled from Google Forms
  
  // Applicant Info (from Google Form)
  email: varchar("email").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  
  // Provider Type (legacy single type)
  providerType: varchar("provider_type").notNull(), // walker | sitter | station_operator | driver | groomer | trainer
  
  // Multi-Platform Selection (Pet Wash™ marketplace)
  selectedPlatforms: text("selected_platforms").array().default([]), // ["sitter_suite", "walk_my_pet", ...]
  
  // Intended Pricing (provider's desired rates)
  intendedPricing: jsonb("intended_pricing").default(sql`'{}'::jsonb`), // {platform: {baseRate, multiPetRate, addons}}
  
  // Location
  city: varchar("city"),
  country: varchar("country").default("IL"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  
  // Experience & Qualifications (from form)
  yearsExperience: integer("years_experience"),
  hasOwnTransport: boolean("has_own_transport").default(false),
  hasPetFirstAid: boolean("has_pet_first_aid").default(false),
  hasInsurance: boolean("has_insurance").default(false),
  
  // Availability
  availabilityNotes: text("availability_notes"),
  preferredWorkingDays: text("preferred_working_days").array(), // ["sunday", "monday", ...]
  preferredHours: varchar("preferred_hours"), // e.g., "morning", "evening", "flexible"
  
  // About
  aboutMe: text("about_me"), // Free text intro
  whyJoinPetWash: text("why_join_pet_wash"), // Motivation
  referralSource: varchar("referral_source"), // facebook, friend, google, etc.
  
  // Resume/CV (Google Drive link from form)
  resumeUrl: varchar("resume_url"),
  portfolioUrl: varchar("portfolio_url"),
  linkedInUrl: varchar("linkedin_url"),
  
  // Public Profile Photo (chosen by applicant for their marketplace profile)
  profilePhotoUrl: text("profile_photo_url"), // Base64 or cloud URL
  
  // Management Review Status
  status: varchar("status").default("new"), // new | reviewing | approved | rejected | invited | converted
  reviewedBy: varchar("reviewed_by"), // Admin user ID
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"), // Internal notes from management
  rejectionReason: text("rejection_reason"),
  
  // Invite Generation (after approval)
  generatedInviteCode: varchar("generated_invite_code").references(() => providerInviteCodes.inviteCode),
  inviteSentAt: timestamp("invite_sent_at"),
  inviteSentVia: varchar("invite_sent_via"), // email | whatsapp | sms
  
  // Conversion Tracking
  convertedToApplicationId: varchar("converted_to_application_id").references(() => providerApplications.applicationId),
  convertedAt: timestamp("converted_at"),
  
  // Backup Info
  backupDriveFileId: varchar("backup_drive_file_id"), // Archived to Google Drive
  backupSheetRowRef: varchar("backup_sheet_row_ref"), // Reference in backup sheet
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProviderIntakeQueueSchema = createInsertSchema(providerIntakeQueue).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertProviderIntakeQueue = z.infer<typeof insertProviderIntakeQueueSchema>;
export type ProviderIntakeQueue = typeof providerIntakeQueue.$inferSelect;

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
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }), // 15% platform commission
  driverPayout: decimal("driver_payout", { precision: 10, scale: 2 }), // 85% driver payout
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
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): canonical
  // array of citySymbols from shared/data/israel-cities.ts.
  // Trainers serve multiple cities; the free-text `service_area`
  // string above stays the legacy authority until Phase-4 read
  // switch. Defaults to '{}' so existing INSERTs continue to
  // work without supplying this column.
  serviceCitySymbols: text("service_city_symbols").array().notNull().default(sql`ARRAY[]::text[]`),
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
  
  // Financial (Payout System - 85% trainer, 15% platform commission)
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("15.00"), // Platform commission %
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
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): symbol
  // array index. The actual SQL migration creates this as a
  // GIN index (USING GIN) — Drizzle's `index().on()` declares
  // the name; the migration file controls the index method.
  serviceCitySymbolsIdx: index("idx_trainers_service_city_symbols").on(table.serviceCitySymbols),
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
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 15% platform commission
  trainerPayout: decimal("trainer_payout", { precision: 10, scale: 2 }).notNull(), // 85% to trainer
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
  
  // Wallet Hold/Release/Debit/Refund Lifecycle (Phase 2.2)
  walletHoldCents:     integer("wallet_hold_cents").notNull().default(0),
  walletDebitedCents:  integer("wallet_debited_cents").notNull().default(0),
  walletRefundedCents: integer("wallet_refunded_cents").notNull().default(0),
  walletHoldKey:       varchar("wallet_hold_key", { length: 200 }),
  walletDebitKey:      varchar("wallet_debit_key", { length: 200 }),
  walletReleaseKey:    varchar("wallet_release_key", { length: 200 }),
  walletRefundKey:     varchar("wallet_refund_key", { length: 200 }),
  financeState:        varchar("finance_state", { length: 30 }).notNull().default("none"),

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
// Modeled on industry-standard marketplace best practices
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
  membershipNumber: varchar("membership_number", { length: 20 }).unique(), // PWS-XXXXXXX
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

// =================== JOB DISPATCH SYSTEM (ON-DEMAND) ===================

export const jobOffers = pgTable("job_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(), // Reference to booking in Firestore
  platform: varchar("platform", { length: 50 }).notNull(), // sitter-suite, walk-my-pet, pettrek
  
  // Operator Assignment
  operatorId: varchar("operator_id"), // Firebase UID of assigned operator
  operatorName: varchar("operator_name"),
  customerId: varchar("customer_id").notNull(), // Firebase UID of customer
  customerName: varchar("customer_name"),
  
  // Job Status (on-demand flow)
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
  
  // SLA Timestamps (marketplace platform/on-demand platform-level tracking)
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
  
  // Payment Authorization
  paymentIntentId: varchar("payment_intent_id"),

  // Dispatch Wave Tracking (Adaptive Radius - DB-backed)
  dispatchWave: integer("dispatch_wave").default(0),
  dispatchRadiusKm: integer("dispatch_radius_km"),
  offerExpiresAt: timestamp("offer_expires_at"),
  nextWaveAt: timestamp("next_wave_at"),
  dispatchLeasedUntil: timestamp("dispatch_leased_until"),
  offeredOperatorIds: jsonb("offered_operator_ids").$type<string[]>(),

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
  
  // Smart Ranking Fields (Phase 1 Dispatch 2026)
  ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).default("5.00"),
  acceptanceRate: decimal("acceptance_rate", { precision: 5, scale: 2 }).default("100.00"),
  completedJobs30d: integer("completed_jobs_30d").default(0),
  premiumBadge: boolean("premium_badge").default(false),
  subscriptionActive: boolean("subscription_active").default(false),
  cooldownUntil: timestamp("cooldown_until"),
  recentRejects: integer("recent_rejects").default(0),
  recentIgnores: integer("recent_ignores").default(0),
  serviceTypes: jsonb("service_types").$type<string[]>(),

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

// ===== PET TEMPERAMENT ENUM (privacy-safe, staff-friendly labels) =====
// Do NOT use "aggressive" or other stigmatising terms.
// Values are chosen to inform staff without publicly labelling the animal.
export const petTemperamentEnum = pgEnum("pet_temperament", [
  "calm",
  "nervous",
  "high_energy",
  "needs_careful_handling",
  "staff_assistance_recommended",
]);

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
  // Photo upload is optional — no facial/AI recognition is implied or performed.
  photoUrl: varchar("photo_url"),

  // ── MEDICAL DATA — private by default, shared only with explicit consent ──
  // These fields MUST NOT appear in any public API response.
  // Set medicalShareConsent=true before exposing to any third party or service provider.
  skinSensitivity: text("skin_sensitivity"),           // e.g. "sensitive to chlorine"
  allergies: text("allergies"),
  medications: text("medications"),
  specialNeeds: text("special_needs"),
  vetName: varchar("vet_name"),
  vetPhone: varchar("vet_phone"),
  vaccinationStatus: varchar("vaccination_status").default("unknown"),
  lastVaccinationDate: date("last_vaccination_date"),
  nextVaccinationDate: date("next_vaccination_date"),
  // true = medical fields above are private and must not be exposed (default safe)
  medicalDataPrivate: boolean("medical_data_private").default(true).notNull(),
  // true = owner has explicitly consented to share medical data with service providers
  medicalShareConsent: boolean("medical_share_consent").default(false).notNull(),
  // ISO timestamp of last consent change for audit trail
  medicalConsentUpdatedAt: timestamp("medical_consent_updated_at"),

  // Temperament — use enum only; no free-text "aggressive" labelling
  temperament: petTemperamentEnum("temperament"),
  goodWithKids: boolean("good_with_kids"),
  goodWithDogs: boolean("good_with_dogs"),
  goodWithCats: boolean("good_with_cats"),
  notes: text("notes"),
  lastWashDate: timestamp("last_wash_date"),
  lastWalkDate: timestamp("last_walk_date"),
  lastGroomDate: timestamp("last_groom_date"),
  // Archived original free-text temperament value (populated by migration 0018).
  // Never expose this field in public API responses.
  temperamentArchived: text("temperament_archived"),
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
  kycStatus: varchar("kyc_status", { length: 30 }),
  kycVerifiedAt: timestamp("kyc_verified_at"),
  kycVerificationMethod: varchar("kyc_verification_method", { length: 30 }),
  kycDocumentType: varchar("kyc_document_type", { length: 60 }),
  kycDocumentCountry: varchar("kyc_document_country", { length: 10 }),
  kycDocumentExpiry: date("kyc_document_expiry"),
  kycFaceMatchResult: varchar("kyc_face_match_result", { length: 20 }),
  kycReviewReason: text("kyc_review_reason"),
  kycManualReviewerId: varchar("kyc_manual_reviewer_id", { length: 128 }),
  kycDeletionCompletedAt: timestamp("kyc_deletion_completed_at"),
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

// ===== FRANCHISE OWNERS TABLE =====
export const franchiseOwners = pgTable("franchise_owners", {
  id: serial("id").primaryKey(),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  businessName: varchar("business_name").notNull(),
  contractStart: timestamp("contract_start"),
  contractEnd: timestamp("contract_end"),
  platformFeeOverridePct: decimal("platform_fee_override_pct", { precision: 5, scale: 2 }),
  status: varchar("status").notNull().default("active"), // CHECK: active | suspended | terminated
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  ownerUserIdx: index("franchise_owner_user_idx").on(table.ownerUserId),
  statusIdx: index("franchise_owner_status_idx").on(table.status),
}));

export const insertFranchiseOwnerSchema = createInsertSchema(franchiseOwners).omit({ id: true, createdAt: true });
export type InsertFranchiseOwner = z.infer<typeof insertFranchiseOwnerSchema>;
export type FranchiseOwner = typeof franchiseOwners.$inferSelect;

// ===== STATIONS TABLE =====
export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  stationCode: varchar("station_code").notNull().unique(),
  locationId: integer("location_id").references(() => locations.id).notNull(),
  franchiseId: integer("franchise_id").references(() => franchiseOwners.id),
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
  // ── Phase 11 Extension: Hybrid Ownership Model ───────────────────────────
  ownershipType: varchar("ownership_type", { length: 20 }).notNull().default("franchise"),
  // 'franchise' = operated by an external franchise owner (franchise_id must be set)
  // 'company'   = owned directly by Pet Wash Ltd (franchise_id must be NULL;
  //               settlement franchise_amount is always 0)
  // ── Phase 10 T23: performance / ranking (null = not yet computed) ──────────
  trustScore: integer("trust_score"),          // 0-100 composite quality score
  rankingScore: integer("ranking_score"),       // 0-100 final display rank
  rankingUpdatedAt: timestamp("ranking_updated_at"),
  // ── Phase 10 T25: capacity & operational tracking ─────────────────────────
  dailyCapacity: integer("daily_capacity").default(20),      // max bookings per day; default 20
  currentDayBookings: integer("current_day_bookings").default(0), // cached counter for today (reset daily)
  equipmentStatus: varchar("equipment_status").default("operational"), // operational | degraded | offline
  nextDowntimeStart: timestamp("next_downtime_start"),         // nullable: planned downtime window start
  nextDowntimeEnd: timestamp("next_downtime_end"),             // nullable: planned downtime window end
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("station_status_idx").on(table.status),
  locationIdx: index("station_location_idx").on(table.locationId),
  franchiseIdx: index("station_franchise_idx").on(table.franchiseId),
}));

// ===== STATION OPERATORS TABLE =====
export const stationOperators = pgTable("station_operators", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").notNull().references(() => stations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").notNull().default("worker"), // CHECK: owner | manager | worker
  isActive: boolean("is_active").notNull().default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
}, (table) => ({
  stationUserUnique: uniqueIndex("station_operator_unique").on(table.stationId, table.userId),
  stationIdx: index("station_operator_station_idx").on(table.stationId),
  userIdx: index("station_operator_user_idx").on(table.userId),
  roleIdx: index("station_operator_role_idx").on(table.role),
}));

export const insertStationOperatorSchema = createInsertSchema(stationOperators).omit({ id: true, assignedAt: true });
export type InsertStationOperator = z.infer<typeof insertStationOperatorSchema>;
export type StationOperator = typeof stationOperators.$inferSelect;

// ===== STATION DOWNTIME TABLE (Phase 10 T25) =====
export const stationDowntime = pgTable("station_downtime", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").notNull().references(() => stations.id),
  reason: text("reason").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),                          // null = open-ended / still active
  reportedBy: varchar("reported_by").references(() => users.id), // uid of reporter
  resolvedAt: timestamp("resolved_at"),               // null = not yet resolved
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  stationIdx: index("station_downtime_station_idx").on(table.stationId),
  startAtIdx: index("station_downtime_start_idx").on(table.startAt),
  resolvedIdx: index("station_downtime_resolved_idx").on(table.resolvedAt),
}));

export const insertStationDowntimeSchema = createInsertSchema(stationDowntime).omit({ id: true, createdAt: true });
export type InsertStationDowntime = z.infer<typeof insertStationDowntimeSchema>;
export type StationDowntime = typeof stationDowntime.$inferSelect;

// ===== GROOMING FEEDBACK & RATINGS =====

export const groomingFeedback = pgTable("grooming_feedback", {
  id: serial("id").primaryKey(),
  feedbackId: varchar("feedback_id").unique().notNull(),
  stationId: integer("station_id").references(() => stations.id).notNull(),
  customerId: varchar("customer_id").notNull(),
  customerName: varchar("customer_name"),
  petName: varchar("pet_name"),
  petType: varchar("pet_type"),
  serviceType: varchar("service_type").default("self_service_wash"),
  overallRating: integer("overall_rating").notNull(),
  cleanlinessRating: integer("cleanliness_rating"),
  equipmentRating: integer("equipment_rating"),
  valueRating: integer("value_rating"),
  easeOfUseRating: integer("ease_of_use_rating"),
  comment: text("comment"),
  photos: text("photos").array(),
  wouldRecommend: boolean("would_recommend"),
  isFlagged: boolean("is_flagged").default(false),
  flaggedReason: varchar("flagged_reason"),
  isVisible: boolean("is_visible").default(true),
  isPublic: boolean("is_public").default(true),
  adminResponse: text("admin_response"),
  adminRespondedAt: timestamp("admin_responded_at"),
  adminRespondedBy: varchar("admin_responded_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  stationIdx: index("idx_grooming_feedback_station").on(table.stationId),
  customerIdx: index("idx_grooming_feedback_customer").on(table.customerId),
  ratingIdx: index("idx_grooming_feedback_rating").on(table.overallRating),
}));

export const insertGroomingFeedbackSchema = createInsertSchema(groomingFeedback).omit({
  id: true,
  createdAt: true,
});
export type InsertGroomingFeedback = z.infer<typeof insertGroomingFeedbackSchema>;
export type GroomingFeedback = typeof groomingFeedback.$inferSelect;

// ===== STATION PROFILES — Phase 10 T23 =====
// One row per station; updated by computeStationScore() via POST /api/admin/stations/:id/recompute.
// Scores are independent of the franchise owner score (no aggregation up the ownership tree).
export const stationProfiles = pgTable("station_profiles", {
  stationId: integer("station_id").primaryKey().references(() => stations.id),
  trustScore: integer("trust_score").notNull().default(50),       // 0-100 composite quality
  rankingScore: integer("ranking_score").notNull().default(50),   // 0-100 final display rank
  ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).notNull().default("0"),
  ratingCount: integer("rating_count").notNull().default(0),
  disputeCount: integer("dispute_count").notNull().default(0),    // open disputes at last computation
  completionRate: decimal("completion_rate", { precision: 5, scale: 4 }).notNull().default("1"),
  lastComputedAt: timestamp("last_computed_at").defaultNow().notNull(),
});

export const insertStationProfileSchema = createInsertSchema(stationProfiles).omit({ lastComputedAt: true });
export type InsertStationProfile = z.infer<typeof insertStationProfileSchema>;
export type StationProfile = typeof stationProfiles.$inferSelect;

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
  providerId: varchar("provider_id"),
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
  refundRequestedAt: timestamp("refund_requested_at"),
  refundReason: text("refund_reason"),
  refundStatus: varchar("refund_status"),
  refundAmountCents: integer("refund_amount_cents"),
  disputeOpenedAt: timestamp("dispute_opened_at"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  customerRating: decimal("customer_rating", { precision: 4, scale: 2 }),
  customerReviewId: integer("customer_review_id"),
  providerReviewId: integer("provider_review_id"),
  confirmedAt: timestamp("confirmed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }),
  transactionStampedAt: timestamp("transaction_stamped_at"),
  confirmationEmailSentAtCustomer: timestamp("confirmation_email_sent_at_customer"),
  confirmationEmailSentAtProvider: timestamp("confirmation_email_sent_at_provider"),
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

// ===== BOOKING CONVERSATION CHAT =====
// One conversation per booking. Opens on confirmed, closes on terminal statuses.
// chatStatus: active | read_only | archived
export const bookingConversations = pgTable("booking_conversations", {
  conversationId: varchar("conversation_id").primaryKey(), // BC-{nanoid}
  bookingId: varchar("booking_id").notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  platform: varchar("platform").notNull(), // walk_my_pet | sitter_suite | academy | pettrek | groomers
  customerId: varchar("customer_id").notNull(), // Firebase UID
  providerId: varchar("provider_id").notNull(), // Firebase UID
  chatStatus: varchar("chat_status").notNull().default("active"), // active | read_only | archived
  closedReason: varchar("closed_reason"), // completed | cancelled | refunded | disputed | expired
  customerUnread: integer("customer_unread").notNull().default(0),
  providerUnread: integer("provider_unread").notNull().default(0),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: varchar("last_message_preview", { length: 120 }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  closedAt: timestamp("closed_at"),
}, (table) => ({
  bookingIdx: uniqueIndex("bc_booking_idx").on(table.bookingId),
  customerIdx: index("bc_customer_idx").on(table.customerId),
  providerIdx: index("bc_provider_idx").on(table.providerId),
  statusIdx: index("bc_status_idx").on(table.chatStatus),
}));

export const bookingMessages = pgTable("booking_messages", {
  messageId: varchar("message_id").primaryKey(), // BM-{nanoid}
  conversationId: varchar("conversation_id").notNull().references(() => bookingConversations.conversationId, { onDelete: 'cascade' }),
  senderUid: varchar("sender_uid").notNull(), // Firebase UID or 'system'
  senderRole: varchar("sender_role").notNull(), // customer | provider | system | admin
  messageType: varchar("message_type").notNull().default("text"), // text | system_event | image
  content: text("content").notNull(),
  systemEventType: varchar("system_event_type"), // booking_confirmed | in_progress | completed | cancelled | dispute_opened | no_show
  isFlagged: boolean("is_flagged").default(false),
  flaggedReason: varchar("flagged_reason"), // contact_info | inappropriate | spam | harassment
  moderatedBy: varchar("moderated_by"), // admin UID
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: varchar("deleted_by"),
  replyToMessageId: varchar("reply_to_message_id"), // BM-{nanoid} of the quoted message
  readByCustomerAt: timestamp("read_by_customer_at"),
  readByProviderAt: timestamp("read_by_provider_at"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata"), // { clientMessageId?: string, ... }
}, (table) => ({
  conversationIdx: index("bm_conversation_idx").on(table.conversationId),
  createdAtIdx: index("bm_created_idx").on(table.conversationId, table.createdAt),
  flaggedIdx: index("bm_flagged_idx").on(table.isFlagged),
}));

export const insertBookingConversationSchema = createInsertSchema(bookingConversations).omit({ createdAt: true });
export type InsertBookingConversation = z.infer<typeof insertBookingConversationSchema>;
export type BookingConversation = typeof bookingConversations.$inferSelect;

export const insertBookingMessageSchema = createInsertSchema(bookingMessages).omit({ createdAt: true });
export type InsertBookingMessage = z.infer<typeof insertBookingMessageSchema>;
export type BookingMessage = typeof bookingMessages.$inferSelect;

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
  // Phase 10 — T22: station assignment
  stationId?: number | null;
  stationName?: string | null;
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
  
  // Phase 9 — Intelligence layer
  sortBy: z.enum(['recommended', 'rating', 'availability']).default('recommended').optional(),
  tierFilter: z.enum(['prestige', 'gold', 'silver', 'bronze', 'at_risk', 'new']).optional(),
  
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
// ISRAELI CONTRACTOR COMPLIANCE SYSTEM - Marketplace Model (marketplace platform)
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
  
  // Withholding Tax Certificate (טופס 2542 / Form 2542)
  // The ITA issues a personalised withholding rate certificate that expires 31 Dec each year.
  // If the certificate has expired the platform MUST fall back to the default rate.
  withholdingCertExpiryDate: date("withholding_cert_expiry_date"), // Form 2542 expiry (typically Dec 31 of the certificate year)
  withholdingCertRate: decimal("withholding_cert_rate", { precision: 5, scale: 2 }), // Reduced rate granted by ITA (e.g. 5.00 for 5%)

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
  index("idx_provider_tax_cert_expiry").on(table.withholdingCertExpiryDate),
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
  
  // Invoice Generation — sequential PW-INV-YYYY-NNNNN, enforced unique at DB level
  invoiceGenerated: boolean("invoice_generated").default(false),
  invoiceNumber: varchar("invoice_number").unique().notNull(),
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
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): canonical
  // citySymbol from shared/data/israel-cities.ts. Nullable
  // until Phase-3 UI cutover. No reader trusts this column
  // yet; the legacy `city` varchar above remains authoritative.
  citySymbol: varchar("city_symbol", { length: 20 }),
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
  // PR-LOCATION-PROVIDER-SERVICE-AREAS-1 (Phase 1): symbol-
  // backed lookup index. Replaces the free-text city index
  // in the Phase-4 read-switch; both live in parallel until
  // then.
  index("idx_contractor_areas_city_symbol").on(table.citySymbol),
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
// USER REGISTRATION TRACKING SYSTEM - Pet Wash™ stamping
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
// ENHANCED BOOKING SEARCH SYSTEM - Pet Wash™ with pet filters
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

  /**
   * Strict proximity mode (Phase B3).
   *
   * When true, the matching engine refuses to fall back to text search
   * and rejects providers that lack lat/lng:
   *   - filters.latitude + filters.longitude become REQUIRED. Missing
   *     either → 422 COORDINATES_REQUIRED.
   *   - Providers without coordinates are filtered OUT (not silently
   *     scored zero).
   *   - Ranking is strict tiered:
   *       1. distance bucket (rounded down to 0.5 km)
   *       2. rating (DESC)
   *       3. recent booking volume (DESC, proxy for availability)
   *   - Provider serviceRadiusKm is respected — a walker who only
   *     serves 3 km will not appear at 8 km even if they're top-rated.
   *
   * Default false for backwards compatibility with legacy callers that
   * still rely on city-text fallback.
   */
  requireCoordinates: z.boolean().default(false).optional(),
  
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
// PET WASH™ BOOKING REQUESTS TABLE
// Complete booking flow: request → meet & greet → payment → service → completion
// =============================================

export const bookingRequestStatusEnum = pgEnum('booking_request_status', [
  'pending',                  // Initial request sent to provider
  'accepted',                 // Provider accepted, awaiting meet & greet
  'declined',                 // Provider declined the request
  'meet_greet_scheduled',     // Meet & Greet date set
  'meet_greet_completed',     // Meet & Greet done, awaiting payment
  'payment_pending',          // Awaiting payment from owner
  'confirmed',                // Payment received, booking confirmed
  'in_progress',              // Service currently happening
  'provider_marked_complete', // Provider says done — awaiting customer approval (dual-approval gate)
  'completed',                // Both parties confirmed — escrow released
  'reviewed',                 // Owner left review
  'cancelled',                // Cancelled by either party
  'disputed'                  // Payment/service dispute opened during approval window
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
  
  // Quote Engine Fields (written by backend, never by frontend)
  quoteSubtotalCents: integer("quote_subtotal_cents").notNull().default(0),
  quoteDiscountCents: integer("quote_discount_cents").notNull().default(0),
  quoteCreditCents: integer("quote_credit_cents").notNull().default(0),
  quoteGiftCardCents: integer("quote_gift_card_cents").notNull().default(0),
  quoteTaxCents: integer("quote_tax_cents").notNull().default(0),
  quoteTotalCents: integer("quote_total_cents").notNull().default(0),
  quoteCurrency: varchar("quote_currency", { length: 8 }).notNull().default("ILS"),
  quoteBreakdown: jsonb("quote_breakdown"), // full snapshot of QuoteResponse
  pricingVersion: varchar("pricing_version", { length: 40 }),
  promoCode: varchar("promo_code", { length: 80 }),
  couponId: varchar("coupon_id", { length: 255 }),
  giftCardId: varchar("gift_card_id", { length: 255 }),
  walletCreditUsedCents: integer("wallet_credit_used_cents").notNull().default(0),
  loyaltyRedeemedCents: integer("loyalty_redeemed_cents").notNull().default(0),

  // Wallet hold/debit lifecycle (Phase 2 — multi-division financial engine)
  // hold_active → debited (on confirm) | released (on cancel/decline) | refunded (post-debit reversal)
  walletHoldCents: integer("wallet_hold_cents").notNull().default(0),       // amount currently held
  walletDebitedCents: integer("wallet_debited_cents").notNull().default(0), // amount finally debited
  walletRefundedCents: integer("wallet_refunded_cents").notNull().default(0),
  walletHoldKey: text("wallet_hold_key"),       // idempotency key for the hold operation
  walletDebitKey: text("wallet_debit_key"),     // idempotency key for the debit operation
  walletReleaseKey: text("wallet_release_key"), // idempotency key for the release operation
  walletRefundKey: text("wallet_refund_key"),   // idempotency key for the refund operation
  financeState: varchar("finance_state", { length: 30 }).notNull().default("none"),
  // none | hold_active | debited | released | refunded

  // Provider payout (Phase 3 — source of truth for provider earnings)
  // providerPayoutCents = subtotalCents - serviceFeeCents (net after 15% platform commission)
  providerPayoutCents: integer("provider_payout_cents"),       // nullable until booking is confirmed
  payoutStatus: varchar("payout_status", { length: 32 }).default("pending"), // pending | released | paid_out | failed
  payoutDate: timestamp("payout_date"),                         // when funds were released to provider

  // Dual-approval completion (blueprint §13: both parties must confirm)
  providerCompletedAt: timestamp("provider_completed_at"),     // when provider marked complete
  customerApprovedAt: timestamp("customer_approved_at"),       // when customer explicitly approved
  autoApprovedAt: timestamp("auto_approved_at"),               // when system auto-approved after 24h silence

  // Cancellation policy tier (blueprint §8)
  cancellationTier: varchar("cancellation_tier", { length: 32 }),           // 72h_plus | 24_to_72h | under_24h | provider_*
  cancellationPenaltyCents: integer("cancellation_penalty_cents").default(0), // penalty deducted from provider payout

  // Emergency cancellation (blueprint §9 — provider sudden illness / force majeure)
  emergencyCancelReason: text("emergency_cancel_reason"),

  // Calendar both-party sync (blueprint §11: both provider & customer receive calendar invitations)
  platformCalendarEventId: varchar("platform_calendar_event_id", { length: 256 }), // Google Calendar event ID
  calendarAttendeesSynced: boolean("calendar_attendees_synced").default(false),      // true after attendees invited

  // Dispute tracking (blueprint §14: opened by customer during approval window)
  disputeOpenedAt: timestamp("dispute_opened_at"),
  disputeOpenedBy: varchar("dispute_opened_by", { length: 16 }),            // owner | system
  disputeReason: text("dispute_reason"),

  // ── Customer address snapshot (Phase B6) ──────────────────────────────────
  // Frozen at booking-create time so the booking row has a permanent
  // record of WHERE the service was requested, independent of the
  // customer's mutable profile address. Used by admin/dispute audits,
  // tax invoices, and the proximity engine.
  customerAddress:       text("customer_address"),
  customerStreet:        varchar("customer_street", { length: 200 }),
  customerStreetNumber:  varchar("customer_street_number", { length: 40 }),
  customerApartment:     varchar("customer_apartment", { length: 80 }),
  customerCity:          varchar("customer_city", { length: 120 }),
  customerCityKey:       varchar("customer_city_key", { length: 60 }),
  customerCountry:       varchar("customer_country", { length: 2 }),
  customerPostalCode:    varchar("customer_postal_code", { length: 16 }),
  customerLatitude:      decimal("customer_latitude", { precision: 10, scale: 7 }),
  customerLongitude:     decimal("customer_longitude", { precision: 10, scale: 7 }),
  customerPlaceId:       varchar("customer_place_id", { length: 200 }),

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
export const quotePetInputSchema = z.object({
  clientRef: z.string(),
  petId: z.union([z.string(), z.number()]).optional().nullable(),
  petName: z.string(),
  petType: z.enum(['dog', 'cat', 'other']),
  breed: z.string().optional().nullable(),
  sizeCategory: z.enum(['small', 'medium', 'large', 'giant']).optional().nullable(),
  ageYears: z.number().optional().nullable(),
  weightKg: z.number().optional().nullable(),
  gender: z.string().optional().nullable(),
  requiresMedication: z.boolean().optional(),
  hasBehaviorFlag: z.boolean().optional(),
  hasSpecialNeeds: z.boolean().optional(),
  quantity: z.number().optional(),
  specialNotes: z.string().optional().nullable(),
  // service-specific extras stored here
  coatType: z.string().optional().nullable(),
  lastGroomedDate: z.string().optional().nullable(),
  leashTrained: z.boolean().optional().nullable(),
  dogParkOk: z.boolean().optional().nullable(),
  feedingInstructions: z.string().optional().nullable(),
  currentSkills: z.string().optional().nullable(),
  trainingGoals: z.string().optional().nullable(),
});

export const quoteAddonInputSchema = z.object({
  addonCode: z.string(),
  addonName: z.string(),
  scope: z.enum(['booking', 'pet']),
  petRef: z.string().optional().nullable(),
  quantity: z.number().min(1).default(1),
  unitPriceCents: z.number().min(0),
});

/**
 * Customer address snapshot (Phase B6).
 *
 * The full structured address stored on the booking row at create time.
 * All fields optional so legacy callers (without the autocomplete) keep
 * working — the route handler will populate what it can.
 */
export const customerAddressSnapshotSchema = z.object({
  formattedAddress: z.string().max(500).optional(),
  street: z.string().max(200).optional(),
  streetNumber: z.string().max(40).optional(),
  apartment: z.string().max(80).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(2).optional(),
  postalCode: z.string().max(16).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  placeId: z.string().max(200).optional(),
});

export type CustomerAddressSnapshot = z.infer<typeof customerAddressSnapshotSchema>;

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
  // Multi-pet booking fields
  petDetails: z.array(quotePetInputSchema).optional(),
  selectedAddons: z.array(quoteAddonInputSchema).optional(),
  finalQuote: z.any().optional(), // QuoteResponse from /api/quotes/preview
  promoCode: z.string().optional().nullable(),
  useWalletCredit: z.boolean().optional(),
  giftCardCode: z.string().optional().nullable(),
  applyLoyaltyCredits: z.boolean().optional().default(false),
  // Phase B6 — customer address snapshot
  customerAddress: customerAddressSnapshotSchema.optional(),
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

// =================== PET WASH™ PROVIDER PRICING (2026) ===================
// Provider-defined pricing with base rates, multi-pet surcharges, and add-ons

// Platform enum for multi-platform providers
export const petWashPlatformEnum = pgEnum("pet_wash_platform", [
  "sitter_suite",    // The Sitter Suite™ - Pet sitting
  "walk_my_pet",     // Walk My Pet™ - Dog walking
  "pet_trek",        // PetTrek™ - Pet taxi/transport
  "groomers",        // Pet grooming services
  "training_academy",// Pet training services
  "k9000_wash",      // K9000™ wash stations
  "plush_lab",       // The Plush Lab™ - Avatar creation
  "daycare",         // Pet daycare
  "paw_finder"       // Lost pet services
]);

// Service types within each platform
export const serviceTypeEnum = pgEnum("marketplace_service_type", [
  "pet_sitting",     // Overnight at sitter's home
  "house_sitting",   // Overnight at owner's home
  "daycare",         // Day care services
  "dog_walking",     // Regular walks
  "drop_in_visit",   // Quick check-in visits
  "pet_taxi",        // Pet transport
  "grooming",        // Full grooming
  "training",        // Training sessions
  "k9000_wash",      // Self-service wash
  "avatar_creation"  // AI pet avatar
]);

// Provider Rate Cards - Pet Wash™ flexible pricing
export const providerRateCards = pgTable("provider_rate_cards", {
  id: serial("id").primaryKey(),
  rateCardId: varchar("rate_card_id").unique().notNull(), // RATE-UUID
  
  // Provider reference
  providerId: varchar("provider_id").notNull(), // Firebase UID
  providerProfileId: integer("provider_profile_id"), // Reference to sitter/walker/driver profile
  
  // Platform & Service
  platform: varchar("platform").notNull(), // sitter_suite, walk_my_pet, etc.
  serviceType: varchar("service_type").notNull(), // pet_sitting, dog_walking, etc.
  
  // Base Rates (provider sets these - in cents/agorot)
  baseRatePerNightCents: integer("base_rate_per_night_cents"), // For overnight services
  baseRatePerHourCents: integer("base_rate_per_hour_cents"), // For hourly services
  baseRatePerVisitCents: integer("base_rate_per_visit_cents"), // For drop-in visits
  
  // Multi-Pet Pricing
  additionalPetSurchargeCents: integer("additional_pet_surcharge_cents").default(0), // Per additional pet
  maxPets: integer("max_pets").default(3),
  
  // Duration Discounts
  weeklyDiscountPercent: integer("weekly_discount_percent").default(0), // 7+ days
  monthlyDiscountPercent: integer("monthly_discount_percent").default(0), // 30+ days
  
  // Weekend/Holiday Surcharges
  weekendSurchargePercent: integer("weekend_surcharge_percent").default(0),
  holidaySurchargePercent: integer("holiday_surcharge_percent").default(0),
  
  // Pet Type Pricing (some pets cost more)
  petTypePricing: jsonb("pet_type_pricing").default(sql`'{}'::jsonb`), // {"cat": 0, "large_dog": 2000, "exotic": 5000}
  
  // Available Add-ons for this service
  enabledAddons: text("enabled_addons").array().default([]), // ["bath", "nail_trim", "medication"]
  addonPricing: jsonb("addon_pricing").default(sql`'{}'::jsonb`), // {"bath": 5000, "nail_trim": 2500}

  // Structured Quote-Engine Pricing Rules
  // Shape: { base_price_cents, additional_pet_price_cents, pet_type_rules, size_rules,
  //          special_needs_surcharge_cents, medication_surcharge_cents, behavior_flag_surcharge_cents }
  pricingRules: jsonb("pricing_rules").notNull().default(sql`'{}'::jsonb`),
  // Shape: [{ code, name, scope: 'booking'|'pet', unit_price_cents }]
  addonsCatalog: jsonb("addons_catalog").notNull().default(sql`'[]'::jsonb`),

  // Availability
  isActive: boolean("is_active").default(true),
  minBookingHours: integer("min_booking_hours").default(1),
  maxBookingDays: integer("max_booking_days").default(30),
  
  // Last Price Update
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Platform Memberships - which platforms a provider is active on
export const providerPlatformMemberships = pgTable("provider_platform_memberships", {
  id: serial("id").primaryKey(),
  membershipId: varchar("membership_id").unique().notNull(), // MEMB-UUID
  
  providerId: varchar("provider_id").notNull(), // Firebase UID
  platform: varchar("platform").notNull(), // sitter_suite, walk_my_pet, etc.
  
  // Status
  status: varchar("status").default("pending"), // pending, active, suspended, inactive
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  
  // Platform-specific verification
  platformVerificationStatus: varchar("platform_verification_status").default("pending"),
  platformSpecificDocs: jsonb("platform_specific_docs").default(sql`'{}'::jsonb`),
  
  // Performance on this platform
  totalBookings: integer("total_bookings").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }), // Percentage
  acceptanceRate: decimal("acceptance_rate", { precision: 5, scale: 2 }), // Percentage
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_platform_memberships_provider").on(table.providerId),
  index("idx_platform_memberships_platform").on(table.platform),
]);

// Service Add-ons Catalog - predefined add-on services
export const serviceAddons = pgTable("service_addons", {
  id: serial("id").primaryKey(),
  addonId: varchar("addon_id").unique().notNull(), // ADDON-UUID
  
  // Basic Info
  code: varchar("code").unique().notNull(), // bath, nail_trim, medication, etc.
  nameEn: varchar("name_en").notNull(),
  nameHe: varchar("name_he").notNull(),
  descriptionEn: text("description_en"),
  descriptionHe: text("description_he"),
  
  // Applicable platforms
  applicablePlatforms: text("applicable_platforms").array().default([]),
  applicableServiceTypes: text("applicable_service_types").array().default([]),
  
  // Suggested pricing (providers can override)
  suggestedPriceCents: integer("suggested_price_cents").default(0),
  minPriceCents: integer("min_price_cents").default(0),
  maxPriceCents: integer("max_price_cents"),
  
  // Display
  icon: varchar("icon"), // Lucide icon name
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Provider Availability Calendar
export const providerAvailability = pgTable("provider_availability", {
  id: serial("id").primaryKey(),
  
  providerId: varchar("provider_id").notNull(),
  platform: varchar("platform").notNull(),
  
  // Date/Time
  date: date("date").notNull(),
  timeSlot: varchar("time_slot"), // morning, afternoon, evening, all_day
  
  // Availability
  isAvailable: boolean("is_available").default(true),
  maxBookings: integer("max_bookings").default(1), // How many bookings can accept
  currentBookings: integer("current_bookings").default(0),
  
  // Special pricing for this date
  customRateCents: integer("custom_rate_cents"), // Override base rate
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_availability_provider_date").on(table.providerId, table.date),
  index("idx_availability_platform").on(table.platform, table.date),
]);

// Quote Requests - customer requests quote from provider
export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  quoteId: varchar("quote_id").unique().notNull(), // QUOTE-UUID
  
  // Parties
  customerId: varchar("customer_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  
  // Service Details
  platform: varchar("platform").notNull(),
  serviceType: varchar("service_type").notNull(),
  
  // Booking Details
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  numberOfNights: integer("number_of_nights"),
  numberOfHours: integer("number_of_hours"),
  
  // Pets
  petCount: integer("pet_count").default(1),
  petDetails: jsonb("pet_details").default(sql`'[]'::jsonb`), // [{type, name, breed, size}]
  
  // Add-ons requested
  requestedAddons: text("requested_addons").array().default([]),
  
  // Special Requirements
  specialRequirements: text("special_requirements"),
  
  // Quote Calculation (filled by provider or auto-calculated)
  baseAmountCents: integer("base_amount_cents"),
  additionalPetsCents: integer("additional_pets_cents"),
  addonsCents: integer("addons_cents"),
  surchargeCents: integer("surcharge_cents"), // Weekend/holiday
  discountCents: integer("discount_cents"), // Duration/promo
  subtotalCents: integer("subtotal_cents"),
  platformFeeCents: integer("platform_fee_cents"), // 15% commission
  taxCents: integer("tax_cents"), // VAT
  totalCents: integer("total_cents"),
  providerEarningsCents: integer("provider_earnings_cents"),
  
  // Status
  status: varchar("status").default("pending"), // pending, quoted, accepted, declined, expired
  quotedAt: timestamp("quoted_at"),
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  
  // Provider message
  providerMessage: text("provider_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quotes_customer").on(table.customerId),
  index("idx_quotes_provider").on(table.providerId),
  index("idx_quotes_status").on(table.status),
]);

// Zod Schemas for new tables
export const insertProviderRateCardSchema = createInsertSchema(providerRateCards).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
});
export type InsertProviderRateCard = z.infer<typeof insertProviderRateCardSchema>;
export type ProviderRateCard = typeof providerRateCards.$inferSelect;

export const insertProviderPlatformMembershipSchema = createInsertSchema(providerPlatformMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderPlatformMembership = z.infer<typeof insertProviderPlatformMembershipSchema>;
export type ProviderPlatformMembership = typeof providerPlatformMemberships.$inferSelect;

export const insertServiceAddonSchema = createInsertSchema(serviceAddons).omit({
  id: true,
  createdAt: true,
});
export type InsertServiceAddon = z.infer<typeof insertServiceAddonSchema>;
export type ServiceAddon = typeof serviceAddons.$inferSelect;

export const insertProviderAvailabilitySchema = createInsertSchema(providerAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderAvailability = z.infer<typeof insertProviderAvailabilitySchema>;
export type ProviderAvailability = typeof providerAvailability.$inferSelect;

export const insertQuoteRequestSchema = createInsertSchema(quoteRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuoteRequest = z.infer<typeof insertQuoteRequestSchema>;
export type QuoteRequest = typeof quoteRequests.$inferSelect;

// Pet Wash Platform Types
export type PetWashPlatform = 
  | "sitter_suite"
  | "walk_my_pet"
  | "pet_trek"
  | "groomers"
  | "training_academy"
  | "k9000_wash"
  | "plush_lab"
  | "daycare"
  | "paw_finder";

export const PETWASH_PLATFORMS: Record<PetWashPlatform, {
  nameEn: string;
  nameHe: string;
  icon: string;
  color: string;
  description: { en: string; he: string };
}> = {
  sitter_suite: {
    nameEn: "The Sitter Suite™",
    nameHe: "סוויטת השמרטף™",
    icon: "Home",
    color: "from-rose-500 to-pink-600",
    description: {
      en: "Overnight pet sitting in a loving home",
      he: "שמירה על חיות מחמד בבית אוהב"
    }
  },
  walk_my_pet: {
    nameEn: "Walk My Pet™",
    nameHe: "טייל את הכלב שלי™",
    icon: "Dog",
    color: "from-emerald-500 to-teal-600",
    description: {
      en: "Professional dog walking services",
      he: "שירותי טיול כלבים מקצועיים"
    }
  },
  pet_trek: {
    nameEn: "PetTrek™",
    nameHe: "פט-טרק™",
    icon: "Car",
    color: "from-blue-500 to-indigo-600",
    description: {
      en: "Safe pet transportation",
      he: "הסעות חיות מחמד בטוחות"
    }
  },
  groomers: {
    nameEn: "Groomers",
    nameHe: "מטפחים",
    icon: "Scissors",
    color: "from-purple-500 to-violet-600",
    description: {
      en: "Professional pet grooming",
      he: "טיפוח חיות מחמד מקצועי"
    }
  },
  training_academy: {
    nameEn: "Training Academy",
    nameHe: "אקדמיית אילוף",
    icon: "GraduationCap",
    color: "from-amber-500 to-orange-600",
    description: {
      en: "Expert pet training",
      he: "אילוף חיות מחמד מקצועי"
    }
  },
  k9000_wash: {
    nameEn: "K9000™ Wash",
    nameHe: "K9000™ שטיפה",
    icon: "Droplets",
    color: "from-cyan-500 to-sky-600",
    description: {
      en: "Self-service pet wash stations",
      he: "תחנות שטיפה בשירות עצמי"
    }
  },
  plush_lab: {
    nameEn: "The Plush Lab™",
    nameHe: "מעבדת הפלאש™",
    icon: "Sparkles",
    color: "from-pink-500 to-fuchsia-600",
    description: {
      en: "AI-powered pet avatar creation",
      he: "יצירת אווטר בינה מלאכותית"
    }
  },
  daycare: {
    nameEn: "Pet Daycare",
    nameHe: "מעון יום לחיות",
    icon: "Sun",
    color: "from-yellow-500 to-amber-600",
    description: {
      en: "Day care for your furry friends",
      he: "מעון יום לחברים הפרוותיים"
    }
  },
  paw_finder: {
    nameEn: "Paw Finder",
    nameHe: "מוצא כפות",
    icon: "Search",
    color: "from-red-500 to-rose-600",
    description: {
      en: "Lost pet recovery services",
      he: "שירותי איתור חיות אבודות"
    }
  }
};

// Commission rate (industry standard 15% for legacy providers)
export const PETWASH_COMMISSION_RATE = 0.15;

// =================== PET WASH™ 12-STATUS BOOKING LIFECYCLE ===================
// Complete booking lifecycle with status history tracking

export const bookingLifecycleStatusEnum = pgEnum("booking_lifecycle_status", [
  "inquiry",              // Customer sends initial inquiry
  "quote_sent",           // Provider sends quote
  "quote_expired",        // Quote not accepted in time
  "deposit_pending",      // Awaiting payment
  "deposit_received",     // Payment captured, funds in escrow
  "owner_confirmed",      // Owner confirmed booking
  "provider_confirmed",   // Provider accepted booking
  "in_progress",          // Service is being delivered
  "owner_completion_review",    // Owner reviewing completion
  "provider_completion_review", // Provider marking complete
  "completed",            // Both parties confirmed, escrow releasing
  "cancelled",            // Booking cancelled
  "refunded",             // Funds refunded
  "disputed"              // Under dispute
]);

// Booking Status History - audit trail for all status changes
export const bookingStatusHistory = pgTable("booking_status_history", {
  id: serial("id").primaryKey(),
  
  bookingId: varchar("booking_id").notNull(),
  
  // Status transition
  fromStatus: varchar("from_status"),
  toStatus: varchar("to_status").notNull(),
  
  // Actor
  changedByUserId: varchar("changed_by_user_id").notNull(),
  changedByRole: varchar("changed_by_role").notNull(), // customer, provider, system, admin
  
  // Reason
  reason: text("reason"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  // Timestamps
  changedAt: timestamp("changed_at").defaultNow(),
}, (table) => [
  index("idx_booking_status_history_booking").on(table.bookingId),
  index("idx_booking_status_history_date").on(table.changedAt),
]);

// Escrow Holdings - tracks 72-hour escrow lifecycle
export const escrowHoldings = pgTable("escrow_holdings", {
  id: serial("id").primaryKey(),
  escrowId: varchar("escrow_id").unique().notNull(),
  
  // References
  bookingId: varchar("booking_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  
  // Amounts (in cents/agorot)
  grossAmountCents: integer("gross_amount_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  vatCents: integer("vat_cents").notNull(),
  netProviderAmountCents: integer("net_provider_amount_cents").notNull(),
  
  // Status
  status: varchar("status").default("pending"), // pending, held, releasing, released, refunded, disputed
  
  // Escrow Lifecycle Timestamps
  capturedAt: timestamp("captured_at"), // When payment captured
  serviceCompletedAt: timestamp("service_completed_at"), // When service marked complete
  releaseEligibleAt: timestamp("release_eligible_at"), // 72 hours after completion
  releasedAt: timestamp("released_at"), // When funds released to provider
  
  // Refund info
  refundRequestedAt: timestamp("refund_requested_at"),
  refundProcessedAt: timestamp("refund_processed_at"),
  refundAmountCents: integer("refund_amount_cents"),
  refundReason: text("refund_reason"),
  
  // Dispute info
  disputeOpenedAt: timestamp("dispute_opened_at"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolution: varchar("dispute_resolution"), // customer_favor, provider_favor, split
  
  // Payment gateway references
  paymentIntentId: varchar("payment_intent_id"),
  payoutTransferId: varchar("payout_transfer_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_escrow_booking").on(table.bookingId),
  index("idx_escrow_status").on(table.status),
  index("idx_escrow_release_eligible").on(table.releaseEligibleAt),
]);

// Zod schemas for new tables
export const insertBookingStatusHistorySchema = createInsertSchema(bookingStatusHistory).omit({
  id: true,
  changedAt: true,
});
export type InsertBookingStatusHistory = z.infer<typeof insertBookingStatusHistorySchema>;
export type BookingStatusHistory = typeof bookingStatusHistory.$inferSelect;

export const insertEscrowHoldingSchema = createInsertSchema(escrowHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEscrowHolding = z.infer<typeof insertEscrowHoldingSchema>;
export type EscrowHolding = typeof escrowHoldings.$inferSelect;

// Pet Wash™ booking lifecycle type
export type BookingLifecycleStatus = 
  | "inquiry"
  | "quote_sent"
  | "quote_expired"
  | "deposit_pending"
  | "deposit_received"
  | "owner_confirmed"
  | "provider_confirmed"
  | "in_progress"
  | "owner_completion_review"
  | "provider_completion_review"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed";

// Valid status transitions
export const BOOKING_STATUS_TRANSITIONS: Record<BookingLifecycleStatus, BookingLifecycleStatus[]> = {
  inquiry: ["quote_sent", "cancelled"],
  quote_sent: ["quote_expired", "deposit_pending", "cancelled"],
  quote_expired: ["quote_sent"], // Can re-quote
  deposit_pending: ["deposit_received", "cancelled"],
  deposit_received: ["owner_confirmed", "cancelled", "refunded"],
  owner_confirmed: ["provider_confirmed", "cancelled", "refunded"],
  provider_confirmed: ["in_progress", "cancelled", "refunded"],
  in_progress: ["owner_completion_review", "provider_completion_review", "disputed"],
  owner_completion_review: ["completed", "disputed"],
  provider_completion_review: ["completed", "disputed"],
  completed: [], // Terminal state (escrow releases automatically)
  cancelled: ["refunded"],
  refunded: [], // Terminal state
  disputed: ["completed", "refunded"], // Admin resolution
};

// =================== UNIFIED WALLET & CREDIT SYSTEM ===================
// Supports e-gift cards, wash packages, loyalty points across all platforms
// Pet Walker, Pet Sitter, PetTrek, K9000 hardware stations via Nayax

// Credit types enum
export const CreditType = pgEnum("credit_type", [
  "egift",           // E-gift card balance
  "wash_package",    // Prepaid wash package credits
  "loyalty_points",  // Loyalty program points
  "promo_credit",    // Promotional credits
  "referral_credit"  // Referral bonus credits
]);

// Platforms where credits can be redeemed
export const RedeemablePlatform = pgEnum("redeemable_platform", [
  "walker",      // Walk My Pet™
  "sitter",      // Sitter Suite™
  "pettrek",     // PetTrek™ Transport
  "k9000",       // K9000™ Hardware Wash Station
  "plush_lab",   // The Plush Lab™
  "all"          // Universal credits
]);

// User Wallet Account - unified credit wallet per user
export const walletAccounts = pgTable("wallet_accounts", {
  id: serial("id").primaryKey(),
  walletId: varchar("wallet_id", { length: 50 }).unique().notNull(), // WALLET-XXXXX
  userId: varchar("user_id").notNull(),
  
  // Aggregate balances (cached for performance, recalculated from transactions)
  cashWalletBalanceCents: integer("cash_wallet_balance_cents").default(0).notNull(), // Paid-in cash balance (was in Firestore — now PostgreSQL for atomicity)
  egiftBalanceCents: integer("egift_balance_cents").default(0).notNull(),
  washPackageCredits: integer("wash_package_credits").default(0).notNull(), // Number of wash sessions
  packageServiceUnitsRemaining: integer("package_service_units_remaining").default(0).notNull(), // Non-wash service units (grooming, walk, etc.)
  loyaltyPointsBalance: integer("loyalty_points_balance").default(0).notNull(),
  promoBalanceCents: integer("promo_balance_cents").default(0).notNull(),
  referralBalanceCents: integer("referral_balance_cents").default(0).notNull(),
  
  // Tier info (7-star loyalty)
  loyaltyTier: varchar("loyalty_tier", { length: 50 }).default("bronze"), // bronze, silver, gold, platinum, diamond, elite, vip
  tierPointsThisYear: integer("tier_points_this_year").default(0),
  
  // Hold & lifetime counters (Phase 2 — multi-division wallet)
  pendingBalanceCents: integer("pending_balance_cents").notNull().default(0),    // sum of active holds
  lifetimeEarnedCents: integer("lifetime_earned_cents").notNull().default(0),   // all credit events ever
  lifetimeRedeemedCents: integer("lifetime_redeemed_cents").notNull().default(0), // all debit events ever

  // Settings
  preferredCurrency: varchar("preferred_currency", { length: 3 }).default("ILS"),
  autoApplyCredits: boolean("auto_apply_credits").default(true),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  lastActivityAt: timestamp("last_activity_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_wallet_user").on(table.userId),
  index("idx_wallet_tier").on(table.loyaltyTier),
]);

// Credit Transactions - immutable ledger of all credit movements
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  transactionId: varchar("transaction_id", { length: 50 }).unique().notNull(), // TXN-XXXXX
  walletId: varchar("wallet_id").notNull(),
  
  // Transaction type
  creditType: varchar("credit_type").notNull(), // egift, wash_package, loyalty_points, promo_credit, referral_credit
  transactionType: varchar("transaction_type").notNull(), // issue, hold, redeem, release, refund, expire, adjust
  
  // Amounts (positive = credit, negative = debit)
  amountCents: integer("amount_cents"), // For monetary credits
  amountUnits: integer("amount_units"), // For package credits (wash sessions, etc.)
  
  // Running balance after this transaction
  balanceAfterCents: integer("balance_after_cents"),
  balanceAfterUnits: integer("balance_after_units"),
  
  // Source/Destination
  sourceType: varchar("source_type"), // purchase, gift, promo, referral, admin
  sourceId: varchar("source_id"), // Order ID, promo code, etc.
  redemptionSessionId: varchar("redemption_session_id"), // Links to redemption session
  
  // Platform & Service
  platform: varchar("platform"), // walker, sitter, pettrek, k9000, plush_lab
  serviceType: varchar("service_type"),
  bookingId: varchar("booking_id"),
  
  // Metadata
  description: text("description"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  // Actor
  initiatedBy: varchar("initiated_by"), // user, system, admin
  initiatedByUserId: varchar("initiated_by_user_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // For promotional credits
}, (table) => [
  index("idx_credit_txn_wallet").on(table.walletId),
  index("idx_credit_txn_type").on(table.transactionType),
  index("idx_credit_txn_created").on(table.createdAt),
  index("idx_credit_txn_booking").on(table.bookingId),
]);

// Redemption Sessions - tracks mobile/hardware redemption flows
export const redemptionSessions = pgTable("redemption_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 50 }).unique().notNull(), // REDEEM-XXXXX
  walletId: varchar("wallet_id").notNull(),
  userId: varchar("user_id").notNull(),
  
  // Session type
  sessionType: varchar("session_type").notNull(), // mobile_booking, hardware_qr, hardware_nfc
  
  // What's being redeemed
  platform: varchar("platform").notNull(), // walker, sitter, pettrek, k9000
  serviceType: varchar("service_type"), // hourly, daily, per_trip, per_wash
  
  // Pricing breakdown (in cents/agorot)
  requestedAmountCents: integer("requested_amount_cents").notNull(),
  
  // Credit application
  egiftAppliedCents: integer("egift_applied_cents").default(0),
  washPackagesApplied: integer("wash_packages_applied").default(0),
  loyaltyPointsApplied: integer("loyalty_points_applied").default(0),
  promoAppliedCents: integer("promo_applied_cents").default(0),
  totalCreditsAppliedCents: integer("total_credits_applied_cents").default(0),
  
  // Residual payment
  cashDueCents: integer("cash_due_cents").default(0),
  paymentMethod: varchar("payment_method"), // nayax, credit_card, apple_pay, google_pay
  paymentStatus: varchar("payment_status").default("pending"), // pending, processing, completed, failed
  
  // Hardware station info (for K9000)
  stationId: varchar("station_id"),
  terminalId: varchar("terminal_id"),
  
  // QR/Token for hardware redemption
  redemptionCode: varchar("redemption_code", { length: 20 }), // 6-digit code for manual entry
  redemptionQrData: text("redemption_qr_data"), // Encrypted QR payload
  codeHmac: varchar("code_hmac", { length: 128 }), // HMAC signature for validation
  
  // Session lifecycle
  status: varchar("status").default("pending").notNull(), // pending, code_generated, scanned, acknowledged, completed, expired, cancelled
  
  // Timing
  expiresAt: timestamp("expires_at").notNull(), // Sessions expire quickly (5-10 min)
  scannedAt: timestamp("scanned_at"),
  acknowledgedAt: timestamp("acknowledged_at"), // Hardware confirmed
  completedAt: timestamp("completed_at"),
  
  // Linked booking
  bookingId: varchar("booking_id"),
  
  // Audit
  deviceInfo: jsonb("device_info").default(sql`'{}'::jsonb`), // Device type, OS, app version
  locationInfo: jsonb("location_info").default(sql`'{}'::jsonb`), // Lat/lng, station location
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_redeem_session_wallet").on(table.walletId),
  index("idx_redeem_session_user").on(table.userId),
  index("idx_redeem_session_status").on(table.status),
  index("idx_redeem_session_code").on(table.redemptionCode),
  index("idx_redeem_session_station").on(table.stationId),
  index("idx_redeem_session_expires").on(table.expiresAt),
]);

// Zod schemas for wallet system
export const insertWalletAccountSchema = createInsertSchema(walletAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWalletAccount = z.infer<typeof insertWalletAccountSchema>;
export type WalletAccount = typeof walletAccounts.$inferSelect;

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;

export const insertRedemptionSessionSchema = createInsertSchema(redemptionSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRedemptionSession = z.infer<typeof insertRedemptionSessionSchema>;
export type RedemptionSession = typeof redemptionSessions.$inferSelect;

// ══════════════════════════════════════════════════════════════════════════════
// WALLET ANTI-FRAUD ARCHITECTURE — Production 2026
// Implements: append-only ledger · double-entry · hash chain · idempotency ·
//             JTI registry · velocity limits · fraud log · holds
// ══════════════════════════════════════════════════════════════════════════════

// ─── 1. wallet_ledger_entries — the TRUE source of financial truth ─────────────
// Append-only. Every financial event writes ≥2 rows (double-entry).
// No updates or deletes. Corrections only via reversal entries.
export const walletLedgerEntries = pgTable("wallet_ledger_entries", {
  id:              serial("id").primaryKey(),
  entryId:         varchar("entry_id",        { length: 80  }).unique().notNull(),
  walletId:        varchar("wallet_id",        { length: 80  }).notNull(),
  userId:          varchar("user_id",          { length: 128 }).notNull(),

  // Double-entry fields
  eventType:       varchar("event_type",       { length: 50 }).notNull(),
  // topup | redeem_kiosk | redeem_online | refund | admin_credit | admin_debit
  // hold_create | hold_capture | hold_release | egift_issue | egift_claim | reversal
  direction:       varchar("direction",        { length: 10 }).notNull(), // debit | credit
  amountCents:     integer("amount_cents").default(0).notNull(),
  currency:        varchar("currency",         { length: 3  }).default("ILS").notNull(),
  bucket:          varchar("bucket",           { length: 40 }).notNull(),
  // cash_wallet | egift | promo | wash_package | loyalty | payment_clearing | service_revenue | provider_payout

  // Counterparty (who is on the other side of this entry)
  counterpartyType: varchar("counterparty_type", { length: 50 }),
  counterpartyId:   varchar("counterparty_id",   { length: 128 }),

  // Division tracking (cross-platform reporting)
  divisionCode:    varchar("division_code",    { length: 40 }),
  // station_k9000 | petsitter | walkers | academy | gift_card | admin
  sourceType:      varchar("source_type",      { length: 40 }),
  // k9000_wash | booking | academy | reward | topup | manual | egift | referral

  // Reference IDs
  idempotencyKey:  varchar("idempotency_key",  { length: 128 }),
  jti:             varchar("jti",              { length: 128 }),
  sessionId:       varchar("session_id",       { length: 80 }),
  bookingId:       varchar("booking_id",       { length: 120 }),
  kioskId:         varchar("kiosk_id",         { length: 80 }),
  providerId:      varchar("provider_id",      { length: 128 }),

  // Actor
  createdBy:       varchar("created_by",       { length: 128 }).notNull(),

  // Context
  ipAddress:       varchar("ip_address",       { length: 45 }),
  userAgent:       varchar("user_agent",       { length: 500 }),
  metadata:        jsonb("metadata").default(sql`'{}'::jsonb`),

  // Cryptographic hash chain (near-blockchain integrity)
  previousHash:    varchar("previous_hash",    { length: 64 }).notNull(),
  entryHash:       varchar("entry_hash",       { length: 64 }).notNull(),

  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wle_wallet_id").on(table.walletId),
  index("idx_wle_user_id").on(table.userId),
  index("idx_wle_booking").on(table.bookingId),
  index("idx_wle_idem").on(table.idempotencyKey),
  index("idx_wle_jti").on(table.jti),
  index("idx_wle_event_type").on(table.eventType),
  index("idx_wle_created").on(table.createdAt),
  index("idx_wle_division").on(table.divisionCode),
  index("idx_wle_source_type").on(table.sourceType),
]);

// ─── 1b. wallet_reconciliation_runs — persistent audit trail of every recon/proof run ──
export const walletReconciliationRuns = pgTable("wallet_reconciliation_runs", {
  id:           serial("id").primaryKey(),
  runId:        varchar("run_id",       { length: 80  }).unique().notNull(),
  runType:      varchar("run_type",     { length: 30  }).notNull(), // 'reconciliation' | 'proof_pass'
  status:       varchar("status",       { length: 20  }).notNull().default("completed"),
  verdict:      varchar("verdict",      { length: 10  }), // 'PASS' | 'WARN' | 'FAIL' | null
  startedAt:    timestamp("started_at").defaultNow().notNull(),
  completedAt:  timestamp("completed_at"),
  durationMs:   integer("duration_ms"),
  drifted:      integer("drifted").notNull().default(0),
  healed:       integer("healed").notNull().default(0),
  failedCount:  integer("failed_count").notNull().default(0),
  triggeredBy:  varchar("triggered_by", { length: 128 }), // uid | 'startup' | 'cron'
  summaryJson:  jsonb("summary_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wrr_run_type").on(table.runType),
  index("idx_wrr_created_at").on(table.createdAt),
  index("idx_wrr_triggered").on(table.triggeredBy),
]);
export type WalletReconciliationRun = typeof walletReconciliationRuns.$inferSelect;

// ─── 2. wallet_idempotency_keys — prevents double-processing ──────────────────
// One row per idempotency key; stores the full response so duplicate requests
// return the exact same result without re-processing.
export const walletIdempotencyKeys = pgTable("wallet_idempotency_keys", {
  id:              serial("id").primaryKey(),
  idempotencyKey:  varchar("idempotency_key",  { length: 128 }).unique().notNull(),
  endpoint:        varchar("endpoint",         { length: 100 }).notNull(),
  requestHash:     varchar("request_hash",     { length: 64  }),
  responseJson:    text("response_json"),
  status:          varchar("status",           { length: 20  }).default("success"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  expiresAt:       timestamp("expires_at"),
}, (table) => [
  index("idx_wik_key").on(table.idempotencyKey),
  index("idx_wik_expires").on(table.expiresAt),
]);

// ─── 3. wallet_jti_registry — PostgreSQL-backed JTI replay protection ─────────
// Secondary layer to Firestore. A JTI consumed here can NEVER be reused,
// even if Firestore is unavailable.
export const walletJtiRegistry = pgTable("wallet_jti_registry", {
  jti:             varchar("jti",              { length: 128 }).primaryKey(),
  tokenType:       varchar("token_type",       { length: 50  }).notNull(), // kiosk_qr | egift | pass | topup
  walletId:        varchar("wallet_id",        { length: 80  }).notNull(),
  userId:          varchar("user_id",          { length: 128 }).notNull(),
  firstSeenAt:     timestamp("first_seen_at").defaultNow().notNull(),
  consumedAt:      timestamp("consumed_at"),
  endpoint:        varchar("endpoint",         { length: 100 }),
  status:          varchar("status",           { length: 20  }).default("seen").notNull(),
  // seen | consumed | rejected
  ipAddress:       varchar("ip_address",       { length: 45  }),
}, (table) => [
  index("idx_wjr_wallet").on(table.walletId),
  index("idx_wjr_user").on(table.userId),
  index("idx_wjr_status").on(table.status),
]);

// ─── 4. wallet_fraud_log — immutable audit trail for all suspicious events ─────
export const walletFraudLog = pgTable("wallet_fraud_log", {
  id:              serial("id").primaryKey(),
  eventId:         varchar("event_id",         { length: 80  }).unique().notNull(),
  actorType:       varchar("actor_type",        { length: 30  }).notNull(), // user | staff | admin | system
  actorId:         varchar("actor_id",          { length: 128 }).notNull(),
  action:          varchar("action",            { length: 80  }).notNull(),
  targetWalletId:  varchar("target_wallet_id",  { length: 80  }),
  targetGiftId:    varchar("target_gift_id",    { length: 80  }),
  requestId:       varchar("request_id",        { length: 80  }),
  ipAddress:       varchar("ip_address",        { length: 45  }),
  userAgent:       varchar("user_agent",        { length: 500 }),
  deviceId:        varchar("device_id",         { length: 128 }),
  riskScore:       integer("risk_score").default(0),        // 0–100
  outcome:         varchar("outcome",           { length: 20  }).notNull(), // allowed | flagged | blocked
  reason:          text("reason"),
  metadata:        jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wfl_actor").on(table.actorId),
  index("idx_wfl_wallet").on(table.targetWalletId),
  index("idx_wfl_outcome").on(table.outcome),
  index("idx_wfl_created").on(table.createdAt),
  index("idx_wfl_action").on(table.action),
]);

// ─── 5. wallet_holds — hold-before-capture for online bookings ────────────────
// Online booking holds funds without immediately debiting, preventing ghost
// bookings and race conditions. Captured on service confirmation.
export const walletHolds = pgTable("wallet_holds", {
  id:              serial("id").primaryKey(),
  holdId:          varchar("hold_id",          { length: 80  }).unique().notNull(),
  walletId:        varchar("wallet_id",        { length: 80  }).notNull(),
  userId:          varchar("user_id",          { length: 128 }).notNull(),
  amountCents:     integer("amount_cents").notNull(),
  currency:        varchar("currency",         { length: 3   }).default("ILS").notNull(),
  holdType:        varchar("hold_type",        { length: 30  }).notNull(), // booking | topup | admin
  serviceType:     varchar("service_type",     { length: 50  }),
  bookingId:       varchar("booking_id",       { length: 120 }),
  providerId:      varchar("provider_id",      { length: 128 }),
  status:          varchar("status",           { length: 20  }).default("active").notNull(),
  // active | captured | released | expired | cancelled
  idempotencyKey:  varchar("idempotency_key",  { length: 128 }),
  expiresAt:       timestamp("expires_at").notNull(),
  capturedAt:      timestamp("captured_at"),
  releasedAt:      timestamp("released_at"),
  ipAddress:       varchar("ip_address",       { length: 45  }),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wh_wallet").on(table.walletId),
  index("idx_wh_user").on(table.userId),
  index("idx_wh_booking").on(table.bookingId),
  index("idx_wh_status").on(table.status),
  index("idx_wh_expires").on(table.expiresAt),
]);

// Drizzle types
export type WalletLedgerEntry    = typeof walletLedgerEntries.$inferSelect;
export type InsertWalletLedger   = typeof walletLedgerEntries.$inferInsert;
export type WalletIdempotencyKey = typeof walletIdempotencyKeys.$inferSelect;
export type WalletJtiRegistry    = typeof walletJtiRegistry.$inferSelect;
export type WalletFraudLog       = typeof walletFraudLog.$inferSelect;
export type WalletHold           = typeof walletHolds.$inferSelect;

export const googleFormsConfig = pgTable("google_forms_config", {
  id: serial("id").primaryKey(),
  formType: varchar("form_type", { length: 50 }).notNull().unique(),
  formUrl: text("form_url").notNull(),
  formTitle: text("form_title"),
  formTitleHe: text("form_title_he"),
  enabled: boolean("enabled").default(true).notNull(),
  height: integer("height").default(800),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGoogleFormsConfigSchema = createInsertSchema(googleFormsConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGoogleFormsConfig = z.infer<typeof insertGoogleFormsConfigSchema>;
export type GoogleFormsConfig = typeof googleFormsConfig.$inferSelect;

// =================== ISRAELI DIGITAL RECEIPTS (קבלה דיגיטלית) ===================
// Israeli Tax Authority compliant digital receipts - mandatory per Israeli law 2026
// Sent to customer via email + recorded in internal accounting system

export const digitalReceipts = pgTable("digital_receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: varchar("receipt_number", { length: 50 }).unique().notNull(),
  receiptType: varchar("receipt_type", { length: 30 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  bookingId: varchar("booking_id"),
  nayaxTransactionId: varchar("nayax_transaction_id"),

  customerEmail: varchar("customer_email").notNull(),
  customerName: varchar("customer_name"),
  customerPhone: varchar("customer_phone"),

  providerName: varchar("provider_name"),
  providerId: varchar("provider_id"),
  providerType: varchar("provider_type"),

  serviceDescription: text("service_description").notNull(),
  serviceDescriptionHe: text("service_description_he").notNull(),

  subtotalAmount: decimal("subtotal_amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(),
  vatAmount: decimal("vat_amount", { precision: 12, scale: 2 }).notNull(),
  platformFeeAmount: decimal("platform_fee_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("ILS").notNull(),

  providerPayoutAmount: decimal("provider_payout_amount", { precision: 12, scale: 2 }),
  brokerCommissionAmount: decimal("broker_commission_amount", { precision: 12, scale: 2 }),
  withholdingTaxAmount: decimal("withholding_tax_amount", { precision: 12, scale: 2 }),
  withholdingTaxRate: decimal("withholding_tax_rate", { precision: 5, scale: 2 }),
  netPaymentToProvider: decimal("net_payment_to_provider", { precision: 12, scale: 2 }),

  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 30 }).default("completed").notNull(),

  companyName: varchar("company_name").default("Pet Wash Ltd").notNull(),
  companyTaxId: varchar("company_tax_id").default("516788400").notNull(),
  companyAddress: varchar("company_address").default("Israel").notNull(),

  emailSent: boolean("email_sent").default(false).notNull(),
  emailSentAt: timestamp("email_sent_at"),
  emailError: text("email_error"),

  accountingRecorded: boolean("accounting_recorded").default(false).notNull(),
  accountingEntryId: varchar("accounting_entry_id"),
  sheetsBackupId: varchar("sheets_backup_id"),

  auditHash: varchar("audit_hash", { length: 128 }).notNull(),
  isVoided: boolean("is_voided").default(false).notNull(),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),

  // Credit note linkage: populated when receiptType = 'credit_note'
  originalReceiptId: integer("original_receipt_id"), // FK to digital_receipts.id of the original receipt being reversed

  // SHAAM allocation number (מספר הקצאה) — Israeli ITA Digital Invoice Law 2026
  // Required on tax invoices/credit notes where the ex-VAT amount exceeds:
  //   ₪10,000 from 1.1.2026 | ₪5,000 from 1.6.2026
  shaamRequired: boolean("shaam_required").default(false).notNull(),
  shaamAllocationNumber: varchar("shaam_allocation_number"), // Obtained from ITA SHAAM API once integrated

  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_digital_receipts_number").on(table.receiptNumber),
  index("idx_digital_receipts_customer").on(table.customerEmail),
  index("idx_digital_receipts_booking").on(table.bookingId),
  index("idx_digital_receipts_platform").on(table.platform),
  index("idx_digital_receipts_issued").on(table.issuedAt),
]);

export const insertDigitalReceiptSchema = createInsertSchema(digitalReceipts).omit({
  id: true,
  createdAt: true,
});
export type InsertDigitalReceipt = z.infer<typeof insertDigitalReceiptSchema>;
export type DigitalReceipt = typeof digitalReceipts.$inferSelect;

// =================== OCTOPUS GLOBAL BRAIN ===================
// Unified booking engine, wallet, ledger, provider search, KYC enforcement
// ALL financial writes flow through the Octopus Brain — no platform writes directly

export const octopusRoleEnum = pgEnum("octopus_role", [
  "CUSTOMER",
  "PROVIDER",
  "ADMIN",
  "FINANCE",
]);

export const octopusPlatformEnum = pgEnum("octopus_platform", [
  "PETSITTER",
  "PETTREK",
  "ACADEMY",
  "PETWASH_HUB",
]);

export const octopusBookingStatusEnum = pgEnum("octopus_booking_status", [
  "DRAFT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const octopusLedgerTypeEnum = pgEnum("octopus_ledger_type", [
  "BOOKING_CREATED",
  "PAYMENT_CAPTURED",
  "WALLET_DEBIT",
  "WALLET_CREDIT",
  "PROVIDER_EARNING",
  "PLATFORM_FEE",
  "INVOICE_ISSUED",
]);

export const octopusProviders = pgTable("octopus_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique().notNull(),
  city: varchar("city").notNull(),
  cityNormalized: varchar("city_normalized").notNull(),
  services: jsonb("services").default(sql`'[]'::jsonb`).notNull(),
  rating: real("rating").default(5),
  approved: boolean("approved").default(false).notNull(),
  visible: boolean("visible").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_octopus_provider_city").on(table.cityNormalized),
  index("idx_octopus_provider_approved").on(table.approved),
  index("idx_octopus_provider_user").on(table.userId),
]);

export const octopusWallets = pgTable("octopus_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique().notNull(),
  balance: integer("balance").default(0).notNull(),
  petwashCredits: integer("petwash_credits").default(0).notNull(),
  petsitterCredits: integer("petsitter_credits").default(0).notNull(),
  pettrekCredits: integer("pettrek_credits").default(0).notNull(),
  academyCredits: integer("academy_credits").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const octopusBookings = pgTable("octopus_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: varchar("platform").notNull(),
  status: varchar("status").default("DRAFT").notNull(),
  userId: varchar("user_id").notNull(),
  providerId: varchar("provider_id"),
  price: integer("price").notNull(),
  platformFee: integer("platform_fee").notNull(),
  providerShare: integer("provider_share").notNull(),
  idempotencyKey: varchar("idempotency_key").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_octopus_booking_user").on(table.userId),
  index("idx_octopus_booking_provider").on(table.providerId),
  index("idx_octopus_booking_platform").on(table.platform),
  index("idx_octopus_booking_status").on(table.status),
]);

export const octopusLedger = pgTable("octopus_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(),
  bookingId: varchar("booking_id"),
  walletId: varchar("wallet_id"),
  amount: integer("amount").notNull(),
  platform: varchar("platform"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_octopus_ledger_booking").on(table.bookingId),
  index("idx_octopus_ledger_wallet").on(table.walletId),
  index("idx_octopus_ledger_type").on(table.type),
  index("idx_octopus_ledger_platform").on(table.platform),
]);

export const octopusInvoices = pgTable("octopus_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").unique().notNull(),
  docNumber: varchar("doc_number"),
  allocationNumber: varchar("allocation_number"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_octopus_invoice_booking").on(table.bookingId),
]);

export const insertOctopusProviderSchema = createInsertSchema(octopusProviders).omit({
  id: true,
  createdAt: true,
});
export type InsertOctopusProvider = z.infer<typeof insertOctopusProviderSchema>;
export type OctopusProvider = typeof octopusProviders.$inferSelect;

export const insertOctopusWalletSchema = createInsertSchema(octopusWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOctopusWallet = z.infer<typeof insertOctopusWalletSchema>;
export type OctopusWallet = typeof octopusWallets.$inferSelect;

export const insertOctopusBookingSchema = createInsertSchema(octopusBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOctopusBooking = z.infer<typeof insertOctopusBookingSchema>;
export type OctopusBooking = typeof octopusBookings.$inferSelect;

export const insertOctopusLedgerSchema = createInsertSchema(octopusLedger).omit({
  id: true,
  createdAt: true,
});
export type InsertOctopusLedger = z.infer<typeof insertOctopusLedgerSchema>;
export type OctopusLedger = typeof octopusLedger.$inferSelect;

export const insertOctopusInvoiceSchema = createInsertSchema(octopusInvoices).omit({
  id: true,
  createdAt: true,
});
export type InsertOctopusInvoice = z.infer<typeof insertOctopusInvoiceSchema>;
export type OctopusInvoice = typeof octopusInvoices.$inferSelect;

export const egiftEventTypeEnum = pgEnum("egift_event_type", [
  "PURCHASED",
  "CREDITED_TO_WALLET",
  "REDEEM_STARTED",
  "REDEEMED",
  "REDEEM_FAILED",
  "REFUNDED",
  "EXPIRED",
  "VOIDED",
]);

export const egiftEvents = pgTable("egift_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id", { length: 64 }).unique().notNull(),
  egiftId: varchar("egift_id", { length: 64 }).notNull(),
  eventType: egiftEventTypeEnum("event_type").notNull(),
  userId: varchar("user_id", { length: 255 }),
  walletId: varchar("wallet_id", { length: 64 }),
  amountCents: integer("amount_cents"),
  currency: varchar("currency", { length: 8 }).default("ILS"),
  platform: varchar("platform", { length: 50 }),
  product: varchar("product", { length: 50 }),
  stationId: varchar("station_id", { length: 100 }),
  baySide: varchar("bay_side", { length: 20 }),
  bookingId: varchar("booking_id", { length: 64 }),
  kioskTxnId: varchar("kiosk_txn_id", { length: 64 }),
  ledgerEntryId: varchar("ledger_entry_id", { length: 64 }),
  invoiceId: varchar("invoice_id", { length: 64 }),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  sha256Hash: varchar("sha256_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_egift_events_egift_id").on(table.egiftId),
  index("idx_egift_events_user_id").on(table.userId),
  index("idx_egift_events_type").on(table.eventType),
  index("idx_egift_events_idempotency").on(table.idempotencyKey),
  index("idx_egift_events_created").on(table.createdAt),
]);

export const egiftRedeemAttempts = pgTable("egift_redeem_attempts", {
  id: serial("id").primaryKey(),
  egiftId: varchar("egift_id", { length: 64 }).notNull(),
  stationId: varchar("station_id", { length: 100 }),
  userId: varchar("user_id", { length: 255 }),
  success: boolean("success").default(false),
  failureReason: varchar("failure_reason", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
}, (table) => [
  index("idx_redeem_attempts_egift").on(table.egiftId),
  index("idx_redeem_attempts_station").on(table.stationId),
  index("idx_redeem_attempts_time").on(table.attemptedAt),
]);

export const insertEgiftEventSchema = createInsertSchema(egiftEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertEgiftEvent = z.infer<typeof insertEgiftEventSchema>;
export type EgiftEvent = typeof egiftEvents.$inferSelect;

export const insertEgiftRedeemAttemptSchema = createInsertSchema(egiftRedeemAttempts).omit({
  id: true,
  attemptedAt: true,
});
export type InsertEgiftRedeemAttempt = z.infer<typeof insertEgiftRedeemAttemptSchema>;
export type EgiftRedeemAttempt = typeof egiftRedeemAttempts.$inferSelect;

export const kycAuditLog = pgTable("kyc_audit_log", {
  id: serial("id").primaryKey(),
  entryId: varchar("entry_id", { length: 64 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  actorId: varchar("actor_id", { length: 255 }).notNull(),
  actorRole: varchar("actor_role", { length: 100 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 255 }),
  verificationId: varchar("verification_id", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 64 }),
  metadata: jsonb("metadata"),
  riskScore: integer("risk_score"),
  previousHash: varchar("previous_hash", { length: 64 }).notNull(),
  entryHash: varchar("entry_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_audit_actor").on(table.actorId),
  index("idx_kyc_audit_target").on(table.targetUserId),
  index("idx_kyc_audit_action").on(table.action),
  index("idx_kyc_audit_created").on(table.createdAt),
  index("idx_kyc_audit_verification").on(table.verificationId),
]);

export const kycRoleAssignments = pgTable("kyc_role_assignments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  assignedBy: varchar("assigned_by", { length: 255 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  index("idx_kyc_roles_user").on(table.userId),
  index("idx_kyc_roles_active").on(table.isActive),
]);

export const mfaEnrollments = pgTable("mfa_enrollments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  method: varchar("method", { length: 20 }).notNull(),
  totpSecret: varchar("totp_secret", { length: 512 }),
  totpVerified: boolean("totp_verified").default(false),
  smsPhone: varchar("sms_phone", { length: 30 }),
  emailAddress: varchar("email_address", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mfa_enrollments_user").on(table.userId),
  index("idx_mfa_enrollments_email").on(table.userEmail),
]);

export const kycIncidents = pgTable("kyc_incidents", {
  id: serial("id").primaryKey(),
  incidentId: varchar("incident_id", { length: 64 }).notNull().unique(),
  severity: varchar("severity", { length: 10 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("detected"),
  affectedUsers: jsonb("affected_users"),
  containmentActions: jsonb("containment_actions"),
  evidence: jsonb("evidence"),
  detectedAt: timestamp("detected_at").notNull(),
  respondedAt: timestamp("responded_at"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 255 }),
  resolution: text("resolution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_incidents_status").on(table.status),
  index("idx_kyc_incidents_severity").on(table.severity),
]);

export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  consentVersion: varchar("consent_version", { length: 50 }).notNull(),
  consentTextHash: varchar("consent_text_hash", { length: 128 }).notNull(),
  accepted: boolean("accepted").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  method: varchar("method", { length: 30 }),
  ip: varchar("ip", { length: 100 }),
  userAgent: text("user_agent"),
  deviceId: varchar("device_id"),
  locale: varchar("locale", { length: 50 }),
  source: varchar("source", { length: 20 }),
  traceId: varchar("trace_id", { length: 100 }),
  evidenceHash: varchar("evidence_hash", { length: 128 }),
}, (table) => [
  index("idx_user_consents_user_id").on(table.userId),
  index("idx_user_consents_type_version").on(table.consentType, table.consentVersion),
]);

export const insertUserConsentSchema = createInsertSchema(userConsents).omit({
  id: true,
  acceptedAt: true,
});
export type InsertUserConsent = z.infer<typeof insertUserConsentSchema>;
export type UserConsent = typeof userConsents.$inferSelect;

export const authEvents = pgTable("auth_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  success: boolean("success").notNull(),
  reason: text("reason"),
  ip: varchar("ip", { length: 100 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  traceId: varchar("trace_id", { length: 100 }),
}, (table) => [
  index("idx_auth_events_user_id").on(table.userId),
  index("idx_auth_events_type").on(table.eventType),
  index("idx_auth_events_created_at").on(table.createdAt),
]);

export const insertAuthEventSchema = createInsertSchema(authEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAuthEvent = z.infer<typeof insertAuthEventSchema>;
export type AuthEvent = typeof authEvents.$inferSelect;

export const staffAccessRequests = pgTable("staff_access_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  requestedRole: varchar("requested_role").notNull(),
  departmentCode: varchar("department_code"),
  department: varchar("department"),
  justification: text("justification"),
  managerName: varchar("manager_name"),
  status: varchar("status").notNull().default("pending"),
  approvalScope: jsonb("approval_scope"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
  decidedBy: varchar("decided_by"),
  reason: text("reason"),
}, (table) => [
  index("idx_staff_requests_user").on(table.userId),
  index("idx_staff_requests_status").on(table.status),
]);

export const insertStaffAccessRequestSchema = createInsertSchema(staffAccessRequests).omit({
  id: true,
  requestedAt: true,
});
export type InsertStaffAccessRequest = z.infer<typeof insertStaffAccessRequestSchema>;
export type StaffAccessRequest = typeof staffAccessRequests.$inferSelect;

export const USER_STATUS_VALUES = [
  'new', 'profile_incomplete', 'profile_complete',
  'kyc_pending', 'kyc_approved', 'kyc_rejected',
  'provider_pending_approval', 'provider_active',
  'staff_pending_approval', 'staff_active',
  'suspended'
] as const;
export type UserStatus = typeof USER_STATUS_VALUES[number];

export const ALLOWED_INTENTS = ['customer', 'loyalty', 'provider', 'staff_request'] as const;
export type SignupIntent = typeof ALLOWED_INTENTS[number];

export const ALLOWED_ROLES = ['customer', 'loyalty', 'provider', 'staff', 'management', 'admin'] as const;
export type UserRole = typeof ALLOWED_ROLES[number];

export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  actorUserId: varchar("actor_user_id"),
  actorRole: varchar("actor_role"),
  actionType: varchar("action_type").notNull(),
  targetType: varchar("target_type"),
  targetId: varchar("target_id"),
  ip: varchar("ip"),
  userAgent: text("user_agent"),
  traceId: varchar("trace_id"),
  metadata: jsonb("metadata"),
  severity: varchar("severity").default("info"),
}, (table) => [
  index("idx_audit_ev_actor").on(table.actorUserId),
  index("idx_audit_ev_action").on(table.actionType),
  index("idx_audit_ev_trace").on(table.traceId),
  index("idx_audit_ev_target").on(table.targetType, table.targetId),
  index("idx_audit_ev_created").on(table.createdAt),
]);
export type AuditEvent = typeof auditEvents.$inferSelect;

export const kycCases = pgTable("kyc_cases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  roleContext: varchar("role_context").notNull(),
  status: varchar("status").notNull().default("pending"),
  riskScore: integer("risk_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  decidedBy: varchar("decided_by"),
  decidedAt: timestamp("decided_at"),
  decisionReason: text("decision_reason"),
}, (table) => [
  index("idx_kyc_cases_user").on(table.userId),
  index("idx_kyc_cases_status").on(table.status),
]);
export type KycCase = typeof kycCases.$inferSelect;

export const kycDocuments = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  kycCaseId: integer("kyc_case_id").notNull(),
  docType: varchar("doc_type").notNull(),
  country: varchar("country", { length: 5 }),
  storageMode: varchar("storage_mode").default("zero_storage"),
  storageRef: varchar("storage_ref"),
  processingRef: varchar("processing_ref"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  fingerprintHash: varchar("fingerprint_hash"),
  status: varchar("status").notNull().default("received"),
}, (table) => [
  index("idx_kyc_docs_case").on(table.kycCaseId),
]);
export type KycDocument = typeof kycDocuments.$inferSelect;

export const kycChecks = pgTable("kyc_checks", {
  id: serial("id").primaryKey(),
  kycCaseId: integer("kyc_case_id").notNull(),
  checkType: varchar("check_type").notNull(),
  result: varchar("result").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_kyc_checks_case").on(table.kycCaseId),
]);

export const consentSnapshots = pgTable("consent_snapshots", {
  id: serial("id").primaryKey(),
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  locale: varchar("locale", { length: 50 }).notNull(),
  content: text("content").notNull(),
  contentHash: varchar("content_hash", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_consent_snap_type_ver").on(table.consentType, table.version),
  index("idx_consent_snap_hash").on(table.contentHash),
]);
export type ConsentSnapshot = typeof consentSnapshots.$inferSelect;
export const insertConsentSnapshotSchema = createInsertSchema(consentSnapshots).omit({ id: true, createdAt: true });
export type InsertConsentSnapshot = z.infer<typeof insertConsentSnapshotSchema>;

export const onboardingCases = pgTable("onboarding_cases", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  context: varchar("context", { length: 30 }).notNull(),
  status: varchar("status").notNull().default("started"),
  currentStep: varchar("current_step"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  decidedBy: varchar("decided_by"),
  decidedAt: timestamp("decided_at"),
  decisionReason: text("decision_reason"),
}, (table) => [
  uniqueIndex("idx_onboarding_user_unique").on(table.userId),
  index("idx_onboarding_context").on(table.context),
  index("idx_onboarding_status").on(table.status),
]);
export type OnboardingCase = typeof onboardingCases.$inferSelect;
export const insertOnboardingCaseSchema = createInsertSchema(onboardingCases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOnboardingCase = z.infer<typeof insertOnboardingCaseSchema>;

export const servicesCatalog = pgTable("services_catalog", {
  id: serial("id").primaryKey(),
  serviceCode: varchar("service_code", { length: 10 }).notNull().unique(),
  namePublic: varchar("name_public").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ServiceCatalogEntry = typeof servicesCatalog.$inferSelect;
export const insertServicesCatalogSchema = createInsertSchema(servicesCatalog).omit({ id: true, createdAt: true });

export const dispatchJobs = pgTable("dispatch_jobs", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull(),
  status: varchar("status").notNull().default("created"),
  wave: integer("wave").default(1).notNull(),
  nextWaveAt: timestamp("next_wave_at"),
  leasedUntil: timestamp("leased_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_dispatch_booking").on(table.bookingId),
  index("idx_dispatch_status").on(table.status),
]);
export type DispatchJob = typeof dispatchJobs.$inferSelect;
export const insertDispatchJobSchema = createInsertSchema(dispatchJobs).omit({ id: true, createdAt: true, updatedAt: true });

export const providerProfiles = pgTable("provider_profiles", {
  userId: varchar("user_id").primaryKey().notNull(),
  bio: text("bio"),
  languages: jsonb("languages").default(sql`'[]'::jsonb`),
  serviceCoverage: jsonb("service_coverage").default(sql`'{}'::jsonb`),
  ratingAvg: decimal("rating_avg", { precision: 3, scale: 2 }).default("0"),
  ratingCount: integer("rating_count").default(0),
  badges: jsonb("badges").default(sql`'[]'::jsonb`),
  availabilityState: varchar("availability_state").default("offline"),
  lastPresenceAt: timestamp("last_presence_at"),
  backgroundCheckStatus: varchar("background_check_status"),
  payoutAccountStatus: varchar("payout_account_status"),
  // ── Trust metrics (computed from real booking data, null = insufficient data) ──
  completedBookingsCount: integer("completed_bookings_count"),      // real count from booking_requests
  repeatClientCount: integer("repeat_client_count"),               // distinct owners with ≥2 completed bookings
  responseRatePct: integer("response_rate_pct"),                   // 0-100, % of requests responded within 24h
  avgResponseTimeMinutes: integer("avg_response_time_minutes"),    // median minutes to first status change
  acceptanceRatePct: integer("acceptance_rate_pct"),               // 0-100, % of requests moved to accepted/confirmed
  completionRatePct: integer("completion_rate_pct"),               // 0-100, % of confirmed bookings completed (not cancelled)
  cancellationRatePct: integer("cancellation_rate_pct"),           // 0-100, % of confirmed bookings cancelled by provider
  trustScore: integer("trust_score"),                              // 0-100 composite score (null = new/insufficient data)
  trustMetricsUpdatedAt: timestamp("trust_metrics_updated_at"),   // when last computed
  // ── Ranking (smart matching score, computed from trust + rating + recency + completeness) ──
  rankingScore: integer("ranking_score"),                          // 0-100 final display rank (null = not computed)
  rankingOverride: integer("ranking_override"),                    // admin-set override (null = use computed)
  rankingBoostUntil: timestamp("ranking_boosted_until"),          // temporary admin boost expiry
  rankingUpdatedAt: timestamp("ranking_updated_at"),              // last recomputed
  rankingFlaggedAt: timestamp("ranking_flagged_at"),             // set when operator flags provider for review (null = not flagged)
  // ── Home setup (set by provider, null = not answered yet) ──
  hasFencedYard: boolean("has_fenced_yard"),
  hasNoPetsAtHome: boolean("has_no_pets_at_home"),
  // ── Pricing + pet acceptance (DB-backed browse filters) ──
  priceFromCents: integer("price_from_cents"),               // lowest service price in agorot; null = not set
  acceptedPets: text("accepted_pets").array(),               // e.g. ['dog','cat']; null/empty = show for all
  // ── Availability scheduling ──
  blockedDates: text("blocked_dates").array(),               // ISO date strings e.g. ['2026-04-15']; null/empty = no blocked dates
  workingHours: jsonb("working_hours"),                      // {mon:{from:'09:00',to:'18:00',active:true},...sun:{...}}
  // ── Retention / win-back ──
  isWinbackSuppressed: boolean("is_winback_suppressed").notNull().default(false), // provider opted out of win-back pings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_provider_avail").on(table.availabilityState),
]);
export type ProviderProfile = typeof providerProfiles.$inferSelect;
export const insertProviderProfileSchema = createInsertSchema(providerProfiles).omit({ createdAt: true, updatedAt: true });

// ── Saved providers (customer wishlist — persisted per Firebase UID) ──────────
export const savedProviders = pgTable("saved_providers", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),     // customer Firebase UID
  providerId: varchar("provider_id", { length: 128 }).notNull(), // provider Firebase UID
  platform: varchar("platform", { length: 32 }),             // sitter_suite, walk_my_pet, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_saved_providers_user").on(table.userId),
  uniqueIndex("uq_saved_provider_pair").on(table.userId, table.providerId),
]);
export type SavedProvider = typeof savedProviders.$inferSelect;
export const insertSavedProviderSchema = createInsertSchema(savedProviders).omit({ id: true, createdAt: true });

export const providerAssets = pgTable("provider_assets", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id").notNull(),
  assetType: varchar("asset_type").notNull(),
  storageRef: varchar("storage_ref"),
  zeroStorageMarker: boolean("zero_storage_marker").default(false),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_provider_assets_pid").on(table.providerId),
]);
export type ProviderAsset = typeof providerAssets.$inferSelect;
export const insertProviderAssetSchema = createInsertSchema(providerAssets).omit({ id: true, createdAt: true });

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id"),
  status: varchar("status").notNull().default("authorized"),
  method: varchar("method"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 5 }).default("ILS").notNull(),
  providerFee: decimal("provider_fee", { precision: 12, scale: 2 }),
  platformFee: decimal("platform_fee", { precision: 12, scale: 2 }),
  tax: decimal("tax", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_payments_booking").on(table.bookingId),
  index("idx_payments_status").on(table.status),
]);
export type Payment = typeof payments.$inferSelect;
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });

export const ledgerEntries = pgTable("ledger_entries", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entryType: varchar("entry_type").notNull(),
  reasonCode: varchar("reason_code").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 5 }).default("ILS").notNull(),
  relatedId: varchar("related_id"),
  immutableHash: varchar("immutable_hash", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ledger_entity").on(table.entityType, table.entityId),
  index("idx_ledger_reason").on(table.reasonCode),
  index("idx_ledger_related").on(table.relatedId),
  index("idx_ledger_created").on(table.createdAt),
]);
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export const insertLedgerEntrySchema = createInsertSchema(ledgerEntries).omit({ id: true, createdAt: true });

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  eventType: varchar("event_type").notNull(),
  ip: varchar("ip"),
  userAgent: text("user_agent"),
  riskScore: integer("risk_score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sec_events_user").on(table.userId),
  index("idx_sec_events_type").on(table.eventType),
  index("idx_sec_events_created").on(table.createdAt),
]);
export type SecurityEvent = typeof securityEvents.$inferSelect;
export const insertSecurityEventSchema = createInsertSchema(securityEvents).omit({ id: true, createdAt: true });
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;

// OTP Events - Fintech-grade evidence tracking for phone verification
export const otpEvents = pgTable("otp_events", {
  id: serial("id").primaryKey(),
  otpId: varchar("otp_id", { length: 100 }).notNull(), // UUID or event-scoped key
  eventType: varchar("event_type", { length: 30 }).notNull(), // OTP_SENT, OTP_VERIFIED, OTP_FAILED, OTP_EXPIRED
  phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
  userId: varchar("user_id"), // nullable for pre-auth
  userTypeIntent: varchar("user_type_intent", { length: 20 }).notNull(), // PUBLIC, PROVIDER, STAFF_REQUEST
  otpHash: varchar("otp_hash", { length: 128 }), // SHA-256 hash, never store raw code
  expiresAt: timestamp("expires_at"),
  attemptsCount: integer("attempts_count").default(0),
  result: varchar("result", { length: 30 }), // success, expired, max_attempts, invalid_code
  provider: varchar("provider", { length: 30 }).default("twilio"), // twilio, firebase
  providerMessageId: varchar("provider_message_id", { length: 100 }),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  deviceId: varchar("device_id", { length: 100 }),
  countryCode: varchar("country_code", { length: 5 }),
  traceId: varchar("trace_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
}, (table) => [
  index("idx_otp_events_phone").on(table.phoneE164),
  index("idx_otp_events_user").on(table.userId),
  index("idx_otp_events_type").on(table.eventType),
  index("idx_otp_events_otp_id").on(table.otpId),
  index("idx_otp_events_created").on(table.createdAt),
]);
export type OtpEvent = typeof otpEvents.$inferSelect;
export const insertOtpEventSchema = createInsertSchema(otpEvents).omit({ id: true, createdAt: true });
export type InsertOtpEvent = z.infer<typeof insertOtpEventSchema>;

// SMS Evidence - Immutable audit trail for all outbound SMS
export const smsEvidence = pgTable("sms_evidence", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  membershipId: varchar("membership_id", { length: 20 }),
  messageType: varchar("message_type", { length: 30 }).notNull(), // OTP, WELCOME, NOTIFICATION, TRANSACTIONAL
  templateId: varchar("template_id", { length: 50 }),
  templateVersion: varchar("template_version", { length: 10 }).default("1.0"),
  toPhone: varchar("to_phone", { length: 20 }).notNull(),
  renderedText: text("rendered_text").notNull(), // Exact text sent (for legal evidence)
  contentHash: varchar("content_hash", { length: 128 }), // SHA-256 of rendered text
  provider: varchar("provider", { length: 30 }).default("twilio"),
  providerMessageId: varchar("provider_message_id", { length: 100 }),
  status: varchar("status", { length: 30 }).default("sent"), // queued, sent, delivered, failed, undelivered
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  failureReason: text("failure_reason"),
  ip: varchar("ip", { length: 45 }),
  userAgent: text("user_agent"),
  traceId: varchar("trace_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sms_evidence_user").on(table.userId),
  index("idx_sms_evidence_phone").on(table.toPhone),
  index("idx_sms_evidence_type").on(table.messageType),
  index("idx_sms_evidence_sent").on(table.sentAt),
  index("idx_sms_evidence_trace").on(table.traceId),
]);
export type SmsEvidence = typeof smsEvidence.$inferSelect;
export const insertSmsEvidenceSchema = createInsertSchema(smsEvidence).omit({ id: true, createdAt: true });
export type InsertSmsEvidence = z.infer<typeof insertSmsEvidenceSchema>;

export const emailAudit = pgTable("email_audit", {
  id: serial("id").primaryKey(),
  emailType: varchar("email_type", { length: 50 }).notNull(),
  userId: varchar("user_id"),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  membershipNumber: varchar("membership_number", { length: 20 }),
  provider: varchar("provider", { length: 30 }).default("sendgrid"),
  messageId: varchar("message_id", { length: 200 }),
  status: varchar("status", { length: 30 }).default("sent"),
  failureReason: text("failure_reason"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  traceId: varchar("trace_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_audit_user").on(table.userId),
  index("idx_email_audit_type").on(table.emailType),
  index("idx_email_audit_email").on(table.toEmail),
  index("idx_email_audit_sent").on(table.sentAt),
  index("idx_email_audit_trace").on(table.traceId),
]);
export type EmailAuditRecord = typeof emailAudit.$inferSelect;
export const insertEmailAuditSchema = createInsertSchema(emailAudit).omit({ id: true, createdAt: true });
export type InsertEmailAudit = z.infer<typeof insertEmailAuditSchema>;

// ============================================================
// UNIFIED VOUCHER SYSTEM 2026
// Financial instrument with full audit trail, dual redemption
// channels (STATION + WEB/APP), partial redemption, and
// short-lived signed QR tokens for fraud prevention.
// ============================================================

/**
 * Voucher Classification:
 *   WASH_PACKAGE  – redeems washes at physical K9000 stations
 *   PLATFORM_CREDIT – redeems ILS credit on web/app (sitter, walker, academy, etc.)
 *
 * Status Machine:
 *   ISSUED → ACTIVE (on first view/claim)
 *         → PARTIALLY_REDEEMED (partial use)
 *         → REDEEMED (fully consumed)
 *         → EXPIRED (past expires_at)
 *         → CANCELLED (admin action)
 */
export const unifiedVouchers = pgTable("unified_vouchers", {
  id: varchar("id").primaryKey(), // UV-YYYYMMDD-XXXXXXXX

  // --- Classification ---
  voucherType: varchar("voucher_type", { length: 32 }).notNull(), // WASH_PACKAGE | PLATFORM_CREDIT
  designTheme: varchar("design_theme", { length: 32 }).notNull().default("pink"), // pink | green | black | gold
  status: varchar("status", { length: 32 }).notNull().default("ISSUED"), // ISSUED | ACTIVE | PARTIALLY_REDEEMED | REDEEMED | EXPIRED | CANCELLED

  // --- Stored Value ---
  // For WASH_PACKAGE: washesOriginal / washesRemaining are used; value fields = null
  // For PLATFORM_CREDIT: value fields are used; washes fields = null
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  valueOriginal: decimal("value_original", { precision: 12, scale: 2 }),   // ILS amount (PLATFORM_CREDIT)
  valueRemaining: decimal("value_remaining", { precision: 12, scale: 2 }), // ILS remaining
  washesOriginal: integer("washes_original"),   // wash count (WASH_PACKAGE)
  washesRemaining: integer("washes_remaining"), // washes remaining

  // --- Recipient (supports RTL/LTR locales) ---
  recipientDisplayName: varchar("recipient_display_name", { length: 200 }).notNull(),
  recipientLocale: varchar("recipient_locale", { length: 8 }).notNull().default("he"), // he, en, ar, fr, ru, es
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 30 }),

  // --- Ownership ---
  purchasedByUserId: varchar("purchased_by_user_id"), // Firebase UID of buyer
  purchasedByEmail: varchar("purchased_by_email", { length: 255 }),
  ownerUserId: varchar("owner_user_id"), // Assigned after claim (may differ from buyer)

  // --- Human-readable serial number for UI display ---
  serialNumber: varchar("serial_number", { length: 32 }).notNull().unique(), // e.g. PWV-2026-A3B7C2D1

  // --- Cryptographic security ---
  // The long-lived JWS covers immutable fields (originalValues + type + serial)
  // It is verified on every redemption to detect DB tampering
  immutableHash: text("immutable_hash").notNull(), // SHA256 of immutable canonical fields
  signedJws: text("signed_jws").notNull(),         // ES256 JWS over immutableHash

  // --- Apple / Google Wallet readiness ---
  walletPassId: varchar("wallet_pass_id", { length: 100 }), // PassKit / Google Wallet object ID
  svgTemplateKey: varchar("svg_template_key", { length: 64 }), // for renderer in Step 2

  // --- Purchase reference ---
  purchaseOrderId: varchar("purchase_order_id", { length: 100 }), // Nayax / Stripe / manual order
  nayaxTxId: varchar("nayax_tx_id", { length: 100 }),

  // --- Lifecycle ---
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  fullyRedeemedAt: timestamp("fully_redeemed_at", { withTimezone: true }),
  lastRedeemedAt: timestamp("last_redeemed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),

  // --- Metadata ---
  personalMessage: text("personal_message"), // Optional gift message from buyer
  metadata: jsonb("metadata"), // Future extensibility (Apple Wallet pass fields, etc.)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_uv_owner").on(table.ownerUserId),
  index("idx_uv_purchaser").on(table.purchasedByUserId),
  index("idx_uv_status").on(table.status),
  index("idx_uv_type").on(table.voucherType),
  index("idx_uv_serial").on(table.serialNumber),
  index("idx_uv_expires").on(table.expiresAt),
]);

export type UnifiedVoucher = typeof unifiedVouchers.$inferSelect;
export const insertUnifiedVoucherSchema = createInsertSchema(unifiedVouchers).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertUnifiedVoucher = z.infer<typeof insertUnifiedVoucherSchema>;

/**
 * Unified Voucher Ledger — APPEND-ONLY, IMMUTABLE
 *
 * Every event (issue, redeem, refund, adjust, cancel) writes one row.
 * Hash chaining: entryHash = SHA256(canonical | prevEntryHash)
 * This makes any ledger tampering immediately detectable.
 *
 * Channel:
 *   STATION – physical K9000 terminal scanned the QR
 *   WEB     – user redeemed via browser checkout
 *   APP     – user redeemed via mobile app
 *   ADMIN   – manual adjustment by staff
 */
export const unifiedVoucherLedger = pgTable("unified_voucher_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherId: varchar("voucher_id").notNull().references(() => unifiedVouchers.id, { onDelete: 'restrict' }),

  // --- Sequence & hash chain ---
  seqNo: integer("seq_no").notNull(),           // 0 = genesis (ISSUE event)
  prevEntryHash: text("prev_entry_hash"),        // null only for genesis
  entryHash: text("entry_hash").notNull(),       // SHA256 of canonical entry data
  signedJws: text("signed_jws").notNull(),       // ES256 over entryHash

  // --- Event type ---
  event: varchar("event", { length: 32 }).notNull(), // ISSUE | REDEEM | REFUND | ADJUST | CANCEL | EXPIRE

  // --- Delta values (positive = consumed/removed, negative = restored/refunded) ---
  deltaValue: decimal("delta_value", { precision: 12, scale: 2 }).notNull().default("0"),
  deltaWashes: integer("delta_washes").notNull().default(0),

  // --- Running totals AFTER this entry (snapshot for fast reconciliation) ---
  balanceValueAfter: decimal("balance_value_after", { precision: 12, scale: 2 }),
  balanceWashesAfter: integer("balance_washes_after"),

  // --- Channel & external references ---
  channel: varchar("channel", { length: 16 }).notNull(), // STATION | WEB | APP | ADMIN
  stationId: varchar("station_id", { length: 100 }),
  locationLabel: text("location_label"),
  externalRef: varchar("external_ref", { length: 200 }), // station tx id / order id / booking id

  // --- Actor ---
  actorUserId: varchar("actor_user_id", { length: 128 }), // UID who triggered this (may be system/admin)
  actorRole: varchar("actor_role", { length: 32 }),        // customer | staff | station | system

  // --- Short-lived QR token reference (for station redemptions) ---
  qrTokenNonce: varchar("qr_token_nonce", { length: 64 }), // links to the QR token that was presented
  qrTokenJti: varchar("qr_token_jti", { length: 64 }),     // JWT ID from the QR token (anti-replay)

  // --- Notes ---
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_uvl_seq").on(table.voucherId, table.seqNo),
  index("idx_uvl_voucher").on(table.voucherId),
  index("idx_uvl_event").on(table.event),
  index("idx_uvl_channel").on(table.channel),
  index("idx_uvl_jti").on(table.qrTokenJti),
]);

export type UnifiedVoucherLedgerEntry = typeof unifiedVoucherLedger.$inferSelect;

/**
 * Redeemed QR Token Registry — anti-replay store
 * Every short-lived QR token that has been successfully redeemed is stored here.
 * Before accepting any QR token, the backend checks this table (jti must not exist).
 */
export const redeemedQrTokens = pgTable("redeemed_qr_tokens", {
  jti: varchar("jti", { length: 64 }).primaryKey(), // JWT ID — unique per token
  voucherId: varchar("voucher_id").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  channel: varchar("channel", { length: 16 }).notNull(),
  stationId: varchar("station_id", { length: 100 }),
  actorUserId: varchar("actor_user_id", { length: 128 }),
  externalRef: varchar("external_ref", { length: 200 }),
  // Store token exp so cleanup jobs can prune old entries safely
  tokenExp: timestamp("token_exp", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_rqt_voucher").on(table.voucherId),
  index("idx_rqt_used").on(table.usedAt),
]);

export const userBlocks = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerUid: varchar("blocker_uid").notNull(),
  blockedUid: varchar("blocked_uid").notNull(),
  reason: varchar("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  blockerIdx: index("ub_blocker_idx").on(table.blockerUid),
  blockedIdx: index("ub_blocked_idx").on(table.blockedUid),
}));

export type RedeemedQrToken = typeof redeemedQrTokens.$inferSelect;
export type UserBlock = typeof userBlocks.$inferSelect;

// ============================================================
// PROVIDER OPERATIONS CONSOLE — 2026
// ============================================================

export const providerOperationalSettings = pgTable("provider_operational_settings", {
  providerUid:          varchar("provider_uid").primaryKey(),
  autoAccept:           boolean("auto_accept").notNull().default(false),
  instantBooking:       boolean("instant_booking").notNull().default(false),
  requireApproval:      boolean("require_approval").notNull().default(true),
  sameDayBookings:      boolean("same_day_bookings").notNull().default(true),
  weekendJobs:          boolean("weekend_jobs").notNull().default(true),
  nightJobs:            boolean("night_jobs").notNull().default(false),
  nightStartHour:       integer("night_start_hour").notNull().default(22),
  nightEndHour:         integer("night_end_hour").notNull().default(6),
  repeatCustomersOnly:  boolean("repeat_customers_only").notNull().default(false),
  newCustomerRequests:  boolean("new_customer_requests").notNull().default(true),
  notifInApp:           boolean("notif_in_app").notNull().default(true),
  notifPush:            boolean("notif_push").notNull().default(true),
  notifEmail:           boolean("notif_email").notNull().default(true),
  notifSmsEmergency:    boolean("notif_sms_emergency").notNull().default(true),
  aiSuggestions:        boolean("ai_suggestions").notNull().default(true),
  maxSimultaneous:      integer("max_simultaneous").notNull().default(1),
  maxJobsPerDay:        integer("max_jobs_per_day").notNull().default(5),
  bufferMinutes:        integer("buffer_minutes").notNull().default(30),
  travelRadiusKm:       integer("travel_radius_km").notNull().default(10),
  homeVisitsOnly:       boolean("home_visits_only").notNull().default(false),
  holidayMode:          boolean("holiday_mode").notNull().default(false),
  holidayStart:         timestamp("holiday_start"),
  holidayEnd:           timestamp("holiday_end"),
  emergencyUnavailable: boolean("emergency_unavailable").notNull().default(false),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export type ProviderOperationalSettings = typeof providerOperationalSettings.$inferSelect;
export type InsertProviderOperationalSettings = typeof providerOperationalSettings.$inferInsert;

export const providerBlockedList = pgTable("provider_blocked_list", {
  id:          serial("id").primaryKey(),
  providerUid: varchar("provider_uid").notNull(),
  blockedType: varchar("blocked_type").notNull(), // 'customer' | 'address' | 'pet'
  blockedRef:  varchar("blocked_ref").notNull(),   // UID / address / petId
  blockedName: varchar("blocked_name"),
  reason:      text("reason"),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  providerIdx: index("pbl_provider_idx").on(table.providerUid),
}));

export type ProviderBlockedEntry = typeof providerBlockedList.$inferSelect;

export const bookingActionsLog = pgTable("booking_actions_log", {
  id:         serial("id").primaryKey(),
  bookingId:  varchar("booking_id").notNull(),
  platform:   varchar("platform").notNull().default("walk_my_pet"),
  actorUid:   varchar("actor_uid").notNull(),
  actorRole:  varchar("actor_role").notNull(), // provider | customer | admin | system
  action:     varchar("action").notNull(),      // accepted | rejected | arrived | in_progress | completed | cancelled | unsafe_report | ...
  reasonCode: varchar("reason_code"),
  notes:      text("notes"),
  metadata:   jsonb("metadata"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  bookingIdx: index("bal_booking_idx").on(table.bookingId),
  actorIdx:   index("bal_actor_idx").on(table.actorUid),
}));

export type BookingActionEntry = typeof bookingActionsLog.$inferSelect;

export const providerSafetyNotes = pgTable("provider_safety_notes", {
  id:          serial("id").primaryKey(),
  providerUid: varchar("provider_uid").notNull(),
  subjectType: varchar("subject_type").notNull(), // 'customer' | 'pet'
  subjectId:   varchar("subject_id").notNull(),
  subjectName: varchar("subject_name"),
  notes:       text("notes").notNull(),
  riskLevel:   varchar("risk_level").notNull().default("low"), // 'low' | 'medium' | 'high'
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  providerIdx:    index("psn_provider_idx").on(table.providerUid),
  subjectUnique:  uniqueIndex("psn_provider_subject_unique").on(table.providerUid, table.subjectType, table.subjectId),
}));

// ─── Onboarding Milestones ────────────────────────────────────────────────────
export const onboardingMilestones = pgTable("onboarding_milestones", {
  id:          serial("id").primaryKey(),
  userId:      varchar("user_id").notNull(),
  role:        varchar("role").notNull(), // 'customer' | 'provider'
  milestone:   varchar("milestone").notNull(),
  // customer: pet_profile, pet_photo, address_added, first_booking, first_review_given, loyalty_joined
  // provider: profile_photo, service_area, id_verified, first_booking_accepted, first_session_complete, first_review_received
  completedAt: timestamp("completed_at").defaultNow(),
}, (table) => ({
  userMilestoneUnique: uniqueIndex("om_user_milestone_unique").on(table.userId, table.milestone),
  userIdx: index("om_user_idx").on(table.userId),
}));

export const insertOnboardingMilestoneSchema = createInsertSchema(onboardingMilestones).omit({ id: true, completedAt: true });
export type InsertOnboardingMilestone = z.infer<typeof insertOnboardingMilestoneSchema>;
export type OnboardingMilestone = typeof onboardingMilestones.$inferSelect;

// ─── Session Care Logs (pet health log after session) ─────────────────────────
export const sessionCareLogs = pgTable("session_care_logs", {
  id:            serial("id").primaryKey(),
  bookingId:     integer("booking_id").notNull(),
  petId:         integer("pet_id"),
  providerUid:   varchar("provider_uid").notNull(),
  mood:          varchar("mood").notNull(), // 'happy' | 'calm' | 'anxious' | 'tired'
  energyLevel:   integer("energy_level").notNull(), // 1-5
  ateWell:       boolean("ate_well").notNull().default(false),
  drankWater:    boolean("drank_water").notNull().default(false),
  usedToilet:    boolean("used_toilet").notNull().default(false),
  played:        boolean("played").notNull().default(false),
  notes:         varchar("notes", { length: 500 }),
  geminiSummary: text("gemini_summary"), // AI-generated customer-facing summary
  createdAt:     timestamp("created_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("scl_booking_idx").on(table.bookingId),
  petIdx:     index("scl_pet_idx").on(table.petId),
}));

export const insertSessionCareLogSchema = createInsertSchema(sessionCareLogs).omit({ id: true, geminiSummary: true, createdAt: true });
export type InsertSessionCareLog = z.infer<typeof insertSessionCareLogSchema>;
export type SessionCareLog = typeof sessionCareLogs.$inferSelect;

export type ProviderSafetyNote = typeof providerSafetyNotes.$inferSelect;

// ── Nayax Transaction Events (Monyx + all payment channels, Phase 2 webhook ingestion) ─────
export const nayaxTransactionEvents = pgTable("nayax_transaction_events", {
  id:                    serial("id").primaryKey(),
  externalTransactionId: varchar("external_transaction_id").unique().notNull(), // Dedup key
  machineId:             varchar("machine_id").notNull(),
  terminalId:            varchar("terminal_id"),
  stationId:             varchar("station_id"),
  paymentChannel:        varchar("payment_channel").notNull(), // petwash_wallet_qr | monyx_qr | tap_card | apple_pay | google_pay | unknown
  eventType:             varchar("event_type").notNull(),       // transaction | refund | cancel
  approvalStatus:        varchar("approval_status").notNull(), // approved | declined | cancelled | refunded
  amountGross:           decimal("amount_gross", { precision: 10, scale: 2 }).notNull(),
  amountNet:             decimal("amount_net",   { precision: 10, scale: 2 }),
  currency:              varchar("currency", { length: 3 }).default("ILS"),
  transactionTime:       timestamp("transaction_time").notNull(),
  customerPhoneHash:     varchar("customer_phone_hash"),           // SHA-256 hash, never raw phone
  monyxCustomerId:       varchar("monyx_customer_id"),             // Nayax-assigned consumer ID
  linkedPetwashUserId:   varchar("linked_petwash_user_id"),        // Firebase UID — set by identity mapping
  rawPayload:            jsonb("raw_payload").notNull(),            // Full webhook body stored as-is
  processedAt:           timestamp("processed_at"),
  processingStatus:      varchar("processing_status").default("pending"), // pending | processed | failed | skipped
  loyaltyAwarded:        boolean("loyalty_awarded").default(false),
  loyaltyPointsAwarded:  integer("loyalty_points_awarded").default(0),
  refundReversed:        boolean("refund_reversed").default(false),
  createdAt:             timestamp("created_at").defaultNow(),
}, (t) => ({
  externalIdIdx:    uniqueIndex("nte_external_id_idx").on(t.externalTransactionId),
  machineIdx:       index("nte_machine_idx").on(t.machineId),
  stationIdx:       index("nte_station_idx").on(t.stationId),
  userIdx:          index("nte_user_idx").on(t.linkedPetwashUserId),
  channelIdx:       index("nte_channel_idx").on(t.paymentChannel),
  statusIdx:        index("nte_status_idx").on(t.processingStatus),
  transactionTimeIdx: index("nte_tx_time_idx").on(t.transactionTime),
}));

export type NayaxTransactionEvent    = typeof nayaxTransactionEvents.$inferSelect;
export type InsertNayaxTransactionEvent = typeof nayaxTransactionEvents.$inferInsert;

// ── Walk Slot Holds (DB-persisted, survives server restarts) ──────────────────
export const walkSlotHolds = pgTable("walk_slot_holds", {
  id:              serial("id").primaryKey(),
  holdId:          varchar("hold_id").unique().notNull(),        // HOLD-XXXXXX
  slotId:          varchar("slot_id").notNull(),                 // walker:date:time key
  walkerId:        varchar("walker_id").notNull(),
  estimatedAmount: decimal("estimated_amount", { precision: 10, scale: 2 }).default("0"),
  expiresAt:       timestamp("expires_at").notNull(),
  createdAt:       timestamp("created_at").defaultNow(),
}, (t) => ({
  walkerIdx:  index("wsh_walker_idx").on(t.walkerId),
  expiryIdx:  index("wsh_expiry_idx").on(t.expiresAt),
}));

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  PETWASH PASS SYSTEM — Canonical wallet pass tables (2026)                  ║
// ║  Source of truth for Apple Wallet + Google Wallet pass issuance             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Canonical Pass Record ──────────────────────────────────────────────────────
// One row per user. Apple and Google passes are generated from this record.
// availableCreditIls is a *cosmetic* display field — balance authority lives in
// wallet_accounts (WalletEngine). Never trust the displayed credit for redemption.
export const petwashPassAccounts = pgTable("petwash_pass_accounts", {
  id:                  varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  passId:              text("pass_id").unique().notNull(),              // PW-4587-2043
  userId:              text("user_id").unique().notNull(),              // Firebase UID
  ownerName:           text("owner_name").notNull(),
  ownerEmail:          text("owner_email"),                            // For wallet link email delivery
  ownerPhone:          text("owner_phone"),                            // For wallet link SMS delivery
  primaryPetName:      text("primary_pet_name"),
  tier:                text("tier").notNull().default("PREMIUM"),       // PREMIUM | GOLD | BLACK | PARTNER
  availableCreditIls:  decimal("available_credit_ils", { precision: 12, scale: 2 }).notNull().default("0"),
  validUntil:          timestamp("valid_until", { withTimezone: true }),
  status:              text("status").notNull().default("ACTIVE"),      // ACTIVE | SUSPENDED | EXPIRED
  qrTokenVersion:      integer("qr_token_version").notNull().default(1),
  appleSerialNumber:   text("apple_serial_number").unique().notNull(),  // For pkpass serialNumber
  googleObjectId:      text("google_object_id").unique().notNull(),     // issuerId.passId
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:   index("ppa_user_idx").on(t.userId),
  passIdx:   index("ppa_pass_idx").on(t.passId),
  statusIdx: index("ppa_status_idx").on(t.status),
}));

export const insertPetwashPassAccountSchema = createInsertSchema(petwashPassAccounts).omit({ createdAt: true, updatedAt: true });
export type InsertPetwashPassAccount = z.infer<typeof insertPetwashPassAccountSchema>;
export type PetwashPassAccount = typeof petwashPassAccounts.$inferSelect;

// ── Pass Nonce Registry ───────────────────────────────────────────────────────
// Prevents replay attacks: each QR redeem token nonce is burned on first use.
// K9000 kiosk atomically marks a nonce as used here before triggering the machine.
export const petwashPassNonceRegistry = pgTable("petwash_pass_nonce_registry", {
  id:        varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nonce:     text("nonce").unique().notNull(),
  passId:    text("pass_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt:    timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nonceIdx:  index("ppnr_nonce_idx").on(t.nonce),
  passIdx:   index("ppnr_pass_idx").on(t.passId),
}));
export type PetwashPassNonce = typeof petwashPassNonceRegistry.$inferSelect;

// ── Pass Transaction Ledger ───────────────────────────────────────────────────
// Immutable double-entry ledger of all pass debits / credits.
// Used for audit trail, dispute resolution, and balance reconciliation.
export const petwashPassTransactions = pgTable("petwash_pass_transactions", {
  id:               varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  passId:           text("pass_id").notNull(),
  userId:           text("user_id").notNull(),
  sourceType:       text("source_type").notNull(),   // K9000 | ONLINE_BOOKING | TOPUP | GIFT | REFUND
  sourceRef:        text("source_ref"),               // bookingId, kioskId, etc.
  direction:        text("direction").notNull(),       // DEBIT | CREDIT
  amountIls:        decimal("amount_ils", { precision: 12, scale: 2 }).notNull(),
  balanceBeforeIls: decimal("balance_before_ils", { precision: 12, scale: 2 }).notNull(),
  balanceAfterIls:  decimal("balance_after_ils",  { precision: 12, scale: 2 }).notNull(),
  metadata:         text("metadata"),                 // JSON string: kiosk, bay, nonce, etc.
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  passIdx:   index("ppt_pass_idx").on(t.passId),
  userIdx:   index("ppt_user_idx").on(t.userId),
  timeIdx:   index("ppt_time_idx").on(t.createdAt),
}));
export type PetwashPassTransaction = typeof petwashPassTransactions.$inferSelect;

// ── Apple Wallet Device Registrations ─────────────────────────────────────────
// Persists device push tokens for the Apple Wallet pass update web service.
// Apple sends POST /v1/devices/:deviceId/registrations/:passTypeId/:serialNumber
// on each device that adds the pass — we store it here to send APNS pushes when
// the pass balance or tier changes.
export const appleWalletDeviceRegistrations = pgTable("apple_wallet_device_registrations", {
  id:                      varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceLibraryIdentifier: text("device_library_identifier").notNull(),
  pushToken:               text("push_token").notNull(),
  passTypeIdentifier:      text("pass_type_identifier").notNull(),
  serialNumber:            text("serial_number").notNull(),         // = passId (appleSerialNumber)
  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  serialIdx: index("awdr_serial_idx").on(t.serialNumber),
  deviceIdx: index("awdr_device_idx").on(t.deviceLibraryIdentifier),
  uniqueReg: uniqueIndex("awdr_unique_reg").on(t.deviceLibraryIdentifier, t.serialNumber),
}));

export type AppleWalletDeviceRegistration = typeof appleWalletDeviceRegistrations.$inferSelect;

// ── Pet Wash Stations (QR-activated wash machines) ───────────────────────────
export const washMachines = pgTable("wash_machines", {
  id:                     serial("id").primaryKey(),
  machineId:              varchar("machine_id", { length: 64 }).unique().notNull(),
  locationId:             varchar("location_id", { length: 64 }).notNull(),
  name:                   varchar("name", { length: 128 }).notNull(),
  nameHe:                 varchar("name_he", { length: 128 }),
  address:                text("address"),
  latitude:               decimal("latitude", { precision: 10, scale: 7 }),
  longitude:              decimal("longitude", { precision: 10, scale: 7 }),
  nayaxTerminalId:        varchar("nayax_terminal_id", { length: 64 }),
  nayaxMerchantId:        varchar("nayax_merchant_id", { length: 64 }),
  isActive:               boolean("is_active").default(true).notNull(),
  isOnline:               boolean("is_online").default(false).notNull(),
  isBusy:                 boolean("is_busy").default(false).notNull(),
  defaultProgramSeconds:  integer("default_program_seconds").default(900).notNull(),
  priceCents:             integer("price_cents").default(3500).notNull(),
  currency:               varchar("currency", { length: 8 }).default("ILS").notNull(),
  lastHeartbeat:          timestamp("last_heartbeat"),
  notes:                  text("notes"),
  createdAt:              timestamp("created_at").defaultNow().notNull(),
  updatedAt:              timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  machineIdIdx:  index("wm_machine_id_idx").on(t.machineId),
  locationIdx:   index("wm_location_idx").on(t.locationId),
  statusIdx:     index("wm_status_idx").on(t.isActive, t.isOnline),
}));

export type WashMachine = typeof washMachines.$inferSelect;
export type InsertWashMachine = typeof washMachines.$inferInsert;

// ── QR Activation Sessions ────────────────────────────────────────────────────
export const activationSessions = pgTable("activation_sessions", {
  id:               varchar("id", { length: 64 }).primaryKey(),
  userId:           varchar("user_id", { length: 255 }).notNull(),
  machineId:        varchar("machine_id", { length: 64 }).notNull(),
  locationId:       varchar("location_id", { length: 64 }).notNull(),
  // created → authorized → vend_sent → machine_ack → running → completed | failed
  status:           varchar("status", { length: 30 }).default("created").notNull(),
  sourceType:       varchar("source_type", { length: 30 }).default("dynamic_qr").notNull(), // static_sticker | dynamic_qr | admin_generated
  activationToken:  varchar("activation_token", { length: 128 }).notNull(),
  nayaxSessionId:   varchar("nayax_session_id", { length: 128 }),
  priceCents:       integer("price_cents").notNull(),
  currency:         varchar("currency", { length: 8 }).default("ILS").notNull(),
  qrNonce:          varchar("qr_nonce", { length: 64 }).notNull(),
  ip:               varchar("ip", { length: 64 }),
  userAgent:        text("user_agent"),
  vendSentAt:       timestamp("vend_sent_at"),
  machineAckedAt:   timestamp("machine_acked_at"),
  startedAt:        timestamp("started_at"),
  completedAt:      timestamp("completed_at"),
  failureReason:    text("failure_reason"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx:     index("as_user_idx").on(t.userId),
  machineIdx:  index("as_machine_idx").on(t.machineId),
  statusIdx:   index("as_status_idx").on(t.status),
  createdIdx:  index("as_created_idx").on(t.createdAt),
}));

// ── Activation Audit Log ──────────────────────────────────────────────────────
export const activationAuditLog = pgTable("activation_audit_log", {
  id:        serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  userId:    varchar("user_id", { length: 255 }).notNull(),
  machineId: varchar("machine_id", { length: 64 }).notNull(),
  event:     varchar("event", { length: 50 }).notNull(),
  status:    varchar("status", { length: 30 }),
  detail:    text("detail"),
  errorCode: varchar("error_code", { length: 50 }),
  ip:        varchar("ip", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  sessionIdx: index("aal_session_idx").on(t.sessionId),
  userIdx:    index("aal_user_idx").on(t.userId),
  machineIdx: index("aal_machine_idx").on(t.machineId),
  createdIdx: index("aal_created_idx").on(t.createdAt),
}));
export type ActivationAuditEntry = typeof activationAuditLog.$inferSelect;

export type ActivationSession = typeof activationSessions.$inferSelect;
export type InsertActivationSession = typeof activationSessions.$inferInsert;

// ── Quote Engine Tables ────────────────────────────────────────────────────────

// One row per pet attached to a booking_request — stores per-pet line items and snapshot
export const bookingRequestPets = pgTable("booking_request_pets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: integer("booking_request_id").notNull().references(() => bookingRequests.id, { onDelete: 'cascade' }),
  petId: integer("pet_id").references(() => pets.id),
  petName: varchar("pet_name", { length: 120 }).notNull(),
  petType: varchar("pet_type", { length: 40 }).notNull(), // dog | cat | other
  breed: varchar("breed", { length: 120 }),
  sizeCategory: varchar("size_category", { length: 40 }), // small | medium | large | giant
  ageYears: decimal("age_years", { precision: 4, scale: 1 }),
  weightKg: decimal("weight_kg", { precision: 6, scale: 2 }),
  gender: varchar("gender", { length: 20 }),
  specialNotes: text("special_notes"),
  requiresMedication: boolean("requires_medication").notNull().default(false),
  hasBehaviorFlag: boolean("has_behavior_flag").notNull().default(false),
  hasSpecialNeeds: boolean("has_special_needs").notNull().default(false),
  quantity: integer("quantity").notNull().default(1),
  basePriceCents: integer("base_price_cents").notNull().default(0),
  adjustmentPriceCents: integer("adjustment_price_cents").notNull().default(0),
  subtotalPriceCents: integer("subtotal_price_cents").notNull().default(0),
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  pricingSnapshot: jsonb("pricing_snapshot"), // exact inputs used at quote time
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  bookingRequestIdx: index("idx_brp_booking_request_id").on(table.bookingRequestId),
  petIdx: index("idx_brp_pet_id").on(table.petId),
}));

export const insertBookingRequestPetSchema = createInsertSchema(bookingRequestPets).omit({ id: true, createdAt: true, updatedAt: true });
export type BookingRequestPet = typeof bookingRequestPets.$inferSelect;
export type InsertBookingRequestPet = z.infer<typeof insertBookingRequestPetSchema>;

// One row per add-on selected in a booking — booking-level or pet-level scope
export const bookingRequestAddons = pgTable("booking_request_addons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: integer("booking_request_id").notNull().references(() => bookingRequests.id, { onDelete: 'cascade' }),
  bookingRequestPetId: varchar("booking_request_pet_id").references(() => bookingRequestPets.id, { onDelete: 'cascade' }),
  addonCode: varchar("addon_code", { length: 80 }).notNull(),
  addonName: varchar("addon_name", { length: 120 }).notNull(),
  addonScope: varchar("addon_scope", { length: 20 }).notNull(), // booking | pet
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  subtotalPriceCents: integer("subtotal_price_cents").notNull().default(0),
  currency: varchar("currency", { length: 8 }).notNull().default("ILS"),
  pricingSnapshot: jsonb("pricing_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  bookingRequestIdx: index("idx_bra_booking_request_id").on(table.bookingRequestId),
  petIdx: index("idx_bra_booking_request_pet_id").on(table.bookingRequestPetId),
  addonCodeIdx: index("idx_bra_addon_code").on(table.addonCode),
}));

export const insertBookingRequestAddonSchema = createInsertSchema(bookingRequestAddons).omit({ id: true, createdAt: true, updatedAt: true });
export type BookingRequestAddon = typeof bookingRequestAddons.$inferSelect;
export type InsertBookingRequestAddon = z.infer<typeof insertBookingRequestAddonSchema>;

// Audit log — every quote returned by the engine, keyed by pricing_version
export const quoteEngineLogs = pgTable("quote_engine_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingRequestId: integer("booking_request_id").references(() => bookingRequests.id),
  userId: varchar("user_id", { length: 255 }),
  providerId: varchar("provider_id", { length: 255 }),
  serviceType: varchar("service_type", { length: 60 }).notNull(),
  requestPayload: jsonb("request_payload").notNull(),
  responsePayload: jsonb("response_payload").notNull(),
  pricingVersion: varchar("pricing_version", { length: 40 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  bookingRequestIdx: index("idx_qel_booking_request_id").on(table.bookingRequestId),
  providerIdx: index("idx_qel_provider_id").on(table.providerId),
  createdAtIdx: index("idx_qel_created_at").on(table.createdAt),
}));

export type QuoteEngineLog = typeof quoteEngineLogs.$inferSelect;

// ── Rebook Triggers — smart re-engagement nudges ────────────────────────────
export const rebookTriggers = pgTable("rebook_triggers", {
  id:                 serial("id").primaryKey(),
  userId:             varchar("user_id").notNull(),
  triggerType:        varchar("trigger_type").notNull(), // 'post_completion' | 'weekly_rebook' | 'cancelled_recovery' | 'declined_recovery'
  requestId:          varchar("request_id"),
  providerId:         varchar("provider_id"),
  providerName:       varchar("provider_name"),
  serviceType:        varchar("service_type"),
  serviceDate:        timestamp("service_date"),
  scheduledAt:        timestamp("scheduled_at").notNull(),
  firedAt:            timestamp("fired_at"),
  notificationId:     varchar("notification_id"),
  openedAt:           timestamp("opened_at"),
  clickedAt:          timestamp("clicked_at"),
  rebookStartedAt:    timestamp("rebook_started_at"),
  rebookCompletedAt:  timestamp("rebook_completed_at"),
  suppressed:         boolean("suppressed").notNull().default(false),
  suppressionReason:  varchar("suppression_reason"),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx:        index("idx_rt_user_id").on(table.userId),
  scheduledIdx:   index("idx_rt_scheduled_at").on(table.scheduledAt),
  typeUserIdx:    index("idx_rt_trigger_type_user").on(table.triggerType, table.userId),
}));

export type RebookTrigger = typeof rebookTriggers.$inferSelect;
export type InsertRebookTrigger = typeof rebookTriggers.$inferInsert;

// ── Unified Payment Tables (pw_payments, pw_provider_payouts) ────────────────
export * from './schema-payments';

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6: Retention & Loyalty System
// All money in cents (agorot). Ledger is append-only. Balance on users is cache.
// ─────────────────────────────────────────────────────────────────────────────

// Loyalty Rules — admin-configurable reward config; all amounts in agorot
export const loyaltyRules = pgTable("loyalty_rules", {
  ruleKey:         text("rule_key").primaryKey(),
  enabled:         boolean("enabled").notNull().default(false),
  rewardIlsCents:  integer("reward_ils_cents").notNull().default(0),
  expiryDays:      integer("expiry_days"),          // null = never expires
  minBookingIls:   integer("min_booking_ils"),       // minimum booking value to qualify
  maxUsesPerUser:  integer("max_uses_per_user"),     // null = unlimited
  description:     text("description"),
  // Phase 6.11 — rollout guardrails
  armed:           boolean("armed").notNull().default(false), // processor skips unless true
  dailySendCap:    integer("daily_send_cap"),                 // max sends per day; null = unlimited
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
});
export type LoyaltyRule = typeof loyaltyRules.$inferSelect;

// Reward Claims — idempotency layer; unique_fingerprint prevents double-fire
export const rewardClaims = pgTable("reward_claims", {
  id:                serial("id").primaryKey(),
  userId:            varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  ruleKey:           text("rule_key").notNull().references(() => loyaltyRules.ruleKey, { onDelete: 'restrict' }),
  bookingId:         integer("booking_id"),
  referralId:        integer("referral_id"),
  uniqueFingerprint: text("unique_fingerprint").notNull().unique(), // e.g. "booking_2nd:user123" or "streak_walk_5:user123:5"
  createdAt:         timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_reward_claims_user").on(table.userId),
  index("idx_reward_claims_rule").on(table.ruleKey),
]);
export type RewardClaim = typeof rewardClaims.$inferSelect;

// Loyalty Ledger — append-only event log; never update rows, only insert
export const loyaltyLedger = pgTable("loyalty_ledger", {
  id:                 serial("id").primaryKey(),
  userId:             varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventType:          text("event_type").notNull(), // earn_booking | earn_streak | earn_referral | earn_winback | earn_welcome | redeem | expire | admin_adjust
  amountIlsCents:     integer("amount_ils_cents").notNull(), // positive = credit, negative = debit/redeem
  balanceAfterCents:  integer("balance_after_cents").notNull(), // running balance snapshot
  bookingId:          integer("booking_id"),
  referralId:         integer("referral_id"),
  rewardClaimId:      integer("reward_claim_id").references(() => rewardClaims.id),
  experimentVariant:  text("experiment_variant"),
  expiresAt:          timestamp("expires_at"), // null = never expires
  note:               text("note"),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_loyalty_ledger_user").on(table.userId),
  index("idx_loyalty_ledger_expires").on(table.expiresAt),
]);
export type LoyaltyLedgerEntry = typeof loyaltyLedger.$inferSelect;

// Referrals — tracks inviter/invitee pairs and reward status
export const referrals = pgTable("referrals", {
  id:                serial("id").primaryKey(),
  inviterUserId:     varchar("inviter_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeUserId:     varchar("invitee_user_id").references(() => users.id, { onDelete: 'set null' }),
  inviteeEmail:      text("invitee_email"),
  code:              varchar("code", { length: 8 }).notNull().unique(), // same as inviter's users.referral_code
  status:            text("status").notNull().default('pending'), // pending | signed_up | completed | expired | abused
  inviterCreditedAt: timestamp("inviter_credited_at"),
  inviteeCreditedAt: timestamp("invitee_credited_at"),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  completedAt:       timestamp("completed_at"),
}, (table) => [
  index("idx_referrals_inviter").on(table.inviterUserId),
  index("idx_referrals_code").on(table.code),
]);
export type Referral = typeof referrals.$inferSelect;

// Experiments — A/B test definitions
export const experiments = pgTable("experiments", {
  id:          serial("id").primaryKey(),
  key:         text("key").notNull().unique(),
  description: text("description"),
  variants:    jsonb("variants").notNull().default(sql`'[]'::jsonb`), // [{key,weight,label}]
  enabled:     boolean("enabled").notNull().default(false),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});
export type Experiment = typeof experiments.$inferSelect;

// Experiment Assignments — stable variant per user (hash-based, written async)
export const experimentAssignments = pgTable("experiment_assignments", {
  id:            serial("id").primaryKey(),
  experimentKey: text("experiment_key").notNull().references(() => experiments.key, { onDelete: 'cascade' }),
  userId:        varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  variant:       text("variant").notNull(),
  assignedAt:    timestamp("assigned_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_exp_assign_unique").on(table.experimentKey, table.userId),
]);
export type ExperimentAssignment = typeof experimentAssignments.$inferSelect;

// Experiment Events — conversion funnel tracking
export const experimentEvents = pgTable("experiment_events", {
  id:            serial("id").primaryKey(),
  experimentKey: text("experiment_key").notNull(),
  userId:        varchar("user_id").notNull(),
  variant:       text("variant").notNull(),
  event:         text("event").notNull(), // notification_sent | opened | clicked | booked | completed
  channel:       text("channel").notNull().default('inapp'), // Phase 6.12: inapp | sms | whatsapp
  bookingId:     integer("booking_id"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_exp_events_key_user").on(table.experimentKey, table.userId),
  index("idx_exp_events_channel").on(table.channel, table.createdAt),
]);
export type ExperimentEvent = typeof experimentEvents.$inferSelect;

// Winback Queue — scheduled re-engagement offers (one row per user+tier)
export const winbackQueue = pgTable("winback_queue", {
  id:                 serial("id").primaryKey(),
  userId:             varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  trigger:            text("trigger").notNull(), // 14d | 30d | 60d
  status:             text("status").notNull().default('pending'), // pending | sent | suppressed | converted
  lastBookingAt:      timestamp("last_booking_at"),
  scheduledAt:        timestamp("scheduled_at").notNull(),
  sentAt:             timestamp("sent_at"),
  convertedAt:        timestamp("converted_at"),
  experimentVariant:  text("experiment_variant"),
  // Phase 6.10 — row-level suppression markers (authoritative source = experiment_decisions)
  pausedAt:           timestamp("paused_at"),
  pauseReason:        text("pause_reason"), // 'low_sample' | 'losing' | 'admin' | 'control_group' | 'over_messaged'
  // Phase 6.12 — multi-channel escalation tracking
  smsEscalationAt:    timestamp("sms_escalation_at"),    // when to attempt SMS (sentAt + 6h)
  smsSentAt:          timestamp("sms_sent_at"),           // when SMS was actually dispatched
  whatsappEscalationAt: timestamp("whatsapp_escalation_at"), // when to attempt WhatsApp (smsSentAt + 24h)
  whatsappSentAt:     timestamp("whatsapp_sent_at"),      // when WhatsApp was dispatched
  createdAt:          timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_winback_user_trigger").on(table.userId, table.trigger),
  index("idx_winback_status").on(table.status, table.scheduledAt),
  index("idx_winback_sms_escalation").on(table.smsEscalationAt),
]);
export type WinbackQueueEntry = typeof winbackQueue.$inferSelect;

// Experiment Decisions — authoritative winner/pause state per experiment key
// One row per experimentKey; upserted on each evaluation run.
export const experimentDecisions = pgTable("experiment_decisions", {
  id:              serial("id").primaryKey(),
  experimentKey:   text("experiment_key").notNull().unique(),
  winnerVariant:   text("winner_variant"),                        // null = no winner yet
  pausedVariants:  text("paused_variants").array().notNull().default(sql`'{}'::text[]`),
  decidedAt:       timestamp("decided_at").notNull().defaultNow(),
  decidedBy:       text("decided_by").notNull().default('auto'), // 'auto' | 'auto-promote' | admin email
  confidencePct:   decimal("confidence_pct", { precision: 5, scale: 2 }),
  upliftPct:       decimal("uplift_pct",     { precision: 5, scale: 2 }),
  promotedAt:      timestamp("promoted_at"),
  promotionLocked: boolean("promotion_locked").notNull().default(false), // Phase 6.14: admin can freeze auto-promotion
  notes:           text("notes"),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_exp_decisions_key").on(table.experimentKey),
]);
export type ExperimentDecision = typeof experimentDecisions.$inferSelect;

// ─── Admin Action Reversals ──────────────────────────────────────────────────
// Immutable audit log of every admin-action reversal.
// One row per original txnId — UNIQUE constraint prevents double-reversal at DB level.
export const adminActionReversals = pgTable("admin_action_reversals", {
  id:               serial("id").primaryKey(),
  originalTxnId:    varchar("original_txn_id",    { length: 100 }).notNull().unique(),
  reversedByTxnId:  varchar("reversed_by_txn_id", { length: 100 }),
  adminUid:         varchar("admin_uid",           { length: 200 }).notNull(),
  actionType:       varchar("action_type",         { length: 50  }).notNull(),
  status:           varchar("status",              { length: 20  }).notNull().default("completed"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  completedAt:      timestamp("completed_at"),
  metadata:         jsonb("metadata").notNull().default({}),
});
export type AdminActionReversal       = typeof adminActionReversals.$inferSelect;
export type InsertAdminActionReversal = typeof adminActionReversals.$inferInsert;

// ─── Provider Payout Entries (Phase 2.9A) ────────────────────────────────────
// net_cents = gross_cents - floor(gross_cents * commission_rate_bps / 10000)
// Never modifies wallet_accounts directly — read-only accounting layer.
export const providerPayoutEntries = pgTable("provider_payout_entries", {
  id:                serial("id").primaryKey(),
  providerUid:       varchar("provider_uid",        { length: 200 }).notNull(),
  divisionCode:      varchar("division_code",        { length: 50  }).notNull(),
  bookingId:         varchar("booking_id",           { length: 100 }),
  grossCents:        integer("gross_cents").notNull().default(0),
  commissionRateBps: integer("commission_rate_bps").notNull().default(0),
  netCents:          integer("net_cents").notNull().default(0),
  status:            varchar("status",               { length: 30  }).notNull().default("earned"),
  payoutBatchId:     varchar("payout_batch_id",      { length: 100 }),
  createdAt:         timestamp("created_at").notNull().defaultNow(),
  paidAt:            timestamp("paid_at"),
  metadata:          jsonb("metadata").notNull().default({}),
});
export type ProviderPayoutEntry       = typeof providerPayoutEntries.$inferSelect;
export type InsertProviderPayoutEntry = typeof providerPayoutEntries.$inferInsert;

// ─── Dispute Cases (Phase 2.9C) ───────────────────────────────────────────────
// case_ref is server-generated.  notes is an append-only JSONB array.
// resolve is the ONLY path that sets resolved_at.
// 2.9C1: no money movement on resolve.
export const disputeCases = pgTable("dispute_cases", {
  id:                  serial("id").primaryKey(),
  caseRef:             varchar("case_ref",             { length: 40  }).unique().notNull(),
  bookingId:           varchar("booking_id",            { length: 120 }),
  complainantUid:      varchar("complainant_uid",       { length: 128 }).notNull(),
  complainantType:     varchar("complainant_type",      { length: 20  }).notNull().default("customer"),
  // 'customer' | 'provider'
  divisionCode:        varchar("division_code",         { length: 40  }),
  amountDisputedCents: integer("amount_disputed_cents").notNull().default(0),
  status:              varchar("status",                { length: 20  }).notNull().default("open"),
  // open | investigating | resolved | dismissed | escalated
  resolutionCents:     integer("resolution_cents"),
  resolutionType:      varchar("resolution_type",       { length: 30  }),
  // 'full_refund' | 'partial_refund' | 'no_action' | 'goodwill_credit' | 'dismissed'
  openedAt:            timestamp("opened_at",           { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:          timestamp("resolved_at",         { withTimezone: true }),
  assignedAdminUid:    varchar("assigned_admin_uid",    { length: 128 }),
  notes:               jsonb("notes").notNull().default(sql`'[]'::jsonb`),
  // [{authorUid, authorName, text, createdAt}]
  metadata:            jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt:           timestamp("created_at",          { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp("updated_at",          { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_dc_booking").on(table.bookingId),
  index("idx_dc_status").on(table.status),
  index("idx_dc_division").on(table.divisionCode),
  index("idx_dc_complainant").on(table.complainantUid),
  index("idx_dc_opened").on(table.openedAt),
  index("idx_dc_assigned").on(table.assignedAdminUid),
]);
export type DisputeCase       = typeof disputeCases.$inferSelect;
export type InsertDisputeCase = typeof disputeCases.$inferInsert;

// ─── Refund Approvals (Phase 2.9D) ───────────────────────────────────────────
// Rules (locked):
//   • always write row first, then branch on auto-approve vs pending
//   • auto-approved: execute immediately + mark approved
//   • pending: wait for second approver (cannot be the requester)
//   • approve is the only path that executes wallet money movement
//   • reject never mutates wallet state
//   • REFUND_AUTO_APPROVE_LIMIT_CENTS env, default 5000
export const refundApprovals = pgTable("refund_approvals", {
  id:                   serial("id").primaryKey(),
  refundRequestId:      varchar("refund_request_id",       { length: 80  }).unique().notNull(),
  requestedByUid:       varchar("requested_by_uid",        { length: 128 }).notNull(),
  amountCents:          integer("amount_cents").notNull().default(0),
  reason:               text("reason").notNull().default(""),
  status:               varchar("status",                  { length: 20  }).notNull().default("pending"),
  // pending | approved | rejected | auto_approved
  reviewedByUid:        varchar("reviewed_by_uid",         { length: 128 }),
  reviewedAt:           timestamp("reviewed_at",           { withTimezone: true }),
  linkedDisputeCaseRef: varchar("linked_dispute_case_ref", { length: 40  }),
  createdAt:            timestamp("created_at",            { withTimezone: true }).notNull().defaultNow(),
  bookingId:            varchar("booking_id",              { length: 120 }),
  bookingType:          varchar("booking_type",            { length: 30  }),
  metadata:             jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  index("idx_ra_status").on(table.status),
  index("idx_ra_requester").on(table.requestedByUid),
  index("idx_ra_dispute").on(table.linkedDisputeCaseRef),
  index("idx_ra_created").on(table.createdAt),
]);
export type RefundApproval       = typeof refundApprovals.$inferSelect;
export type InsertRefundApproval = typeof refundApprovals.$inferInsert;

// ─── Phase 3.4: Dispute Cases routing columns ─────────────────────────────────
// These columns are added to dispute_cases via ALTER TABLE in the DB; reflected here
// as a separate extension type for reference (not a separate table).
// routedQueue, routedToUid, routingReason, lastRoutedAt are added to disputeCases via SQL.

// ─── Cash Forecast Snapshots (Phase 3.4A) ─────────────────────────────────────
export const cashForecastSnapshots = pgTable("cash_forecast_snapshots", {
  id:           serial("id").primaryKey(),
  generatedAt:  timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  horizonDays:  integer("horizon_days").notNull(),
  forecastJson: jsonb("forecast_json").notNull().default(sql`'{}'::jsonb`),
  createdBy:    varchar("created_by", { length: 64 }).notNull().default("system"),
});
export type CashForecastSnapshot       = typeof cashForecastSnapshots.$inferSelect;
export type InsertCashForecastSnapshot = typeof cashForecastSnapshots.$inferInsert;

// ─── Payout Schedules (Phase 3.4B) ────────────────────────────────────────────
export const payoutSchedules = pgTable("payout_schedules", {
  id:               serial("id").primaryKey(),
  divisionCode:     varchar("division_code", { length: 40 }),
  cadence:          varchar("cadence", { length: 20 }).notNull(), // daily | weekly | fortnightly | monthly
  dayOfWeek:        integer("day_of_week"),
  dayOfMonth:       integer("day_of_month"),
  enabled:          boolean("enabled").notNull().default(true),
  minBatchNetCents: integer("min_batch_net_cents").notNull().default(0),
  notes:            text("notes").notNull().default(""),
  lastRunAt:        timestamp("last_run_at", { withTimezone: true }),
  createdByUid:     varchar("created_by_uid", { length: 128 }).notNull(),
  createdAt:        timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
});
export type PayoutSchedule       = typeof payoutSchedules.$inferSelect;
export type InsertPayoutSchedule = typeof payoutSchedules.$inferInsert;

export const payoutScheduleRuns = pgTable("payout_schedule_runs", {
  id:         serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull(),
  ranAt:      timestamp("ran_at",    { withTimezone: true }).notNull().defaultNow(),
  result:     varchar("result",      { length: 20 }).notNull().default("created"), // created | skipped | failed
  batchId:    varchar("batch_id",    { length: 64 }),
  summary:    jsonb("summary").notNull().default(sql`'{}'::jsonb`),
});
export type PayoutScheduleRun       = typeof payoutScheduleRuns.$inferSelect;
export type InsertPayoutScheduleRun = typeof payoutScheduleRuns.$inferInsert;

// ─── Dispute Routing Rules (Phase 3.4C) ───────────────────────────────────────
export const disputeRoutingRules = pgTable("dispute_routing_rules", {
  id:             serial("id").primaryKey(),
  divisionCode:   varchar("division_code",  { length: 40  }),
  minAmountCents: integer("min_amount_cents").notNull().default(0),
  maxAmountCents: integer("max_amount_cents"),
  assignToUid:    varchar("assign_to_uid",  { length: 128 }),
  queueName:      varchar("queue_name",     { length: 64  }),
  priority:       integer("priority").notNull().default(100),
  enabled:        boolean("enabled").notNull().default(true),
});
export type DisputeRoutingRule       = typeof disputeRoutingRules.$inferSelect;
export type InsertDisputeRoutingRule = typeof disputeRoutingRules.$inferInsert;

// ─── Executive KPI Snapshots (Phase 3.4E) ─────────────────────────────────────
export const executiveKpiSnapshots = pgTable("executive_kpi_snapshots", {
  id:           serial("id").primaryKey(),
  snapshotDate: varchar("snapshot_date",  { length: 12 }).notNull(), // YYYY-MM-DD or YYYY-MM or YYYY-Www
  snapshotType: varchar("snapshot_type",  { length: 20 }).notNull().default("daily"), // daily | weekly | monthly
  kpiJson:      jsonb("kpi_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:    timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
});
export type ExecutiveKpiSnapshot       = typeof executiveKpiSnapshots.$inferSelect;
export type InsertExecutiveKpiSnapshot = typeof executiveKpiSnapshots.$inferInsert;

// ─── Finance Archive Policies (Phase 3.4F) ────────────────────────────────────
export const financeArchivePolicies = pgTable("finance_archive_policies", {
  id:               serial("id").primaryKey(),
  entityType:       varchar("entity_type",         { length: 64 }).notNull(),
  retentionDays:    integer("retention_days").notNull(),
  archiveAfterDays: integer("archive_after_days").notNull(),
  enabled:          boolean("enabled").notNull().default(true),
  notes:            text("notes").notNull().default(""),
});
export type FinanceArchivePolicy       = typeof financeArchivePolicies.$inferSelect;
export type InsertFinanceArchivePolicy = typeof financeArchivePolicies.$inferInsert;

export const financeArchiveRuns = pgTable("finance_archive_runs", {
  id:         serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  ranAt:      timestamp("ran_at",    { withTimezone: true }).notNull().defaultNow(),
  movedCount: integer("moved_count").notNull().default(0),
  status:     varchar("status",      { length: 20 }).notNull().default("completed"), // completed | failed | dry_run
  summary:    jsonb("summary").notNull().default(sql`'{}'::jsonb`),
});
export type FinanceArchiveRun       = typeof financeArchiveRuns.$inferSelect;
export type InsertFinanceArchiveRun = typeof financeArchiveRuns.$inferInsert;

// ─── Finance Replay Runs (Phase 3.4G) ─────────────────────────────────────────
export const financeReplayRuns = pgTable("finance_replay_runs", {
  id:           serial("id").primaryKey(),
  replayType:   varchar("replay_type", { length: 40 }).notNull(),
  startedAt:    timestamp("started_at",   { withTimezone: true }).notNull().defaultNow(),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
  status:       varchar("status",         { length: 20 }).notNull().default("running"), // running | completed | failed
  dryRun:       boolean("dry_run").notNull().default(true),
  findingsJson: jsonb("findings_json").notNull().default(sql`'{}'::jsonb`),
  appliedCount: integer("applied_count").notNull().default(0),
  initiatedBy:  varchar("initiated_by",  { length: 128 }),
});
export type FinanceReplayRun       = typeof financeReplayRuns.$inferSelect;
export type InsertFinanceReplayRun = typeof financeReplayRuns.$inferInsert;

// ─── Cash Forecast Accuracy (Phase 3.5A) ──────────────────────────────────────
export const cashForecastAccuracy = pgTable("cash_forecast_accuracy", {
  id:                       serial("id").primaryKey(),
  forecastGeneratedAt:      timestamp("forecast_generated_at", { withTimezone: true }).notNull(),
  horizonDays:              integer("horizon_days").notNull(),
  targetDate:               varchar("target_date",            { length: 12 }).notNull(),
  forecastPayoutsCents:     integer("forecast_payouts_cents").notNull().default(0),
  actualPayoutsCents:       integer("actual_payouts_cents").notNull().default(0),
  forecastRefundsCents:     integer("forecast_refunds_cents").notNull().default(0),
  actualRefundsCents:       integer("actual_refunds_cents").notNull().default(0),
  forecastVatCents:         integer("forecast_vat_cents").notNull().default(0),
  actualVatCents:           integer("actual_vat_cents").notNull().default(0),
  forecastNetCashNeedCents: integer("forecast_net_cash_need_cents").notNull().default(0),
  actualNetCashNeedCents:   integer("actual_net_cash_need_cents").notNull().default(0),
  absErrorCents:            integer("abs_error_cents").notNull().default(0),
  pctError:                 numeric("pct_error", { precision: 8, scale: 2 }).notNull().default("0"),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_cfa_target_date").on(table.targetDate),
  index("idx_cfa_horizon").on(table.horizonDays),
  index("idx_cfa_generated").on(table.forecastGeneratedAt),
]);
export type CashForecastAccuracy       = typeof cashForecastAccuracy.$inferSelect;
export type InsertCashForecastAccuracy = typeof cashForecastAccuracy.$inferInsert;

// ─── Payout Release Approvals (Phase 3.5B) ────────────────────────────────────
export const payoutReleaseApprovals = pgTable("payout_release_approvals", {
  id:              serial("id").primaryKey(),
  batchId:         varchar("batch_id",          { length: 64  }).notNull(),
  requestedByUid:  varchar("requested_by_uid",  { length: 128 }).notNull(),
  amountCents:     integer("amount_cents").notNull().default(0),
  reason:          text("reason").notNull().default(""),
  status:          varchar("status",            { length: 20  }).notNull().default("pending"), // pending | approved | rejected | auto_approved
  reviewedByUid:   varchar("reviewed_by_uid",   { length: 128 }),
  reviewedAt:      timestamp("reviewed_at",     { withTimezone: true }),
  createdAt:       timestamp("created_at",      { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_pra_batch").on(table.batchId),
  index("idx_pra_status").on(table.status),
  index("idx_pra_requester").on(table.requestedByUid),
]);
export type PayoutReleaseApproval       = typeof payoutReleaseApprovals.$inferSelect;
export type InsertPayoutReleaseApproval = typeof payoutReleaseApprovals.$inferInsert;

// ─── Finance Control Subscriptions (Phase 3.5D) ───────────────────────────────
export const financeControlSubscriptions = pgTable("finance_control_subscriptions", {
  id:              serial("id").primaryKey(),
  userUid:         varchar("user_uid",         { length: 128 }).notNull(),
  signalCode:      varchar("signal_code",      { length: 64  }).notNull(),
  deliveryChannel: varchar("delivery_channel", { length: 20  }).notNull().default("email"), // email | in_app
  enabled:         boolean("enabled").notNull().default(true),
  createdAt:       timestamp("created_at",     { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_fcs_user").on(table.userUid),
  index("idx_fcs_signal").on(table.signalCode),
]);
export type FinanceControlSubscription       = typeof financeControlSubscriptions.$inferSelect;
export type InsertFinanceControlSubscription = typeof financeControlSubscriptions.$inferInsert;

// ─── Executive Digest Log (Phase 3.5E) ────────────────────────────────────────
export const executiveDigestLog = pgTable("executive_digest_log", {
  id:          serial("id").primaryKey(),
  periodStart: varchar("period_start",  { length: 12 }).notNull(),
  periodEnd:   varchar("period_end",    { length: 12 }).notNull(),
  sentTo:      varchar("sent_to",       { length: 255 }).notNull(),
  status:      varchar("status",        { length: 20  }).notNull().default("sent"), // sent | failed | skipped
  summaryJson: jsonb("summary_json").notNull().default(sql`'{}'::jsonb`),
  sentAt:      timestamp("sent_at",     { withTimezone: true }).notNull().defaultNow(),
  errorDetail: text("error_detail").notNull().default(""),
});
export type ExecutiveDigestLogEntry       = typeof executiveDigestLog.$inferSelect;
export type InsertExecutiveDigestLogEntry = typeof executiveDigestLog.$inferInsert;

// ─── Finance Archive Artifacts (Phase 3.5F) ───────────────────────────────────
export const financeArchiveArtifacts = pgTable("finance_archive_artifacts", {
  id:             serial("id").primaryKey(),
  runId:          integer("run_id").notNull(),
  entityType:     varchar("entity_type",  { length: 64  }).notNull(),
  storageRef:     varchar("storage_ref",  { length: 255 }).notNull(),
  archivedCount:  integer("archived_count").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type FinanceArchiveArtifact       = typeof financeArchiveArtifacts.$inferSelect;
export type InsertFinanceArchiveArtifact = typeof financeArchiveArtifacts.$inferInsert;

// ─── Finance Replay Approvals (Phase 3.5G) ────────────────────────────────────
export const financeReplayApprovals = pgTable("finance_replay_approvals", {
  id:             serial("id").primaryKey(),
  replayRunId:    integer("replay_run_id").notNull(),
  requestedByUid: varchar("requested_by_uid", { length: 128 }).notNull(),
  reason:         text("reason").notNull().default(""),
  status:         varchar("status",           { length: 20  }).notNull().default("pending"), // pending | approved | rejected
  approvedByUid:  varchar("approved_by_uid",  { length: 128 }),
  approvedAt:     timestamp("approved_at",    { withTimezone: true }),
  createdAt:      timestamp("created_at",     { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_fra_run").on(table.replayRunId),
  index("idx_fra_status").on(table.status),
]);
export type FinanceReplayApproval       = typeof financeReplayApprovals.$inferSelect;
export type InsertFinanceReplayApproval = typeof financeReplayApprovals.$inferInsert;

// ─── Finance Replay Reports (Phase 3.5G) ──────────────────────────────────────
export const financeReplayReports = pgTable("finance_replay_reports", {
  id:          serial("id").primaryKey(),
  replayRunId: integer("replay_run_id").notNull(),
  reportJson:  jsonb("report_json").notNull().default(sql`'{}'::jsonb`),
  signature:   varchar("signature",   { length: 255 }).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type FinanceReplayReport       = typeof financeReplayReports.$inferSelect;
export type InsertFinanceReplayReport = typeof financeReplayReports.$inferInsert;

// ── Phase 3.6 ────────────────────────────────────────────────────────────────

// 3.6A — Forecast Model Weights
export const cashForecastWeights = pgTable("cash_forecast_weights", {
  id:            serial("id").primaryKey(),
  horizonDays:   integer("horizon_days").notNull(),
  factorName:    varchar("factor_name",    { length: 64 }).notNull(),
  weight:        numeric("weight",         { precision: 8, scale: 4 }).notNull().default("1"),
  enabled:       boolean("enabled").notNull().default(true),
  updatedByUid:  varchar("updated_by_uid", { length: 128 }),
  updatedAt:     timestamp("updated_at",   { withTimezone: true }).notNull().defaultNow(),
});
export type CashForecastWeight       = typeof cashForecastWeights.$inferSelect;
export type InsertCashForecastWeight = typeof cashForecastWeights.$inferInsert;

// 3.6B — Payout Release Policies
export const payoutReleasePolicies = pgTable("payout_release_policies", {
  id:                    serial("id").primaryKey(),
  divisionCode:          varchar("division_code",   { length: 40 }),
  minAmountCents:        integer("min_amount_cents").notNull().default(0),
  maxAmountCents:        integer("max_amount_cents"),
  requiresSecondApproval: boolean("requires_second_approval").notNull().default(true),
  allowedAutoRelease:    boolean("allowed_auto_release").notNull().default(false),
  enabled:               boolean("enabled").notNull().default(true),
  notes:                 text("notes").notNull().default(""),
  updatedByUid:          varchar("updated_by_uid",  { length: 128 }),
  updatedAt:             timestamp("updated_at",     { withTimezone: true }).notNull().defaultNow(),
});
export type PayoutReleasePolicy       = typeof payoutReleasePolicies.$inferSelect;
export type InsertPayoutReleasePolicy = typeof payoutReleasePolicies.$inferInsert;

// 3.6C — Finance Digest Preferences
export const financeDigestPreferences = pgTable("finance_digest_preferences", {
  id:                      serial("id").primaryKey(),
  userUid:                 varchar("user_uid",    { length: 128 }).notNull(),
  digestType:              varchar("digest_type", { length: 32 }).notNull(),
  minSeverity:             varchar("min_severity",{ length: 16 }).notNull().default("warning"),
  includeControlCenter:    boolean("include_control_center").notNull().default(true),
  includeExecutiveSummary: boolean("include_executive_summary").notNull().default(false),
  enabled:                 boolean("enabled").notNull().default(true),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type FinanceDigestPreference       = typeof financeDigestPreferences.$inferSelect;
export type InsertFinanceDigestPreference = typeof financeDigestPreferences.$inferInsert;

// 3.6D — Archive Retrievals
export const financeArchiveRetrievals = pgTable("finance_archive_retrievals", {
  id:              serial("id").primaryKey(),
  artifactId:      integer("artifact_id").notNull(),
  requestedByUid:  varchar("requested_by_uid", { length: 128 }).notNull(),
  reason:          text("reason").notNull().default(""),
  status:          varchar("status",            { length: 20 }).notNull().default("pending"),
  retrievalRef:    varchar("retrieval_ref",     { length: 255 }),
  requestedAt:     timestamp("requested_at",    { withTimezone: true }).notNull().defaultNow(),
  completedAt:     timestamp("completed_at",    { withTimezone: true }),
  errorDetail:     text("error_detail").notNull().default(""),
});
export type FinanceArchiveRetrieval       = typeof financeArchiveRetrievals.$inferSelect;
export type InsertFinanceArchiveRetrieval = typeof financeArchiveRetrievals.$inferInsert;

// 3.6E — Replay Diffs
export const financeReplayDiffs = pgTable("finance_replay_diffs", {
  id:           serial("id").primaryKey(),
  replayRunId:  integer("replay_run_id").notNull(),
  entityType:   varchar("entity_type",  { length: 64 }).notNull(),
  entityId:     varchar("entity_id",    { length: 128 }).notNull(),
  before:       jsonb("before").notNull().default(sql`'{}'::jsonb`),
  after:        jsonb("after").notNull().default(sql`'{}'::jsonb`),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type FinanceReplayDiff       = typeof financeReplayDiffs.$inferSelect;
export type InsertFinanceReplayDiff = typeof financeReplayDiffs.$inferInsert;

// 3.6F — Finance Policy Rules
export const financePolicyRules = pgTable("finance_policy_rules", {
  id:            serial("id").primaryKey(),
  policyKey:     varchar("policy_key",    { length: 64 }).notNull().unique(),
  policyScope:   varchar("policy_scope",  { length: 32 }).notNull(),
  divisionCode:  varchar("division_code", { length: 40 }),
  valueJson:     jsonb("value_json").notNull().default(sql`'{}'::jsonb`),
  enabled:       boolean("enabled").notNull().default(true),
  updatedByUid:  varchar("updated_by_uid",{ length: 128 }),
  updatedAt:     timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow(),
});
export type FinancePolicyRule       = typeof financePolicyRules.$inferSelect;
export type InsertFinancePolicyRule = typeof financePolicyRules.$inferInsert;

// 3.6G — Period Close Packs
export const periodClosePacks = pgTable("period_close_packs", {
  id:          serial("id").primaryKey(),
  periodType:  varchar("period_type", { length: 16 }).notNull(),
  periodKey:   varchar("period_key",  { length: 16 }).notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  packJson:    jsonb("pack_json").notNull().default(sql`'{}'::jsonb`),
  signature:   varchar("signature",   { length: 255 }).notNull(),
});
export type PeriodClosePack       = typeof periodClosePacks.$inferSelect;
export type InsertPeriodClosePack = typeof periodClosePacks.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.7 — Finance Decision Support Layer
// ─────────────────────────────────────────────────────────────────────────────

// 3.7A — Policy Simulations
export const policySimulations = pgTable("policy_simulations", {
  id:                serial("id").primaryKey(),
  simulatedByUid:    varchar("simulated_by_uid",  { length: 128 }).notNull(),
  policyKey:         varchar("policy_key",          { length: 64 }).notNull(),
  originalValue:     text("original_value"),
  proposedValue:     text("proposed_value").notNull(),
  divisionCode:      varchar("division_code",       { length: 40 }),
  simulationContext: jsonb("simulation_context").notNull().default(sql`'{}'::jsonb`),
  outcomeSummary:    text("outcome_summary"),
  outcomeDetail:     jsonb("outcome_detail").notNull().default(sql`'{}'::jsonb`),
  affectedEntities:  integer("affected_entities").notNull().default(0),
  riskScore:         integer("risk_score").notNull().default(0),
  wouldSaveCents:    integer("would_save_cents").notNull().default(0),
  status:            varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PolicySimulation       = typeof policySimulations.$inferSelect;
export type InsertPolicySimulation = typeof policySimulations.$inferInsert;

// 3.7B — Approval Chains
export const approvalChains = pgTable("approval_chains", {
  id:               serial("id").primaryKey(),
  chainName:        varchar("chain_name",      { length: 128 }).notNull(),
  triggerType:      varchar("trigger_type",    { length: 64 }).notNull(),
  divisionCode:     varchar("division_code",   { length: 40 }),
  minAmountCents:   integer("min_amount_cents").notNull().default(0),
  maxAmountCents:   integer("max_amount_cents"),
  isActive:         boolean("is_active").notNull().default(true),
  escalationHours:  integer("escalation_hours").notNull().default(48),
  notes:            text("notes"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApprovalChain       = typeof approvalChains.$inferSelect;
export type InsertApprovalChain = typeof approvalChains.$inferInsert;

// 3.7B — Approval Chain Steps
export const approvalChainSteps = pgTable("approval_chain_steps", {
  id:             serial("id").primaryKey(),
  chainId:        integer("chain_id").notNull().references(() => approvalChains.id),
  stepOrder:      integer("step_order").notNull(),
  requiredRole:   varchar("required_role",  { length: 64 }).notNull(),
  isRequired:     boolean("is_required").notNull().default(true),
  timeoutHours:   integer("timeout_hours").notNull().default(24),
  escalateToRole: varchar("escalate_to_role", { length: 64 }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApprovalChainStep       = typeof approvalChainSteps.$inferSelect;
export type InsertApprovalChainStep = typeof approvalChainSteps.$inferInsert;

// 3.7B — Approval Requests
export const approvalRequests = pgTable("approval_requests", {
  id:               serial("id").primaryKey(),
  chainId:          integer("chain_id").references(() => approvalChains.id),
  entityType:       varchar("entity_type", { length: 64 }).notNull(),
  entityId:         varchar("entity_id",   { length: 128 }).notNull(),
  requestedByUid:   varchar("requested_by_uid", { length: 128 }).notNull(),
  currentStepOrder: integer("current_step_order").notNull().default(1),
  status:           varchar("status", { length: 20 }).notNull().default("pending"),
  amountCents:      integer("amount_cents"),
  divisionCode:     varchar("division_code", { length: 40 }),
  context:          jsonb("context").notNull().default(sql`'{}'::jsonb`),
  completedAt:      timestamp("completed_at", { withTimezone: true }),
  createdAt:        timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
});
export type ApprovalRequest       = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = typeof approvalRequests.$inferInsert;

// 3.7B — Approval Request Actions
export const approvalRequestActions = pgTable("approval_request_actions", {
  id:          serial("id").primaryKey(),
  requestId:   integer("request_id").notNull().references(() => approvalRequests.id),
  stepOrder:   integer("step_order").notNull(),
  actorUid:    varchar("actor_uid", { length: 128 }).notNull(),
  action:      varchar("action",    { length: 20 }).notNull(),
  comment:     text("comment"),
  actedAt:     timestamp("acted_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ApprovalRequestAction       = typeof approvalRequestActions.$inferSelect;
export type InsertApprovalRequestAction = typeof approvalRequestActions.$inferInsert;

// 3.7C — Forecast Scenarios
export const forecastScenarios = pgTable("forecast_scenarios", {
  id:                           serial("id").primaryKey(),
  scenarioName:                 varchar("scenario_name", { length: 128 }).notNull(),
  description:                  text("description"),
  baseHorizonDays:              integer("base_horizon_days").notNull().default(30),
  weightOverrides:              jsonb("weight_overrides").notNull().default(sql`'{}'::jsonb`),
  revenueAdjustmentPct:         numeric("revenue_adjustment_pct", { precision: 8, scale: 4 }).notNull().default('0'),
  bookingVolumeAdjustmentPct:   numeric("booking_volume_adjustment_pct", { precision: 8, scale: 4 }).notNull().default('0'),
  divisionCode:                 varchar("division_code", { length: 40 }),
  lastRunAt:                    timestamp("last_run_at", { withTimezone: true }),
  lastRunResult:                jsonb("last_run_result"),
  isActive:                     boolean("is_active").notNull().default(true),
  createdByUid:                 varchar("created_by_uid", { length: 128 }),
  createdAt:                    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ForecastScenario       = typeof forecastScenarios.$inferSelect;
export type InsertForecastScenario = typeof forecastScenarios.$inferInsert;

// 3.7D — Exception Suggestions
export const exceptionSuggestions = pgTable("exception_suggestions", {
  id:               serial("id").primaryKey(),
  exceptionType:    varchar("exception_type", { length: 64 }).notNull(),
  entityType:       varchar("entity_type",    { length: 64 }).notNull(),
  entityId:         varchar("entity_id",      { length: 128 }).notNull(),
  exceptionDetail:  jsonb("exception_detail").notNull().default(sql`'{}'::jsonb`),
  suggestedAction:  text("suggested_action").notNull(),
  suggestionDetail: jsonb("suggestion_detail").notNull().default(sql`'{}'::jsonb`),
  confidenceScore:  integer("confidence_score").notNull().default(0),
  autoApplicable:   boolean("auto_applicable").notNull().default(false),
  status:           varchar("status", { length: 20 }).notNull().default("open"),
  appliedByUid:     varchar("applied_by_uid", { length: 128 }),
  appliedAt:        timestamp("applied_at",   { withTimezone: true }),
  generatedAt:      timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ExceptionSuggestion       = typeof exceptionSuggestions.$inferSelect;
export type InsertExceptionSuggestion = typeof exceptionSuggestions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.8 — ORCHESTRATION, PROMOTION & TRUST AT SCALE
// ─────────────────────────────────────────────────────────────────────────────

// 3.8B — Policy Promotions
export const policyPromotions = pgTable("policy_promotions", {
  id:                 serial("id").primaryKey(),
  simulationId:       integer("simulation_id").notNull(),
  policyKey:          varchar("policy_key",          { length: 64  }).notNull(),
  proposedValueJson:  jsonb("proposed_value_json").notNull().default(sql`'{}'::jsonb`),
  promotedByUid:      varchar("promoted_by_uid",     { length: 128 }).notNull(),
  promotedAt:         timestamp("promoted_at",        { withTimezone: true }).notNull().defaultNow(),
  rollbackValueJson:  jsonb("rollback_value_json").notNull().default(sql`'{}'::jsonb`),
  notes:              text("notes").notNull().default(''),
});
export type PolicyPromotion       = typeof policyPromotions.$inferSelect;
export type InsertPolicyPromotion = typeof policyPromotions.$inferInsert;

// 3.8C — Forecast Backtests
export const forecastBacktests = pgTable("forecast_backtests", {
  id:           serial("id").primaryKey(),
  scenarioId:   integer("scenario_id"),
  horizonDays:  integer("horizon_days").notNull(),
  periodStart:  date("period_start").notNull(),
  periodEnd:    date("period_end").notNull(),
  forecastJson: jsonb("forecast_json").notNull().default(sql`'{}'::jsonb`),
  actualJson:   jsonb("actual_json").notNull().default(sql`'{}'::jsonb`),
  errorJson:    jsonb("error_json").notNull().default(sql`'{}'::jsonb`),
  score:        numeric("score", { precision: 8, scale: 2 }).notNull().default('0'),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ForecastBacktest       = typeof forecastBacktests.$inferSelect;
export type InsertForecastBacktest = typeof forecastBacktests.$inferInsert;

// 3.8D — Assistant Action Runs
export const assistantActionRuns = pgTable("assistant_action_runs", {
  id:                serial("id").primaryKey(),
  assistantContext:  varchar("assistant_context",  { length: 64  }).notNull(),
  suggestedAction:   varchar("suggested_action",   { length: 64  }).notNull(),
  targetEntityType:  varchar("target_entity_type", { length: 64  }),
  targetEntityId:    varchar("target_entity_id",   { length: 128 }),
  requestedByUid:    varchar("requested_by_uid",   { length: 128 }).notNull(),
  status:            varchar("status",              { length: 24  }).notNull().default('suggested'),
  resultJson:        jsonb("result_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:         timestamp("created_at",        { withTimezone: true }).notNull().defaultNow(),
});
export type AssistantActionRun       = typeof assistantActionRuns.$inferSelect;
export type InsertAssistantActionRun = typeof assistantActionRuns.$inferInsert;

// 3.8E — Governance Pack Log
export const governancePackLog = pgTable("governance_pack_log", {
  id:          serial("id").primaryKey(),
  packType:    varchar("pack_type",  { length: 32  }).notNull(),
  periodKey:   varchar("period_key", { length: 32  }).notNull(),
  sentTo:      jsonb("sent_to").notNull().default(sql`'[]'::jsonb`),
  summaryJson: jsonb("summary_json").notNull().default(sql`'{}'::jsonb`),
  signature:   varchar("signature",  { length: 255 }).notNull(),
  sentAt:      timestamp("sent_at",  { withTimezone: true }).notNull().defaultNow(),
  status:      varchar("status",     { length: 20  }).notNull().default('sent'),
  errorDetail: text("error_detail").notNull().default(''),
});
export type GovernancePackLog       = typeof governancePackLog.$inferSelect;
export type InsertGovernancePackLog = typeof governancePackLog.$inferInsert;

// 3.8F — Finance Playbook Links
export const financePlaybookLinks = pgTable("finance_playbook_links", {
  id:         serial("id").primaryKey(),
  surfaceKey: varchar("surface_key", { length: 64  }).notNull(),
  title:      varchar("title",       { length: 255 }).notNull(),
  docUrl:     text("doc_url").notNull(),
  description:text("description").notNull().default(''),
  enabled:    boolean("enabled").notNull().default(true),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type FinancePlaybookLink       = typeof financePlaybookLinks.$inferSelect;
export type InsertFinancePlaybookLink = typeof financePlaybookLinks.$inferInsert;

// 3.8G — Finance Entities
export const financeEntities = pgTable("finance_entities", {
  id:           serial("id").primaryKey(),
  entityCode:   varchar("entity_code",   { length: 32  }).notNull().unique(),
  entityName:   varchar("entity_name",   { length: 255 }).notNull(),
  countryCode:  varchar("country_code",  { length: 8   }).notNull(),
  baseCurrency: varchar("base_currency", { length: 8   }).notNull().default('ILS'),
  enabled:      boolean("enabled").notNull().default(true),
  createdAt:    timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
});
export type FinanceEntity       = typeof financeEntities.$inferSelect;
export type InsertFinanceEntity = typeof financeEntities.$inferInsert;

// ── Phase 4.0 ────────────────────────────────────────────────────────────────

// 4.0A — Policy Outcome & ROI Scoring
export const policyOutcomeScores = pgTable("policy_outcome_scores", {
  id:                    serial("id").primaryKey(),
  policyKey:             varchar("policy_key",              { length: 64  }).notNull(),
  entityCode:            varchar("entity_code",             { length: 32  }),
  evaluationPeriodStart: date("evaluation_period_start").notNull(),
  evaluationPeriodEnd:   date("evaluation_period_end").notNull(),
  baselineJson:          jsonb("baseline_json").notNull().default(sql`'{}'::jsonb`),
  actualJson:            jsonb("actual_json").notNull().default(sql`'{}'::jsonb`),
  scoreJson:             jsonb("score_json").notNull().default(sql`'{}'::jsonb`),
  roiScore:              numeric("roi_score", { precision: 8, scale: 2 }).notNull().default('0'),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PolicyOutcomeScore       = typeof policyOutcomeScores.$inferSelect;
export type InsertPolicyOutcomeScore = typeof policyOutcomeScores.$inferInsert;

// 4.0B — Self-Healing: Retry Policies
export const orchestrationRetryPolicies = pgTable("orchestration_retry_policies", {
  id:                serial("id").primaryKey(),
  runType:           varchar("run_type",       { length: 64  }).notNull(),
  errorPattern:      varchar("error_pattern",  { length: 255 }).notNull(),
  autoRetryEnabled:  boolean("auto_retry_enabled").notNull().default(true),
  maxRetries:        integer("max_retries").notNull().default(2),
  retryDelayMinutes: integer("retry_delay_minutes").notNull().default(15),
  enabled:           boolean("enabled").notNull().default(true),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type OrchestrationRetryPolicy       = typeof orchestrationRetryPolicies.$inferSelect;
export type InsertOrchestrationRetryPolicy = typeof orchestrationRetryPolicies.$inferInsert;

// 4.0B — Self-Healing: Retry Attempts
export const orchestrationRetryAttempts = pgTable("orchestration_retry_attempts", {
  id:                   serial("id").primaryKey(),
  orchestrationRunId:   integer("orchestration_run_id").notNull(),
  attemptNo:            integer("attempt_no").notNull(),
  startedAt:            timestamp("started_at",   { withTimezone: true }).notNull().defaultNow(),
  completedAt:          timestamp("completed_at", { withTimezone: true }),
  status:               varchar("status", { length: 20 }).notNull().default('started'),
  errorMessage:         text("error_message").notNull().default(''),
});
export type OrchestrationRetryAttempt       = typeof orchestrationRetryAttempts.$inferSelect;
export type InsertOrchestrationRetryAttempt = typeof orchestrationRetryAttempts.$inferInsert;

// 4.0C — Approval Bottleneck Snapshots (optional cache)
export const approvalBottleneckSnapshots = pgTable("approval_bottleneck_snapshots", {
  id:          serial("id").primaryKey(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  summaryJson: jsonb("summary_json").notNull().default(sql`'{}'::jsonb`),
});
export type ApprovalBottleneckSnapshot       = typeof approvalBottleneckSnapshots.$inferSelect;
export type InsertApprovalBottleneckSnapshot = typeof approvalBottleneckSnapshots.$inferInsert;

// 4.0D — Governance Pack Subscriptions
export const governancePackSubscriptions = pgTable("governance_pack_subscriptions", {
  id:                 serial("id").primaryKey(),
  audienceName:       varchar("audience_name",  { length: 128 }).notNull(),
  packType:           varchar("pack_type",      { length: 32  }).notNull(),
  entityCode:         varchar("entity_code",    { length: 32  }),
  recipients:         jsonb("recipients").notNull().default(sql`'[]'::jsonb`),
  enabled:            boolean("enabled").notNull().default(true),
  includeCommentary:  boolean("include_commentary").notNull().default(true),
  includeControlCenter: boolean("include_control_center").notNull().default(false),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type GovernancePackSubscription       = typeof governancePackSubscriptions.$inferSelect;
export type InsertGovernancePackSubscription = typeof governancePackSubscriptions.$inferInsert;

// 4.0E — Scenario Entity Impact Scores
export const scenarioEntityScores = pgTable("scenario_entity_scores", {
  id:         serial("id").primaryKey(),
  scenarioId: integer("scenario_id").notNull(),
  entityCode: varchar("entity_code", { length: 32 }).notNull(),
  scoreJson:  jsonb("score_json").notNull().default(sql`'{}'::jsonb`),
  totalScore: numeric("total_score", { precision: 8, scale: 2 }).notNull().default('0'),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ScenarioEntityScore       = typeof scenarioEntityScores.$inferSelect;
export type InsertScenarioEntityScore = typeof scenarioEntityScores.$inferInsert;

// 4.0F — Anomaly Root-Cause Clusters
export const anomalyClusters = pgTable("anomaly_clusters", {
  id:               serial("id").primaryKey(),
  clusterKey:       varchar("cluster_key",      { length: 128 }).notNull().unique(),
  rootCauseLabel:   varchar("root_cause_label", { length: 128 }).notNull(),
  signalCodes:      jsonb("signal_codes").notNull().default(sql`'[]'::jsonb`),
  confidenceScore:  numeric("confidence_score", { precision: 5, scale: 2 }).notNull().default('0'),
  lastSeenAt:       timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
});
export type AnomalyCluster       = typeof anomalyClusters.$inferSelect;
export type InsertAnomalyCluster = typeof anomalyClusters.$inferInsert;

// 4.1A — Action Recommendation Confidence Scores
export const recommendationScores = pgTable("recommendation_scores", {
  id:                 serial("id").primaryKey(),
  recommendationType: varchar("recommendation_type",  { length: 64  }).notNull(),
  targetEntityType:   varchar("target_entity_type",   { length: 64  }).notNull(),
  targetEntityId:     varchar("target_entity_id",     { length: 128 }).notNull(),
  confidenceScore:    numeric("confidence_score", { precision: 5, scale: 2 }).notNull().default('0'),
  impactScore:        numeric("impact_score",     { precision: 5, scale: 2 }).notNull().default('0'),
  urgencyScore:       numeric("urgency_score",    { precision: 5, scale: 2 }).notNull().default('0'),
  explanationJson:    jsonb("explanation_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RecommendationScore       = typeof recommendationScores.$inferSelect;
export type InsertRecommendationScore = typeof recommendationScores.$inferInsert;

// 4.1C — Auto-Generated Remediation Plans
export const remediationPlans = pgTable("remediation_plans", {
  id:               serial("id").primaryKey(),
  issueType:        varchar("issue_type",          { length: 64  }).notNull(),
  targetEntityType: varchar("target_entity_type",  { length: 64  }).notNull(),
  targetEntityId:   varchar("target_entity_id",    { length: 128 }).notNull(),
  planJson:         jsonb("plan_json").notNull().default(sql`'{}'::jsonb`),
  confidenceScore:  numeric("confidence_score", { precision: 5, scale: 2 }).notNull().default('0'),
  status:           varchar("status", { length: 24 }).notNull().default('suggested'),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RemediationPlan       = typeof remediationPlans.$inferSelect;
export type InsertRemediationPlan = typeof remediationPlans.$inferInsert;

// 4.1D — Approval Workload Snapshots
export const approvalWorkloadSnapshots = pgTable("approval_workload_snapshots", {
  id:                    serial("id").primaryKey(),
  snapshotAt:            timestamp("snapshot_at",    { withTimezone: true }).notNull().defaultNow(),
  approverUid:           varchar("approver_uid",      { length: 128 }).notNull(),
  openCount:             integer("open_count").notNull().default(0),
  avgAgeHours:           numeric("avg_age_hours", { precision: 8, scale: 2 }).notNull().default('0'),
  overdueCount:          integer("overdue_count").notNull().default(0),
  recommendedRebalance:  boolean("recommended_rebalance").notNull().default(false),
  detailJson:            jsonb("detail_json").notNull().default(sql`'{}'::jsonb`),
});
export type ApprovalWorkloadSnapshot       = typeof approvalWorkloadSnapshots.$inferSelect;
export type InsertApprovalWorkloadSnapshot = typeof approvalWorkloadSnapshots.$inferInsert;

// 4.1E — Governance Delivery Analytics
export const governanceDeliveryAnalytics = pgTable("governance_delivery_analytics", {
  id:             serial("id").primaryKey(),
  packType:       varchar("pack_type",      { length: 32  }).notNull(),
  audienceName:   varchar("audience_name",  { length: 128 }).notNull(),
  periodKey:      varchar("period_key",     { length: 32  }).notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  failedCount:    integer("failed_count").notNull().default(0),
  sentAt:         timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  detailJson:     jsonb("detail_json").notNull().default(sql`'{}'::jsonb`),
});
export type GovernanceDeliveryAnalytic       = typeof governanceDeliveryAnalytics.$inferSelect;
export type InsertGovernanceDeliveryAnalytic = typeof governanceDeliveryAnalytics.$inferInsert;

// 4.1F — Scenario Library Quality Scores
export const scenarioQualityScores = pgTable("scenario_quality_scores", {
  id:               serial("id").primaryKey(),
  scenarioId:       integer("scenario_id").notNull(),
  reuseCount:       integer("reuse_count").notNull().default(0),
  avgBacktestScore: numeric("avg_backtest_score", { precision: 8, scale: 2 }).notNull().default('0'),
  avgEntityScore:   numeric("avg_entity_score",   { precision: 8, scale: 2 }).notNull().default('0'),
  qualityRank:      varchar("quality_rank", { length: 16 }).notNull().default('unranked'),
  detailJson:       jsonb("detail_json").notNull().default(sql`'{}'::jsonb`),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ScenarioQualityScore       = typeof scenarioQualityScores.$inferSelect;
export type InsertScenarioQualityScore = typeof scenarioQualityScores.$inferInsert;

// 4.1G — Monthly Operating Review Packs
export const operatingReviewPacks = pgTable("operating_review_packs", {
  id:          serial("id").primaryKey(),
  month:       varchar("month", { length: 7 }).notNull().unique(),
  packJson:    jsonb("pack_json").notNull().default(sql`'{}'::jsonb`),
  signature:   varchar("signature", { length: 255 }).notNull().default(''),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type OperatingReviewPack       = typeof operatingReviewPacks.$inferSelect;
export type InsertOperatingReviewPack = typeof operatingReviewPacks.$inferInsert;

// ── PHASE 4.2 ────────────────────────────────────────────────────────────────

// 4.2A — Recommendation Action Workflow
export const recommendationActions = pgTable("recommendation_actions", {
  id:                   serial("id").primaryKey(),
  recommendationScoreId: integer("recommendation_score_id").notNull(),
  actionType:           varchar("action_type", { length: 20 }).notNull(), // accept | reject | snooze | assign
  actorUid:             varchar("actor_uid", { length: 255 }).notNull(),
  reason:               text("reason"),
  assignedTo:           varchar("assigned_to", { length: 255 }),
  snoozedUntil:         timestamp("snoozed_until", { withTimezone: true }),
  slaDueAt:             timestamp("sla_due_at", { withTimezone: true }),
  slaMet:               boolean("sla_met"),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RecommendationAction       = typeof recommendationActions.$inferSelect;
export type InsertRecommendationAction = typeof recommendationActions.$inferInsert;

// 4.2B — Remediation Outcome Scoring
export const remediationOutcomes = pgTable("remediation_outcomes", {
  id:               serial("id").primaryKey(),
  remediationPlanId: integer("remediation_plan_id").notNull(),
  metricName:       varchar("metric_name", { length: 100 }).notNull(),
  beforeValue:      numeric("before_value", { precision: 18, scale: 4 }).notNull().default('0'),
  afterValue:       numeric("after_value",  { precision: 18, scale: 4 }).notNull().default('0'),
  unit:             varchar("unit", { length: 30 }),
  outcomeStatus:        varchar("outcome_status", { length: 20 }).notNull().default('unchanged'), // improved | unchanged | worsened
  effectivenessScore:   numeric("effectiveness_score", { precision: 8, scale: 2 }).default('0'),
  effectivenessReason:  text("effectiveness_reason").default(''),
  measuredAt:           timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RemediationOutcome       = typeof remediationOutcomes.$inferSelect;
export type InsertRemediationOutcome = typeof remediationOutcomes.$inferInsert;

// 4.2C — Policy Learning Suggestions
export const policyLearningSuggestions = pgTable("policy_learning_suggestions", {
  id:               serial("id").primaryKey(),
  sourcePlanId:     integer("source_plan_id"),
  suggestionType:   varchar("suggestion_type", { length: 30 }).notNull(), // tighten | relax | new_rule | deprecate
  policyArea:       varchar("policy_area", { length: 100 }).notNull(),
  suggestedChange:  jsonb("suggested_change").notNull().default(sql`'{}'::jsonb`),
  triggerReason:    text("trigger_reason"),
  confidenceDelta:  numeric("confidence_delta", { precision: 8, scale: 4 }).default('0'),
  status:           varchar("status", { length: 20 }).notNull().default('pending'), // pending | accepted | rejected | deferred
  reviewedBy:       varchar("reviewed_by", { length: 255 }),
  reviewedAt:       timestamp("reviewed_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PolicyLearningSuggestion       = typeof policyLearningSuggestions.$inferSelect;
export type InsertPolicyLearningSuggestion = typeof policyLearningSuggestions.$inferInsert;

// 4.2D — Reviewer Performance Snapshots
export const reviewerPerformanceSnapshots = pgTable("reviewer_performance_snapshots", {
  id:                  serial("id").primaryKey(),
  reviewerUid:         varchar("reviewer_uid", { length: 255 }).notNull(),
  periodKey:           varchar("period_key", { length: 10 }).notNull(),
  totalReviewed:       integer("total_reviewed").notNull().default(0),
  avgApprovalHours:    numeric("avg_approval_hours", { precision: 8, scale: 2 }).default('0'),
  reversalRate:        numeric("reversal_rate", { precision: 6, scale: 4 }).default('0'),
  overdueRate:         numeric("overdue_rate", { precision: 6, scale: 4 }).default('0'),
  outcomeQualityScore:          numeric("outcome_quality_score", { precision: 6, scale: 2 }).default('0'),
  actionAcceptRate:             numeric("action_accept_rate", { precision: 6, scale: 4 }).default('0'),
  actionSuccessRate:            numeric("action_success_rate", { precision: 6, scale: 4 }).default('0'),
  avgTimeToResolutionHours:     numeric("avg_time_to_resolution_hours", { precision: 8, scale: 2 }).default('0'),
  followupOverdueRate:          numeric("followup_overdue_rate", { precision: 6, scale: 4 }).default('0'),
  qualityBand:                  varchar("quality_band", { length: 16 }).default('unrated'), // excellent | good | fair | poor | unrated
  snapshotJson:                 jsonb("snapshot_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:                    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ReviewerPerformanceSnapshot       = typeof reviewerPerformanceSnapshots.$inferSelect;
export type InsertReviewerPerformanceSnapshot = typeof reviewerPerformanceSnapshots.$inferInsert;

// 4.2E — Operating Review Follow-Up Actions
export const reviewFollowUpActions = pgTable("review_follow_up_actions", {
  id:        serial("id").primaryKey(),
  month:     varchar("month", { length: 7 }).notNull(),
  title:     varchar("title", { length: 255 }).notNull(),
  ownerUid:  varchar("owner_uid", { length: 255 }).notNull(),
  dueDate:   varchar("due_date", { length: 10 }).notNull(),
  priority:  varchar("priority", { length: 10 }).notNull().default('medium'), // low | medium | high | critical
  status:          varchar("status", { length: 20 }).notNull().default('open'), // open | in_progress | closed | cancelled
  notes:           text("notes"),
  closedAt:        timestamp("closed_at", { withTimezone: true }),
  escalatedAt:     timestamp("escalated_at", { withTimezone: true }),
  escalationLevel: integer("escalation_level").notNull().default(0),
  blockedReason:   text("blocked_reason").default(''),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ReviewFollowUpAction       = typeof reviewFollowUpActions.$inferSelect;
export type InsertReviewFollowUpAction = typeof reviewFollowUpActions.$inferInsert;

// 4.2F — Unified Recommendation Object (cross-tab memory)
export const unifiedRecommendations = pgTable("unified_recommendations", {
  id:                   serial("id").primaryKey(),
  recommendationScoreId: integer("recommendation_score_id"),
  title:                varchar("title", { length: 255 }).notNull(),
  description:          text("description"),
  entityType:           varchar("entity_type", { length: 50 }),
  entityId:             varchar("entity_id", { length: 100 }),
  sourceTab:            varchar("source_tab", { length: 50 }).notNull(),
  visibilityTabs:       text("visibility_tabs").array().notNull().default(sql`ARRAY[]::text[]`),
  status:               varchar("status", { length: 20 }).notNull().default('open'), // open | accepted | rejected | snoozed | resolved
  priority:             varchar("priority", { length: 10 }).notNull().default('medium'),
  assignedTo:           varchar("assigned_to", { length: 255 }),
  confidenceScore:      numeric("confidence_score", { precision: 6, scale: 2 }).default('0'),
  resolvedAt:           timestamp("resolved_at", { withTimezone: true }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type UnifiedRecommendation       = typeof unifiedRecommendations.$inferSelect;
export type InsertUnifiedRecommendation = typeof unifiedRecommendations.$inferInsert;

// 4.3A — Recommendation Priority Scores
export const recommendationPriorityScores = pgTable("recommendation_priority_scores", {
  id:               serial("id").primaryKey(),
  recommendationId: integer("recommendation_id").notNull(),
  priorityScore:    numeric("priority_score",    { precision: 8, scale: 2 }).notNull().default('0'),
  urgencyScore:     numeric("urgency_score",     { precision: 8, scale: 2 }).notNull().default('0'),
  valueScore:       numeric("value_score",       { precision: 8, scale: 2 }).notNull().default('0'),
  confidenceScore:  numeric("confidence_score",  { precision: 8, scale: 2 }).notNull().default('0'),
  bottleneckScore:  numeric("bottleneck_score",  { precision: 8, scale: 2 }).notNull().default('0'),
  reasoningJson:    jsonb("reasoning_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RecommendationPriorityScore       = typeof recommendationPriorityScores.$inferSelect;
export type InsertRecommendationPriorityScore = typeof recommendationPriorityScores.$inferInsert;

// 4.3G — Execution Review Snapshots (management cache)
export const executionReviewSnapshots = pgTable("execution_review_snapshots", {
  id:           serial("id").primaryKey(),
  periodKey:    varchar("period_key", { length: 32 }).notNull(),
  snapshotJson: jsonb("snapshot_json").notNull().default(sql`'{}'::jsonb`),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ExecutionReviewSnapshot       = typeof executionReviewSnapshots.$inferSelect;
export type InsertExecutionReviewSnapshot = typeof executionReviewSnapshots.$inferInsert;

// ─── PHASE 4.4 — Adaptive Execution & Self-Optimizing Operations ────────────

// 4.4A — Priority Feedback Adjustments
export const priorityFeedbackAdjustments = pgTable("priority_feedback_adjustments", {
  id:                 serial("id").primaryKey(),
  recommendationId:   integer("recommendation_id"),
  previousScore:      numeric("previous_score",   { precision: 8, scale: 2 }),
  adjustedScore:      numeric("adjusted_score",   { precision: 8, scale: 2 }),
  delta:              numeric("delta",             { precision: 8, scale: 2 }),
  adjustmentReason:   text("adjustment_reason"),
  basedOnOutcomeId:   integer("based_on_outcome_id"),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type PriorityFeedbackAdjustment       = typeof priorityFeedbackAdjustments.$inferSelect;
export type InsertPriorityFeedbackAdjustment = typeof priorityFeedbackAdjustments.$inferInsert;

// 4.4B — Action Sequences
export const actionSequences = pgTable("action_sequences", {
  id:                  serial("id").primaryKey(),
  recommendationGroup: varchar("recommendation_group", { length: 64 }),
  sequenceJson:        jsonb("sequence_json").notNull().default(sql`'{}'::jsonb`),
  expectedImpact:      numeric("expected_impact", { precision: 10, scale: 2 }),
  confidence:          numeric("confidence",      { precision: 5,  scale: 2 }),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ActionSequence       = typeof actionSequences.$inferSelect;
export type InsertActionSequence = typeof actionSequences.$inferInsert;

// 4.4C — Escalation Policy Adjustments
export const escalationPolicyAdjustments = pgTable("escalation_policy_adjustments", {
  id:                      serial("id").primaryKey(),
  policyId:                integer("policy_id"),
  previousThresholdHours:  integer("previous_threshold_hours"),
  suggestedThresholdHours: integer("suggested_threshold_hours"),
  reason:                  text("reason"),
  impactEstimate:          numeric("impact_estimate", { precision: 8, scale: 2 }),
  status:                  varchar("status", { length: 16 }).notNull().default('pending'),
  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type EscalationPolicyAdjustment       = typeof escalationPolicyAdjustments.$inferSelect;
export type InsertEscalationPolicyAdjustment = typeof escalationPolicyAdjustments.$inferInsert;

// 4.4D — Reviewer Workload Suggestions
export const reviewerWorkloadSuggestions = pgTable("reviewer_workload_suggestions", {
  id:             serial("id").primaryKey(),
  reviewerUid:    varchar("reviewer_uid", { length: 128 }),
  currentLoad:    integer("current_load"),
  optimalLoad:    integer("optimal_load"),
  suggestedShift: integer("suggested_shift"),
  reason:         text("reason"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ReviewerWorkloadSuggestion       = typeof reviewerWorkloadSuggestions.$inferSelect;
export type InsertReviewerWorkloadSuggestion = typeof reviewerWorkloadSuggestions.$inferInsert;

// 4.4E — Operating Review Deliveries
export const operatingReviewDeliveries = pgTable("operating_review_deliveries", {
  id:         serial("id").primaryKey(),
  periodKey:  varchar("period_key", { length: 32 }),
  recipients: jsonb("recipients").notNull().default(sql`'[]'::jsonb`),
  status:     varchar("status", { length: 16 }).notNull().default('pending'),
  sentAt:     timestamp("sent_at", { withTimezone: true }),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type OperatingReviewDelivery       = typeof operatingReviewDeliveries.$inferSelect;
export type InsertOperatingReviewDelivery = typeof operatingReviewDeliveries.$inferInsert;

// 4.4G — Governance Alerts
export const governanceAlerts = pgTable("governance_alerts", {
  id:           serial("id").primaryKey(),
  alertType:    varchar("alert_type", { length: 64 }),
  severity:     varchar("severity",   { length: 16 }),
  message:      text("message"),
  triggeredBy:  jsonb("triggered_by").notNull().default(sql`'{}'::jsonb`),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type GovernanceAlert       = typeof governanceAlerts.$inferSelect;
export type InsertGovernanceAlert = typeof governanceAlerts.$inferInsert;

// ─── PHASE 4.5 — Business Survival Hardening ─────────────────────────────────

// 4.5C — System Kill Switches
export const systemKillSwitches = pgTable("system_kill_switches", {
  key:       varchar("key", { length: 64 }).primaryKey(),
  enabled:   boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SystemKillSwitch       = typeof systemKillSwitches.$inferSelect;
export type InsertSystemKillSwitch = typeof systemKillSwitches.$inferInsert;

// 4.5D — Idempotency Keys
export const idempotencyKeys = pgTable("idempotency_keys", {
  key:          varchar("key", { length: 128 }).primaryKey(),
  endpoint:     varchar("endpoint", { length: 128 }),
  responseHash: text("response_hash"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type IdempotencyKey       = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = typeof idempotencyKeys.$inferInsert;

// 4.5B — Money Flow Checks
export const moneyFlowChecks = pgTable("money_flow_checks", {
  id:            serial("id").primaryKey(),
  checkType:     varchar("check_type",  { length: 64 }),
  entityId:      varchar("entity_id",   { length: 128 }),
  expectedValue: numeric("expected_value", { precision: 12, scale: 2 }),
  actualValue:   numeric("actual_value",   { precision: 12, scale: 2 }),
  status:        varchar("status",      { length: 16 }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type MoneyFlowCheck       = typeof moneyFlowChecks.$inferSelect;
export type InsertMoneyFlowCheck = typeof moneyFlowChecks.$inferInsert;

// 4.5G — Go-Live Checklist
export const goLiveChecklist = pgTable("go_live_checklist", {
  id:         serial("id").primaryKey(),
  item:       varchar("item", { length: 128 }),
  status:     varchar("status", { length: 16 }).notNull().default('pending'),
  verifiedBy: varchar("verified_by", { length: 128 }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});
export type GoLiveChecklistItem       = typeof goLiveChecklist.$inferSelect;
export type InsertGoLiveChecklistItem = typeof goLiveChecklist.$inferInsert;

// ─── PHASE 4.6 — Controlled Go-Live & Production Readiness ───────────────────

// 4.6A — E2E Proof Runs
export const e2eProofRuns = pgTable("e2e_proof_runs", {
  id:           serial("id").primaryKey(),
  runType:      varchar("run_type",  { length: 32 }).notNull().default('full'),
  status:       varchar("status",   { length: 16 }).notNull().default('running'),
  stepsJson:    jsonb("steps_json").notNull().default(sql`'[]'::jsonb`),
  failuresJson: jsonb("failures_json").notNull().default(sql`'[]'::jsonb`),
  startedAt:    timestamp("started_at",   { withTimezone: true }).notNull().defaultNow(),
  completedAt:  timestamp("completed_at", { withTimezone: true }),
});
export type E2EProofRun       = typeof e2eProofRuns.$inferSelect;
export type InsertE2EProofRun = typeof e2eProofRuns.$inferInsert;

// 4.6B — Config Audit Runs
export const systemConfigAuditRuns = pgTable("system_config_audit_runs", {
  id:           serial("id").primaryKey(),
  checksJson:   jsonb("checks_json").notNull().default(sql`'[]'::jsonb`),
  failuresJson: jsonb("failures_json").notNull().default(sql`'[]'::jsonb`),
  status:       varchar("status", { length: 16 }).notNull().default('pending'),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SystemConfigAuditRun       = typeof systemConfigAuditRuns.$inferSelect;
export type InsertSystemConfigAuditRun = typeof systemConfigAuditRuns.$inferInsert;

// 4.6C — Alert Delivery Tests
export const alertDeliveryTests = pgTable("alert_delivery_tests", {
  id:             serial("id").primaryKey(),
  alertType:      varchar("alert_type",      { length: 64 }),
  channel:        varchar("channel",         { length: 16 }),
  recipient:      varchar("recipient",       { length: 128 }),
  delivered:      boolean("delivered").notNull().default(false),
  responseTimeMs: integer("response_time_ms"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type AlertDeliveryTest       = typeof alertDeliveryTests.$inferSelect;
export type InsertAlertDeliveryTest = typeof alertDeliveryTests.$inferInsert;

// 4.6D — Shadow Activity Log
export const shadowActivityLog = pgTable("shadow_activity_log", {
  id:             serial("id").primaryKey(),
  entityType:     varchar("entity_type", { length: 64 }),
  entityId:       varchar("entity_id",   { length: 128 }),
  action:         varchar("action",      { length: 128 }),
  expectedResult: jsonb("expected_result"),
  actualResult:   jsonb("actual_result"),
  mismatchFlag:   boolean("mismatch_flag").notNull().default(false),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ShadowActivityLog       = typeof shadowActivityLog.$inferSelect;
export type InsertShadowActivityLog = typeof shadowActivityLog.$inferInsert;

// 4.6E — Incident Drills
export const incidentDrills = pgTable("incident_drills", {
  id:                  serial("id").primaryKey(),
  scenario:            varchar("scenario", { length: 64 }),
  actionsTakenJson:    jsonb("actions_taken_json").notNull().default(sql`'[]'::jsonb`),
  recoveryTimeSeconds: integer("recovery_time_seconds"),
  success:             boolean("success").notNull().default(false),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type IncidentDrill       = typeof incidentDrills.$inferSelect;
export type InsertIncidentDrill = typeof incidentDrills.$inferInsert;

// 4.6F — Go-Live Gates
export const goLiveGates = pgTable("go_live_gates", {
  id:         serial("id").primaryKey(),
  status:     varchar("status", { length: 16 }).notNull().default('locked'),
  checksJson: jsonb("checks_json").notNull().default(sql`'{}'::jsonb`),
  approvedBy: varchar("approved_by", { length: 128 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt:  timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
});
export type GoLiveGate       = typeof goLiveGates.$inferSelect;
export type InsertGoLiveGate = typeof goLiveGates.$inferInsert;

// 4.6G — Rollout Phases
export const rolloutPhases = pgTable("rollout_phases", {
  id:                serial("id").primaryKey(),
  phase:             varchar("phase", { length: 16 }).notNull().default('internal'),
  trafficPercentage: integer("traffic_percentage").notNull().default(0),
  enabled:           boolean("enabled").notNull().default(false),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RolloutPhase       = typeof rolloutPhases.$inferSelect;
export type InsertRolloutPhase = typeof rolloutPhases.$inferInsert;

// ─── Phase 4.7 — Live Operations & Incident Intelligence ────────────────────

// 4.7A — Anomaly Events
export const anomalyEvents = pgTable("anomaly_events", {
  id:            serial("id").primaryKey(),
  anomalyType:   text("anomaly_type").notNull(),
  severity:      text("severity").notNull().default('medium'),
  metricValue:   numeric("metric_value").notNull().default('0'),
  baselineValue: numeric("baseline_value").notNull().default('0'),
  deviationPct:  numeric("deviation_pct").notNull().default('0'),
  status:        text("status").notNull().default('open'),
  contextJson:   jsonb("context_json"),
  detectedAt:    timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:    timestamp("resolved_at",  { withTimezone: true }),
});
export type AnomalyEvent       = typeof anomalyEvents.$inferSelect;
export type InsertAnomalyEvent = typeof anomalyEvents.$inferInsert;

// 4.7B — Alert Priority Scores
export const alertPriorityScores = pgTable("alert_priority_scores", {
  id:           serial("id").primaryKey(),
  alertId:      integer("alert_id").notNull(),
  priorityScore: numeric("priority_score").notNull().default('0'),
  severityPts:  numeric("severity_pts").notNull().default('0'),
  financialPts: numeric("financial_pts").notNull().default('0'),
  entitiesPts:  numeric("entities_pts").notNull().default('0'),
  trendPts:     numeric("trend_pts").notNull().default('0'),
  rank:         integer("rank").notNull().default(0),
  reasonChips:  jsonb("reason_chips").notNull().default(sql`'[]'::jsonb`),
  computedAt:   timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});
export type AlertPriorityScore       = typeof alertPriorityScores.$inferSelect;
export type InsertAlertPriorityScore = typeof alertPriorityScores.$inferInsert;

// 4.7C — Kill Switch Trigger Rules + Log
export const killSwitchTriggerRules = pgTable("kill_switch_trigger_rules", {
  id:             serial("id").primaryKey(),
  anomalyType:    varchar("anomaly_type", { length: 100 }).notNull(),
  minScore:       integer("min_score").notNull().default(70),
  killSwitchKey:  varchar("kill_switch_key", { length: 100 }).notNull(),
  description:    text("description").notNull(),
  action:         varchar("action", { length: 20 }).notNull().default('suggest'),
  enabled:        boolean("enabled").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type KillSwitchTriggerRule = typeof killSwitchTriggerRules.$inferSelect;

export const killSwitchTriggerLog = pgTable("kill_switch_trigger_log", {
  id:             serial("id").primaryKey(),
  ruleId:         integer("rule_id").notNull(),
  anomalyEventId: integer("anomaly_event_id").notNull(),
  priorityScore:  numeric("priority_score").notNull(),
  killSwitchKey:  varchar("kill_switch_key", { length: 100 }).notNull(),
  actionTaken:    varchar("action_taken", { length: 20 }).notNull(),
  operatorNote:   text("operator_note"),
  triggeredAt:    timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
});
export type KillSwitchTriggerLogEntry = typeof killSwitchTriggerLog.$inferSelect;

// 4.7D — Incident Timeline
export const incidents = pgTable("incidents", {
  id:             serial("id").primaryKey(),
  title:          varchar("title", { length: 300 }).notNull(),
  severity:       varchar("severity", { length: 20 }).notNull().default('medium'),
  status:         varchar("status", { length: 30 }).notNull().default('open'),
  anomalyEventId: integer("anomaly_event_id"),
  startedAt:      timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:     timestamp("resolved_at",  { withTimezone: true }),
  createdBy:      varchar("created_by", { length: 100 }).notNull().default('system'),
  summary:        text("summary"),
});
export type Incident       = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

export const incidentTimelineEntries = pgTable("incident_timeline_entries", {
  id:           serial("id").primaryKey(),
  incidentId:   integer("incident_id").notNull(),
  eventType:    varchar("event_type", { length: 50 }).notNull(),
  content:      text("content").notNull(),
  actor:        varchar("actor", { length: 100 }).notNull().default('system'),
  metadataJson: jsonb("metadata_json").notNull().default(sql`'{}'::jsonb`),
  occurredAt:   timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});
export type IncidentTimelineEntry = typeof incidentTimelineEntries.$inferSelect;

// 4.7F — Auto-Remediation Suggestions
export const remediationSuggestions = pgTable("remediation_suggestions", {
  id:            serial("id").primaryKey(),
  incidentId:    integer("incident_id").notNull(),
  rcaId:         integer("rca_id"),
  anomalyType:   varchar("anomaly_type", { length: 80 }),
  rank:          integer("rank").notNull().default(1),
  actionType:    varchar("action_type", { length: 60 }).notNull(),
  actionLabel:   varchar("action_label", { length: 200 }).notNull(),
  actionDetail:  text("action_detail"),
  actionParams:  jsonb("action_params").default(sql`'{}'::jsonb`),
  rationale:     text("rationale"),
  confidence:    varchar("confidence", { length: 20 }).default('medium'),
  status:        varchar("status", { length: 20 }).notNull().default('pending'),
  appliedBy:     varchar("applied_by", { length: 100 }),
  appliedAt:     timestamp("applied_at", { withTimezone: true }),
  dismissedBy:   varchar("dismissed_by", { length: 100 }),
  dismissedAt:   timestamp("dismissed_at", { withTimezone: true }),
  auditNote:     text("audit_note"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type RemediationSuggestion = typeof remediationSuggestions.$inferSelect;

// 4.7E — Root Cause Analysis
export const incidentRca = pgTable("incident_rca", {
  id:                serial("id").primaryKey(),
  incidentId:        integer("incident_id").notNull(),
  anomalyType:       varchar("anomaly_type", { length: 80 }),
  generatedAt:       timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  hypothesesJson:    jsonb("hypotheses_json").notNull().default(sql`'[]'::jsonb`),
  conclusion:        text("conclusion"),
  recommendedAction: text("recommended_action"),
  confidenceOverall: varchar("confidence_overall", { length: 20 }).default('low'),
  generatedBy:       varchar("generated_by", { length: 50 }).notNull().default('rca_engine'),
});
export type IncidentRca = typeof incidentRca.$inferSelect;

// 4.7G — Self-Healing Rules
export const selfHealingRules = pgTable("self_healing_rules", {
  id:                   serial("id").primaryKey(),
  name:                 varchar("name", { length: 200 }).notNull(),
  anomalyType:          varchar("anomaly_type", { length: 80 }).notNull().default('any'),
  minScore:             integer("min_score").notNull().default(60),
  consecutiveTriggers:  integer("consecutive_triggers").notNull().default(1),
  cooldownMinutes:      integer("cooldown_minutes").notNull().default(10),
  actionType:           varchar("action_type", { length: 60 }).notNull(),
  actionLabel:          varchar("action_label", { length: 200 }).notNull(),
  actionParams:         jsonb("action_params").notNull().default(sql`'{}'::jsonb`),
  rationale:            text("rationale"),
  enabled:              boolean("enabled").notNull().default(true),
  lastTriggeredAt:      timestamp("last_triggered_at", { withTimezone: true }),
  triggerCount:         integer("trigger_count").notNull().default(0),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type SelfHealingRule = typeof selfHealingRules.$inferSelect;

// 4.8A — Threshold Tuning Audit Trail
export const selfHealingRuleChanges = pgTable("self_healing_rule_changes", {
  id:          serial("id").primaryKey(),
  ruleId:      integer("rule_id").notNull(),
  changedBy:   varchar("changed_by", { length: 100 }).notNull(),
  changedAt:   timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  fieldChanged: varchar("field_changed", { length: 60 }).notNull(),
  oldValue:    varchar("old_value", { length: 200 }),
  newValue:    varchar("new_value", { length: 200 }).notNull(),
  reason:      text("reason").notNull(),
});
export type SelfHealingRuleChange = typeof selfHealingRuleChanges.$inferSelect;

// 4.7G — Self-Healing Executions Log
export const selfHealingExecutions = pgTable("self_healing_executions", {
  id:              serial("id").primaryKey(),
  ruleId:          integer("rule_id").notNull(),
  incidentId:      integer("incident_id"),
  anomalyEventId:  integer("anomaly_event_id"),
  triggeredAt:     timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  anomalyType:     varchar("anomaly_type", { length: 80 }),
  anomalyScore:    integer("anomaly_score"),
  actionType:      varchar("action_type", { length: 60 }).notNull(),
  actionParams:    jsonb("action_params").notNull().default(sql`'{}'::jsonb`),
  result:          varchar("result", { length: 20 }).notNull().default('success'),
  resultNote:      text("result_note"),
  executedBy:      varchar("executed_by", { length: 80 }).notNull().default('self_healing_engine'),
});
export type SelfHealingExecution = typeof selfHealingExecutions.$inferSelect;

// ===== KYC QUARANTINE OBJECTS =====
export const kycQuarantineObjects = pgTable("kyc_quarantine_objects", {
  id: serial("id").primaryKey(),
  objectKey: varchar("object_key", { length: 500 }).notNull(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  documentType: varchar("document_type", { length: 60 }).notNull(),
  storageSystem: varchar("storage_system", { length: 30 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deleteBy: timestamp("delete_by").notNull(),
  deletedAt: timestamp("deleted_at"),
  deletionStatus: varchar("deletion_status", { length: 20 }).default("pending").notNull(),
  reasonCode: varchar("reason_code", { length: 100 }),
});
export type KycQuarantineObject = typeof kycQuarantineObjects.$inferSelect;

// ===== KYC EVENTS AUDIT LOG =====
export const kycEvents = pgTable("kyc_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  eventType: varchar("event_type", { length: 40 }).notNull(),
  actor: varchar("actor", { length: 128 }).notNull(),
  result: varchar("result", { length: 40 }),
  reason: text("reason"),
  sourceIp: varchar("source_ip", { length: 60 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type KycEvent = typeof kycEvents.$inferSelect;

// ===== K9000 MACHINE COMMAND QUEUE =====
// Every command sent from the PetWash backend to a K9000 IoT controller must be
// recorded here. This table is the single source of truth for command lifecycle:
//   pending → sent → acknowledged → completed
//                  → failed (max retries exceeded)
//                  → expired   (timeout, no ACK)
//
// Payment success ≠ machine success.  Machine success requires an ACK.
// If START_PUMP is never ACKed after all retries, compensationTriggeredAt is set
// and the ops team / refund automation is alerted.
export const machineCommands = pgTable("machine_commands", {
  id:          varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Stable, human-readable identifier included in every HTTP payload to the machine.
  // The machine uses commandId for idempotency — it will not re-execute a command
  // it has already processed even if the same commandId arrives again.
  commandId:   varchar("command_id", { length: 64 }).unique().notNull(),

  // Station / bay / session context
  stationId:   varchar("station_id", { length: 64 }).notNull(),
  bayId:       varchar("bay_id",     { length: 64 }),    // nullable for station-level cmds
  sessionId:   varchar("session_id", { length: 64 }),    // nullable for probes
  side:        varchar("side",       { length: 10 }),    // "left" | "right" | null

  // Command details
  commandType: varchar("command_type", { length: 30 }).notNull(),
  // START_PUMP | STOP_PUMP | EXTEND_TIME | HEARTBEAT | STATUS_PING
  payload:     jsonb("payload").notNull().default(sql`'{}'::jsonb`),

  // Lifecycle status
  status:      varchar("status", { length: 20 }).notNull().default("pending"),
  // pending | sent | acknowledged | completed | failed | expired

  // Retry tracking
  retryCount:  integer("retry_count").notNull().default(0),
  maxRetries:  integer("max_retries").notNull().default(2),

  // Timestamps
  createdAt:                timestamp("created_at",                  { withTimezone: true }).notNull().defaultNow(),
  timeoutAt:                timestamp("timeout_at",                  { withTimezone: true }).notNull(),
  sentAt:                   timestamp("sent_at",                     { withTimezone: true }),
  acknowledgedAt:           timestamp("acknowledged_at",             { withTimezone: true }),
  failedAt:                 timestamp("failed_at",                   { withTimezone: true }),
  compensationTriggeredAt:  timestamp("compensation_triggered_at",   { withTimezone: true }),

  // Network context
  machineClientIp: varchar("machine_client_ip", { length: 64 }),
  correlationId:   varchar("correlation_id",    { length: 64 }),
  source:          varchar("source",            { length: 30 }),
  // petwash_wallet | nayax | admin | server
},
(table) => [
  index("idx_machine_commands_station_status").on(table.stationId, table.status),
  index("idx_machine_commands_session").on(table.sessionId),
  index("idx_machine_commands_timeout").on(table.timeoutAt),
]);

export type MachineCommand      = typeof machineCommands.$inferSelect;
export type InsertMachineCommand = typeof machineCommands.$inferInsert;

// ===== PHASE 8: TRUST & QUALITY LAYER =====

// Marketplace booking reviews (customer → provider, post-completion)
export const marketplaceReviews = pgTable("marketplace_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  customerId: varchar("customer_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  overallRating: integer("overall_rating").notNull(),
  reviewText: text("review_text"),
  isVisible: boolean("is_visible").default(true),
  isFlagged: boolean("is_flagged").default(false),
  flagReason: varchar("flag_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  bookingIdx: index("idx_mkt_reviews_booking").on(table.bookingId),
  providerIdx: index("idx_mkt_reviews_provider").on(table.providerId),
  customerIdx: index("idx_mkt_reviews_customer").on(table.customerId),
}));

export const insertMarketplaceReviewSchema = createInsertSchema(marketplaceReviews).omit({ id: true, createdAt: true });
export type InsertMarketplaceReview = z.infer<typeof insertMarketplaceReviewSchema>;
export type MarketplaceReview = typeof marketplaceReviews.$inferSelect;

// Booking disputes (customer reports a problem with a completed/in-progress booking)
export const bookingDisputes = pgTable("booking_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  bookingType: varchar("booking_type").default("marketplace").notNull(),
  customerId: varchar("customer_id").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status").default("open").notNull(),
  adminNotes: text("admin_notes"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  bookingIdx: index("idx_disputes_booking").on(table.bookingId),
  customerIdx: index("idx_disputes_customer").on(table.customerId),
  statusIdx: index("idx_disputes_status").on(table.status),
}));

export const insertBookingDisputeSchema = createInsertSchema(bookingDisputes).omit({ id: true, createdAt: true });
export type InsertBookingDispute = z.infer<typeof insertBookingDisputeSchema>;

// ─── Provider Ranking Audit Log ───────────────────────────────────────────────
// Records every operator override action for accountability and dispute resolution.

export const providerRankingAudit = pgTable("provider_ranking_audit", {
  id: serial("id").primaryKey(),
  providerUserId: text("provider_user_id").notNull(),
  adminUid: text("admin_uid").notNull(),
  action: text("action").notNull(),       // 'boost' | 'suppress' | 'reset' | 'flag' | 'unflag'
  note: text("note"),                     // optional operator note
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  providerIdx: index("idx_ranking_audit_provider").on(table.providerUserId),
  createdIdx: index("idx_ranking_audit_created").on(table.createdAt),
}));

export type ProviderRankingAuditRow = typeof providerRankingAudit.$inferSelect;
export type BookingDispute = typeof bookingDisputes.$inferSelect;

// ─── Intervention Cases ────────────────────────────────────────────────────────
// Phase 12.21 — Intervention & Decision Tracking
// Created when board flags fire or leadership manually opens a case.
// Tracks what was decided (by whom, when) and whether it was resolved.
// Source of signals: Phase 12.20 board pack (expansion engine).

export const interventionCases = pgTable("intervention_cases", {
  id:            serial("id").primaryKey(),
  entityType:    varchar("entity_type", { length: 20 }).notNull(),       // 'station' | 'network' | 'franchise'
  entityId:      text("entity_id").notNull(),                            // station_id as text or owner key
  entityName:    text("entity_name").notNull(),
  triggerSignal: varchar("trigger_signal", { length: 50 }),              // board pack signal at creation time
  triggerFlag:   varchar("trigger_flag", { length: 50 }),                // board flag type (null if manual)
  decision:      varchar("decision", { length: 50 }),                    // approve_expansion / freeze_capex / restructure / review_franchise / monitor / no_action
  status:        varchar("status", { length: 20 }).notNull().default("open"), // open | in_progress | resolved | escalated
  notes:         text("notes"),
  createdBy:     text("created_by").notNull().default("system"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  resolvedAt:    timestamp("resolved_at"),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
  // Phase 12.22 — economic snapshot at case creation time (nullable for legacy cases)
  snapshotMarginPct:   decimal("snapshot_margin_pct",   { precision: 6, scale: 2 }),
  snapshotFrictionPct: decimal("snapshot_friction_pct", { precision: 6, scale: 2 }),
  snapshotReserveRisk: varchar("snapshot_reserve_risk", { length: 10 }),
  snapshotFailureRate: decimal("snapshot_failure_rate", { precision: 6, scale: 2 }),
  snapshotGrossIls:    decimal("snapshot_gross_ils",    { precision: 12, scale: 2 }),
}, (table) => ({
  statusIdx: index("idx_intervention_status").on(table.status),
  entityIdx: index("idx_intervention_entity").on(table.entityType, table.entityId),
}));

export const insertInterventionCaseSchema = createInsertSchema(interventionCases).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertInterventionCase = z.infer<typeof insertInterventionCaseSchema>;
export type InterventionCase = typeof interventionCases.$inferSelect;

// ─── Station Settlements ───────────────────────────────────────────────────────
// One record per completed booking that has a stationId.
// Source of truth for all station/franchise money flow.
// Computed once on booking completion; idempotent by bookingId.
//
// Split (always sums to totalAmountCents):
//   platformAmountCents   = round(total × platformFeePct / 100)
//   franchiseAmountCents  = round(total × franchiseOverridePct / 100)   [0 if no franchise]
//   stationAmountCents    = totalAmountCents − platformAmountCents − franchiseAmountCents
//
// Configurable via env:
//   PLATFORM_FEE_PCT  (default 20)   — overridable per franchise via franchiseOwner.platformFeeOverridePct
//   STATION_REVENUE_PCT (default 70) — used for stationRevenuePct column (auditable)
//   FRANCHISE_FEE_PCT (default 10)   — 0 when no franchise owner linked

export const stationSettlements = pgTable("station_settlements", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").notNull().unique().references(() => bookings.id),
  stationId: integer("station_id").notNull().references(() => stations.id),
  franchiseOwnerId: integer("franchise_owner_id").references(() => franchiseOwners.id),
  totalAmountCents: integer("total_amount_cents").notNull(),
  platformFeePct: decimal("platform_fee_pct", { precision: 5, scale: 2 }).notNull(),
  platformAmountCents: integer("platform_amount_cents").notNull(),
  stationRevenuePct: decimal("station_revenue_pct", { precision: 5, scale: 2 }).notNull(),
  stationAmountCents: integer("station_amount_cents").notNull(),
  franchiseOverridePct: decimal("franchise_override_pct", { precision: 5, scale: 2 }),
  franchiseAmountCents: integer("franchise_amount_cents").notNull().default(0),
  currency: varchar("currency", { length: 3 }).notNull().default("ILS"),
  status: varchar("status").notNull().default("pending"), // CHECK: pending | settled | disputed
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  bookingIdx:   index("idx_station_settlements_booking").on(table.bookingId),
  stationIdx:   index("idx_station_settlements_station").on(table.stationId),
  franchiseIdx: index("idx_station_settlements_franchise").on(table.franchiseOwnerId),
  statusIdx:    index("idx_station_settlements_status").on(table.status),
}));

export const insertStationSettlementSchema = createInsertSchema(stationSettlements).omit({
  id: true,
  createdAt: true,
});
export type InsertStationSettlement = z.infer<typeof insertStationSettlementSchema>;
export type StationSettlement = typeof stationSettlements.$inferSelect;

// =========================================================
// PAW FINDER TABLES - Added via raw SQL, types here for TypeScript
// =========================================================

export const pawFinderPosts = pgTable("paw_finder_posts", {
  id: serial("id").primaryKey(),
  postKey: varchar("post_key", { length: 48 }).notNull().unique(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  postType: varchar("post_type", { length: 8 }).notNull(),
  petType: varchar("pet_type", { length: 16 }).notNull(),
  petName: varchar("pet_name", { length: 100 }),
  breed: varchar("breed", { length: 100 }),
  colorPrimary: varchar("color_primary", { length: 60 }),
  colorSecondary: varchar("color_secondary", { length: 60 }),
  sizeCategory: varchar("size_category", { length: 16 }).default("unknown"),
  sex: varchar("sex", { length: 16 }).default("unknown"),
  description: text("description").notNull(),
  rewardAmount: numeric("reward_amount", { precision: 10, scale: 2 }),
  contactPreference: varchar("contact_preference", { length: 32 }).default("inbox_first"),
  contactPhone: varchar("contact_phone", { length: 32 }),
  city: varchar("city", { length: 100 }).notNull(),
  area: varchar("area", { length: 100 }),
  addressText: varchar("address_text", { length: 255 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  eventDate: varchar("event_date", { length: 16 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  moderationStatus: varchar("moderation_status", { length: 20 }).default("pending"),
  moderationReason: text("moderation_reason"),
  moderationConfidence: integer("moderation_confidence"),
  matchedPostCount: integer("matched_post_count").default(0),
  finalPublishCheckedAt: timestamp("final_publish_checked_at"),
  publishedAt: timestamp("published_at"),
  resolvedAt: timestamp("resolved_at"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PawFinderPost = typeof pawFinderPosts.$inferSelect;

export const pawFinderMedia = pgTable("paw_finder_media", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => pawFinderPosts.id),
  mediaRole: varchar("media_role", { length: 16 }).default("primary"),
  filePath: text("file_path").notNull(),
  mimeType: varchar("mime_type", { length: 64 }),
  geminiImageStatus: varchar("gemini_image_status", { length: 16 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PawFinderMedia = typeof pawFinderMedia.$inferSelect;

export const pawFinderMatches = pgTable("paw_finder_matches", {
  id: serial("id").primaryKey(),
  lostPostId: integer("lost_post_id").notNull().references(() => pawFinderPosts.id),
  foundPostId: integer("found_post_id").notNull().references(() => pawFinderPosts.id),
  distanceKm: numeric("distance_km", { precision: 8, scale: 3 }),
  dateGapDays: integer("date_gap_days"),
  similarityScore: integer("similarity_score").notNull().default(0),
  similarityReasons: jsonb("similarity_reasons").default([]),
  status: varchar("status", { length: 16 }).default("suggested"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PawFinderMatch = typeof pawFinderMatches.$inferSelect;

export const pawFinderContactRequests = pgTable("paw_finder_contact_requests", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => pawFinderPosts.id),
  requesterUserId: varchar("requester_user_id", { length: 128 }).notNull(),
  ownerUserId: varchar("owner_user_id", { length: 128 }).notNull(),
  messageText: text("message_text").notNull(),
  status: varchar("status", { length: 16 }).default("pending"),
  revealPhone: boolean("reveal_phone").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PawFinderContactRequest = typeof pawFinderContactRequests.$inferSelect;

export const pawFinderModerationEvents = pgTable("paw_finder_moderation_events", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => pawFinderPosts.id),
  stage: varchar("stage", { length: 32 }).notNull(),
  verdict: varchar("verdict", { length: 16 }).notNull(),
  confidence: integer("confidence"),
  flags: jsonb("flags").default([]),
  rawSummary: jsonb("raw_summary").default({}),
  actorUserId: varchar("actor_user_id", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PawFinderModerationEvent = typeof pawFinderModerationEvents.$inferSelect;

export const pawFinderEvents = pgTable("paw_finder_events", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => pawFinderPosts.id),
  eventName: varchar("event_name", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 16 }).default("info"),
  actorUserId: varchar("actor_user_id", { length: 128 }),
  payload: jsonb("payload").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PawFinderEvent = typeof pawFinderEvents.$inferSelect;

// ============================================================================
// WITHHOLDING REMITTANCE LEDGER (ניכוי מס במקור — מעקב העברה לרשות המסים)
// ============================================================================
// Tracks every withholding amount PetWash holds on behalf of the ITA:
//   status = 'held'     — deducted from provider payout, sitting in trust
//   status = 'remitted' — transferred to ITA for the relevant quarter
//   status = 'reversed' — booking was cancelled after withholding was held
//
// Required for quarterly ניכויים מהמקור reporting (Form 856) and for
// reconciliation between provider_commissions and actual ITA payments.
// ============================================================================

export const withholdingRemittanceLedger = pgTable("withholding_remittance_ledger", {
  id: serial("id").primaryKey(),

  bookingId: varchar("booking_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  providerType: varchar("provider_type").notNull(), // "walker" | "sitter" | "driver" | ...

  withholdingAmount: decimal("withholding_amount", { precision: 12, scale: 2 }).notNull(),
  withholdingRate: decimal("withholding_rate", { precision: 5, scale: 2 }).notNull(), // effective % applied (e.g. 20.00)
  grossPayoutAmount: decimal("gross_payout_amount", { precision: 12, scale: 2 }).notNull(), // provider gross before withholding

  // Reporting period "YYYY-QN" (e.g. "2026-Q1") — used for quarterly Form 856 aggregation
  period: varchar("period", { length: 10 }).notNull(),

  status: varchar("status").default("held").notNull(), // "held" | "remitted" | "reversed"

  // Populated when status transitions to 'remitted'
  remittedAt: timestamp("remitted_at"),
  itaRemittanceReference: varchar("ita_remittance_reference"), // ITA confirmation number

  // Populated when status transitions to 'reversed' (booking cancellation)
  reversedAt: timestamp("reversed_at"),
  reverseReason: text("reverse_reason"),

  osekType: varchar("osek_type"), // "osek_patur" | "osek_murshe" — echoed from provider_commissions
  commissionId: varchar("commission_id"), // FK to provider_commissions.commission_id

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wrl_booking").on(table.bookingId),
  index("idx_wrl_provider").on(table.providerId),
  index("idx_wrl_period").on(table.period),
  index("idx_wrl_status").on(table.status),
]);

export const insertWithholdingRemittanceLedgerSchema = createInsertSchema(withholdingRemittanceLedger).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWithholdingRemittanceLedger = z.infer<typeof insertWithholdingRemittanceLedgerSchema>;
export type WithholdingRemittanceLedger = typeof withholdingRemittanceLedger.$inferSelect;

// ── Login Security Events (new-login alert & recent-login security log) ───────
// Separate from the older auth_events table (which tracks raw auth attempts).
// This table stores per-login risk analysis with privacy-safe fields only.

export const loginSecurityEventTypeEnum = pgEnum('login_security_event_type', [
  'login_success',
  'new_device_login',
  'new_browser_login',
  'new_location_login',
  'high_risk_login',
]);

export const loginSecurityEvents = pgTable('login_security_events', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 128 }).notNull(),
  email: varchar('email', { length: 255 }),
  eventType: loginSecurityEventTypeEnum('event_type').notNull().default('login_success'),
  // IP stored as masked (last octet replaced with 'xxx') — never store raw
  maskedIp: varchar('masked_ip', { length: 64 }),
  // HMAC-SHA256 hash of raw IP + per-user salt — used for device/location comparison
  ipHash: varchar('ip_hash', { length: 64 }),
  country: varchar('country', { length: 100 }),
  city: varchar('city', { length: 100 }),
  device: varchar('device', { length: 100 }),    // mobile / desktop / tablet
  browser: varchar('browser', { length: 100 }),
  os: varchar('os', { length: 100 }),
  // SHA-256 hash of raw user-agent string — NOT the raw string
  userAgentHash: varchar('user_agent_hash', { length: 64 }),
  riskScore: integer('risk_score').default(0).notNull(),
  riskFlags: jsonb('risk_flags').default(sql`'[]'::jsonb`), // string[]
  isNewDevice: boolean('is_new_device').default(false).notNull(),
  isNewBrowser: boolean('is_new_browser').default(false).notNull(),
  isNewLocation: boolean('is_new_location').default(false).notNull(),
  isHighRiskIp: boolean('is_high_risk_ip').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_login_sec_events_user').on(table.userId),
  index('idx_login_sec_events_user_created').on(table.userId, table.createdAt),
]);

export type LoginSecurityEvent = typeof loginSecurityEvents.$inferSelect;
export type InsertLoginSecurityEvent = typeof loginSecurityEvents.$inferInsert;

// ============================================================================
// PRIVACY-FIRST ACCOUNT SCHEMA — 2026
// Implements the privacy-first account model requirements:
//   • No National ID / Passport for normal users
//   • Modular account data (notification consents, wash preferences, platform
//     access, account lifecycle requests)
//   • Business/high-risk legal ID gated behind separate table + audit log
// ============================================================================

// ── 1. BUSINESS LEGAL ID DOCUMENTS ─────────────────────────────────────────
// National ID, Passport, and equivalent government documents MUST NOT be
// collected for regular consumer accounts.  They are only permitted when:
//   (a) the account is a verified business entity, OR
//   (b) a compliance officer marks the transaction as high-risk and records
//       a documented reason in legal_reason.
//
// ACCESS: restricted to compliance officers and auditors only.
// Every row is append-only; corrections go in a new row with supersededById.
//
// DELETION POLICY — DO NOT cascade-delete legal/compliance documents.
// Legal obligations (Israeli Privacy Law, AML, GDPR Art. 17(3)) may require
// documents to be retained even after the account is deleted.  The safe
// lifecycle is:
//   active → deletion_requested → deletion_blocked_by_legal_retention
//                               OR anonymised (where law permits)
// The users table FK therefore uses ON DELETE RESTRICT; a dedicated background
// job manages retention expiry and anonymisation.
export const businessLegalIdDocuments = pgTable("business_legal_id_documents", {
  id: serial("id").primaryKey(),
  // The account this document belongs to
  // ON DELETE RESTRICT — do NOT allow the users row to be deleted while a
  // legal/compliance document for that user still exists. The erasure job
  // must handle this document first (anonymise or retain per legal obligation).
  userId: varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "restrict" }),
  // "business_verified" | "high_risk_payment" | "compliance_hold"
  collectionReason: varchar("collection_reason", { length: 60 }).notNull(),
  // Plain-text explanation recorded by the compliance officer
  legalReason: text("legal_reason").notNull(),
  // "national_id" | "passport" | "drivers_license" | "company_registration"
  documentType: varchar("document_type", { length: 40 }).notNull(),
  documentCountry: varchar("document_country", { length: 10 }).notNull(),
  // Secure storage URL (e.g. GCS signed object) — never a public URL
  documentStorageUrl: varchar("document_storage_url", { length: 512 }).notNull(),
  // SHA-256 hash of the raw document file for integrity verification
  documentFileHash: varchar("document_file_hash", { length: 64 }).notNull(),
  documentExpiresAt: date("document_expires_at"),
  // "pending" | "approved" | "rejected" | "superseded"
  verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("pending"),
  verifiedAt: timestamp("verified_at"),
  // The compliance officer / admin who approved or rejected
  reviewedByUserId: varchar("reviewed_by_user_id", { length: 128 }),
  reviewNotes: text("review_notes"),
  // Points to the newer row that supersedes this one (append-only corrections)
  supersededById: integer("superseded_by_id"),
  // IP address of the uploader (privacy-safe: last octet masked)
  uploaderMaskedIp: varchar("uploader_masked_ip", { length: 64 }),

  // ── LEGAL RETENTION FIELDS ─────────────────────────────────────────────────
  // "active" | "deletion_requested" | "deletion_blocked_by_legal_retention"
  //          | "anonymised" | "retained_for_legal_obligation"
  retentionStatus: varchar("retention_status", { length: 50 }).notNull().default("active"),
  // Earliest date the document MAY be deleted (set by compliance officer).
  // NULL means "no known end date" (retain indefinitely until reviewed).
  retentionExpiresAt: timestamp("retention_expires_at"),
  // Human-readable reason why deletion is blocked (e.g. "AML 7-year hold").
  // Populated when retentionStatus = deletion_blocked_by_legal_retention.
  deletionBlockedReason: text("deletion_blocked_reason"),
  // Timestamp when PII was removed and replaced with hashes (anonymisation).
  // documentStorageUrl and documentFileHash become tombstone references only.
  anonymisedAt: timestamp("anonymised_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biz_legal_id_user").on(table.userId),
  index("idx_biz_legal_id_status").on(table.verificationStatus),
  index("idx_biz_legal_id_retention").on(table.retentionStatus),
]);

export const insertBusinessLegalIdDocumentSchema = createInsertSchema(businessLegalIdDocuments).omit({
  id: true,
  createdAt: true,
});
export type InsertBusinessLegalIdDocument = z.infer<typeof insertBusinessLegalIdDocumentSchema>;
export type BusinessLegalIdDocument = typeof businessLegalIdDocuments.$inferSelect;

// ── 2. USER NOTIFICATION CONSENTS ──────────────────────────────────────────
// Separate table so each channel/purpose combination can be independently
// toggled and audited.  The users.communicationPreferences jsonb field remains
// for backward-compat caching but this table is the authoritative source.
//
// channel: "whatsapp" | "sms" | "email" | "push"
// purpose: "service_alerts" | "receipts" | "marketing" | "reminders"
export const userNotificationConsents = pgTable("user_notification_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 20 }).notNull(),
  purpose: varchar("purpose", { length: 30 }).notNull(),
  // Explicit opt-in required; default is false (consent not given)
  consented: boolean("consented").default(false).notNull(),
  // ISO 8601 timestamp when the user last changed this preference
  consentedAt: timestamp("consented_at"),
  // IP address at the time of consent change (last octet masked)
  consentIpMasked: varchar("consent_ip_masked", { length: 64 }),
  // Version of the privacy policy / T&C that was in effect when consent was given
  policyVersion: varchar("policy_version", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notif_consent_user").on(table.userId),
  // Enforce one row per user+channel+purpose combination
  uniqueIndex("idx_notif_consent_unique").on(table.userId, table.channel, table.purpose),
]);

export const insertUserNotificationConsentSchema = createInsertSchema(userNotificationConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserNotificationConsent = z.infer<typeof insertUserNotificationConsentSchema>;
export type UserNotificationConsent = typeof userNotificationConsents.$inferSelect;

// ── 3. USER WASH PREFERENCES ───────────────────────────────────────────────
// Decoupled from the main users row so preferences can be versioned and
// restored independently.
export const userWashPreferences = pgTable("user_wash_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  // "economy" | "standard" | "premium" | "luxury"
  preferredWashPackage: varchar("preferred_wash_package", { length: 30 }),
  // "morning" | "afternoon" | "evening" | "any"
  preferredTimeSlot: varchar("preferred_time_slot", { length: 20 }),
  preferredStationId: varchar("preferred_station_id", { length: 80 }),
  useEcoWater: boolean("use_eco_water").default(false),
  addFragranceService: boolean("add_fragrance_service").default(false),
  addDryingService: boolean("add_drying_service").default(false),
  // Free-form notes stored by the owner (not shown to public)
  washNotes: text("wash_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wash_prefs_user").on(table.userId),
]);

export const insertUserWashPreferencesSchema = createInsertSchema(userWashPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserWashPreferences = z.infer<typeof insertUserWashPreferencesSchema>;
export type UserWashPreferences = typeof userWashPreferences.$inferSelect;

// ── 4. ACCOUNT DELETION REQUESTS ───────────────────────────────────────────
// Implements the "right to erasure" (GDPR Art. 17 / Israel Privacy Law).
// A request moves through: pending → processing → completed | rejected.
// Actual data erasure is performed by a scheduled job that processes rows
// in "processing" status; it records the erased_at timestamp on completion.
export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "restrict" }),
  // "user_requested" | "admin_initiated" | "legal_hold_expired"
  requestReason: varchar("request_reason", { length: 60 }).notNull().default("user_requested"),
  // Optional free-text from the user
  userNotes: text("user_notes"),
  // "pending" | "processing" | "completed" | "rejected" | "cancelled"
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // Scheduled date after which the data may be erased (cooling-off period)
  scheduledErasureAt: timestamp("scheduled_erasure_at"),
  erasedAt: timestamp("erased_at"),
  // Admin who rejected or approved, if applicable
  reviewedByUserId: varchar("reviewed_by_user_id", { length: 128 }),
  reviewNotes: text("review_notes"),
  // IP at request time (last octet masked)
  requestIpMasked: varchar("request_ip_masked", { length: 64 }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_acct_del_user").on(table.userId),
  index("idx_acct_del_status").on(table.status),
  index("idx_acct_del_scheduled").on(table.scheduledErasureAt),
]);

export const insertAccountDeletionRequestSchema = createInsertSchema(accountDeletionRequests).omit({
  id: true,
  requestedAt: true,
  updatedAt: true,
});
export type InsertAccountDeletionRequest = z.infer<typeof insertAccountDeletionRequestSchema>;
export type AccountDeletionRequest = typeof accountDeletionRequests.$inferSelect;

// ── 5. DATA EXPORT REQUESTS ─────────────────────────────────────────────────
// Implements the "right of access" / data portability (GDPR Art. 15 & 20).
// A background job generates a structured JSON/ZIP archive and stores a
// signed download URL.  The URL expires after downloadUrlExpiresAt.
export const dataExportRequests = pgTable("data_export_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "restrict" }),
  // "pending" | "processing" | "ready" | "downloaded" | "expired" | "failed"
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // Signed, time-limited download URL generated after processing
  downloadUrl: varchar("download_url", { length: 512 }),
  downloadUrlExpiresAt: timestamp("download_url_expires_at"),
  downloadedAt: timestamp("downloaded_at"),
  // IP at request time (last octet masked)
  requestIpMasked: varchar("request_ip_masked", { length: 64 }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
}, (table) => [
  index("idx_data_export_user").on(table.userId),
  index("idx_data_export_status").on(table.status),
]);

export const insertDataExportRequestSchema = createInsertSchema(dataExportRequests).omit({
  id: true,
  requestedAt: true,
});
export type InsertDataExportRequest = z.infer<typeof insertDataExportRequestSchema>;
export type DataExportRequest = typeof dataExportRequests.$inferSelect;

// ── 6. USER PLATFORM ACCESS ─────────────────────────────────────────────────
// Tracks which PetWash platform modules each user account has access to.
// Enables multi-platform readiness without polluting the core users table.
// One row per user+platform combination.
//
// platformCode values match the platform slugs used across the super-app:
//   "wash_station" | "pet_sitting" | "dog_walking" | "academy"
//   | "lost_and_found" | "pettrek" | "mobile_vet" (future)
export const userPlatformAccess = pgTable("user_platform_access", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  // Matches platform slugs: wash_station, pet_sitting, dog_walking, academy,
  // lost_and_found, pettrek — extensible for future services
  platformCode: varchar("platform_code", { length: 40 }).notNull(),
  // "active" | "suspended" | "pending_verification" | "revoked"
  accessStatus: varchar("access_status", { length: 30 }).notNull().default("active"),
  // "customer" | "provider" | "staff" | "admin"
  accessRole: varchar("access_role", { length: 20 }).notNull().default("customer"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  // Admin who granted or revoked access
  grantedByUserId: varchar("granted_by_user_id", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_platform_access_user").on(table.userId),
  index("idx_platform_access_platform").on(table.platformCode),
  uniqueIndex("idx_platform_access_unique").on(table.userId, table.platformCode),
]);

export const insertUserPlatformAccessSchema = createInsertSchema(userPlatformAccess).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPlatformAccess = z.infer<typeof insertUserPlatformAccessSchema>;
export type UserPlatformAccess = typeof userPlatformAccess.$inferSelect;

// ──────────────────────────────────────────────────────────────────────────
// Supplier-invoice screening (First Safe PR — migration 0024).
// Inbound supplier-invoice screening pipeline. Stops at "ready_for_accountant"
// — moves NO money, sends NOTHING to SUMIT (those are separate, flag-gated
// follow-up PRs per docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md).
// All routes gated by SystemConfig flag `ff.supplier_invoice_control.enabled`
// (default OFF). FK to `suppliers` (shared/schema-corporate.ts) is enforced at
// the DB level by migration 0024; the Drizzle definition omits .references()
// to avoid a cross-file import cycle.
// ──────────────────────────────────────────────────────────────────────────

export const supplierInvoices = pgTable("supplier_invoices", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id"), // FK to suppliers.id (DB-level, ON DELETE RESTRICT)
  // File / OCR
  fileUrl: text("file_url"),
  fileHash: varchar("file_hash", { length: 64 }).notNull(),
  source: varchar("source", { length: 40 }).default("admin_upload"),
  ocrInvoiceNumber: varchar("ocr_invoice_number", { length: 120 }),
  ocrSupplierName: varchar("ocr_supplier_name", { length: 255 }),
  ocrBusinessNumber: varchar("ocr_business_number", { length: 40 }),
  ocrInvoiceDate: date("ocr_invoice_date"),
  ocrAmountBeforeVat: decimal("ocr_amount_before_vat", { precision: 12, scale: 2 }),
  ocrVatAmount: decimal("ocr_vat_amount", { precision: 12, scale: 2 }),
  ocrTotalAmount: decimal("ocr_total_amount", { precision: 12, scale: 2 }),
  ocrCurrency: varchar("ocr_currency", { length: 8 }),
  ocrRawText: text("ocr_raw_text"),
  // Fraud-engine enrichment (reuses ReceiptFraudDetection)
  fraudEngineScore: integer("fraud_engine_score"),
  fraudEngineFlags: text("fraud_engine_flags").array(),
  // Screening result
  riskScore: integer("risk_score").notNull().default(0),
  riskLevel: varchar("risk_level", { length: 10 }).notNull().default("green"),
  status: varchar("status", { length: 30 }).notNull().default("uploaded"),
  // Approval / four-eyes
  uploadedBy: varchar("uploaded_by", { length: 128 }),
  approvedBy: varchar("approved_by", { length: 128 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedBy: varchar("rejected_by", { length: 128 }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  approvalNote: text("approval_note"),
  // SUMIT (sumit.co.il) linkage — populated by PR-S4 once the admin
  // "Send to SUMIT" button + ff.supplier_invoice_control.sumit_send.enabled
  // flag are wired. All nullable; null means "never attempted".
  sumitDocumentId: varchar("sumit_document_id", { length: 64 }),
  sumitStatus: varchar("sumit_status", { length: 20 }), // pending | sent | confirmed | failed | null
  sumitSentAt: timestamp("sumit_sent_at", { withTimezone: true }),
  sumitConfirmedAt: timestamp("sumit_confirmed_at", { withTimezone: true }),
  sumitLastError: text("sumit_last_error"),
  sumitIdempotencyKey: varchar("sumit_idempotency_key", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_supplier_invoices_supplier").on(table.supplierId),
  index("idx_supplier_invoices_file_hash").on(table.fileHash),
  index("idx_supplier_invoices_status").on(table.status),
  index("idx_supplier_invoices_risk").on(table.riskLevel),
  index("idx_supplier_invoices_supplier_invnum").on(table.supplierId, table.ocrInvoiceNumber),
  index("idx_supplier_invoices_sumit_status").on(table.sumitStatus),
  // Unique-when-not-null is enforced at the DB level by the migration
  // (partial unique indexes). Drizzle index() here exists for query
  // planning only.
  index("idx_supplier_invoices_sumit_document").on(table.sumitDocumentId),
  index("idx_supplier_invoices_sumit_idem").on(table.sumitIdempotencyKey),
]);

export const supplierInvoiceChecks = pgTable("supplier_invoice_checks", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(), // FK to supplier_invoices.id (DB-level, ON DELETE CASCADE)
  checkType: varchar("check_type", { length: 60 }).notNull(),
  result: varchar("result", { length: 10 }).notNull(),
  scoreImpact: integer("score_impact").notNull().default(0),
  details: jsonb("details"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_supplier_invoice_checks_invoice").on(table.invoiceId),
]);

// Append-only audit log of every SUMIT (sumit.co.il) call. One row per
// outbound request or inbound webhook. Never UPDATEd after insert — used
// for replay, debug, reconciliation, and compliance review. Empty until
// PR-S4 wires the admin "Send to SUMIT" button.
export const sumitOutboundEvents = pgTable("sumit_outbound_events", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(), // FK to supplier_invoices.id ON DELETE CASCADE
  eventType: varchar("event_type", { length: 40 }).notNull(),
    // create_document | create_document_retry | webhook_received | reconcile_lookup
  direction: varchar("direction", { length: 10 }).notNull(), // outbound | inbound
  sumitDocumentId: varchar("sumit_document_id", { length: 64 }),
  idempotencyKey: varchar("idempotency_key", { length: 80 }).notNull(),
  requestPayload: jsonb("request_payload"),
  responseStatusCode: integer("response_status_code"),
  responseBody: jsonb("response_body"),
  errorMessage: text("error_message"),
  actor: varchar("actor", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_sumit_outbound_events_invoice").on(table.invoiceId),
  index("idx_sumit_outbound_events_created_desc").on(table.createdAt),
  index("idx_sumit_outbound_events_idem").on(table.idempotencyKey),
  index("idx_sumit_outbound_events_doc").on(table.sumitDocumentId),
]);

export type SupplierInvoice = typeof supplierInvoices.$inferSelect;
export type InsertSupplierInvoice = typeof supplierInvoices.$inferInsert;
export type SupplierInvoiceCheck = typeof supplierInvoiceChecks.$inferSelect;
export type InsertSupplierInvoiceCheck = typeof supplierInvoiceChecks.$inferInsert;

// ──────────────────────────────────────────────────────────────────────────
// Marketplace booking slot locks (migration 0028)
//
// Closes the hostile-audit critical: two customers booking the same
// provider for overlapping time. The Postgres EXCLUDE constraint (added
// in the SQL migration, not directly expressible in Drizzle) makes
// overlapping inserts fail at the DB level. Drizzle definition exists
// so the helper in server/lib/marketplaceSlotLock.ts can type-check
// inserts; the actual no-overlap guarantee comes from the EXCLUDE.
// ──────────────────────────────────────────────────────────────────────────
export const marketplaceBookingSlotLocks = pgTable("marketplace_booking_slot_locks", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  bookingRef: text("booking_ref").notNull(),
  serviceType: varchar("service_type", { length: 40 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_marketplace_slot_locks_provider").on(table.providerId, table.startAt),
  index("idx_marketplace_slot_locks_booking_ref").on(table.bookingRef),
]);

export type MarketplaceBookingSlotLock = typeof marketplaceBookingSlotLocks.$inferSelect;
export type InsertMarketplaceBookingSlotLock = typeof marketplaceBookingSlotLocks.$inferInsert;

// ──────────────────────────────────────────────────────────────────────────
// Nayax webhook deduplication (migration 0029)
//
// Insert-first dedup table — every Nayax webhook hits this table BEFORE
// any handler runs. INSERT ... ON CONFLICT DO NOTHING RETURNING event_id
// is atomic: if returning() is empty, the event_id was already processed
// and we return 200 OK without reprocessing.
//
// Replaces the previous Redis-backed dedup that failed OPEN when Redis
// was unavailable. Postgres backed = survives process restart + horizontal
// scale, no race window.
// ──────────────────────────────────────────────────────────────────────────
export const nayaxProcessedEventIds = pgTable("nayax_processed_event_ids", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  sourceRoute: varchar("source_route", { length: 60 }),
}, (table) => [
  index("idx_nayax_processed_event_ids_processed_at").on(table.processedAt),
]);

export type NayaxProcessedEventId = typeof nayaxProcessedEventIds.$inferSelect;
export type InsertNayaxProcessedEventId = typeof nayaxProcessedEventIds.$inferInsert;
export type SumitOutboundEvent = typeof sumitOutboundEvents.$inferSelect;
export type InsertSumitOutboundEvent = typeof sumitOutboundEvents.$inferInsert;

// Maya reception/intake — see migration 0028_maya_reception_intake_foundation.sql
export * from './schema-maya';

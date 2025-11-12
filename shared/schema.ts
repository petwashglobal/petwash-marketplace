import {
  pgTable,
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
  date
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
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  dateOfBirth: varchar("date_of_birth"),
  country: varchar("country").default("IL"),
  gender: varchar("gender"),
  language: varchar("language").default("en"),
  loyaltyTier: varchar("loyalty_tier").default("new"), // new, regular, verified_senior, verified_disability
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  loyaltyTier: varchar("loyalty_tier").default("bronze"), // bronze, silver, gold, platinum
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  washBalance: integer("wash_balance").default(0),
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
  personalMessage: text("personal_message"),
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
}, (table) => ({
  emailIdx: index("idx_staff_applications_email").on(table.email),
  statusIdx: index("idx_staff_applications_status").on(table.status),
  typeIdx: index("idx_staff_applications_type").on(table.applicationType),
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

export const paymentIntents = pgTable("payment_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  jobOfferId: varchar("job_offer_id").references(() => jobOffers.id),
  
  // Nayax Payment Details
  nayaxAuthorizationId: varchar("nayax_authorization_id"), // Nayax pre-auth transaction ID
  nayaxCaptureId: varchar("nayax_capture_id"), // Nayax capture transaction ID
  nayaxTerminalId: varchar("nayax_terminal_id"),
  
  // Payment Amounts
  authorizedAmount: decimal("authorized_amount", { precision: 10, scale: 2 }).notNull(),
  capturedAmount: decimal("captured_amount", { precision: 10, scale: 2 }),
  refundedAmount: decimal("refunded_amount", { precision: 10, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("ILS").notNull(),
  
  // Payment Breakdown (Marketplace model)
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }).notNull(), // Pet Wash cut
  operatorPayout: decimal("operator_payout", { precision: 10, scale: 2 }).notNull(), // What operator gets
  vat: decimal("vat", { precision: 10, scale: 2 }).notNull(),
  
  // Payment Status
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, authorized, captured, refunded, failed
  
  // Timestamps (Critical for Nayax reconciliation)
  authorizedAt: timestamp("authorized_at"),
  capturedAt: timestamp("captured_at"),
  refundedAt: timestamp("refunded_at"),
  expiresAt: timestamp("expires_at"), // Authorization expiry (typically 7-30 days)
  
  // Audit & Compliance
  customerId: varchar("customer_id").notNull(),
  operatorId: varchar("operator_id"),
  platform: varchar("platform", { length: 50 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 100 }), // credit_card, apple_pay, google_pay
  
  // Error Handling
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("idx_payment_intents_booking").on(table.bookingId),
  jobOfferIdx: index("idx_payment_intents_job_offer").on(table.jobOfferId),
  statusIdx: index("idx_payment_intents_status").on(table.status),
  nayaxAuthIdx: index("idx_payment_intents_nayax_auth").on(table.nayaxAuthorizationId),
  customerIdx: index("idx_payment_intents_customer").on(table.customerId),
  operatorIdx: index("idx_payment_intents_operator").on(table.operatorId),
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

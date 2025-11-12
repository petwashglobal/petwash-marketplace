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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * =================== COMPLIANCE CONTROL TOWER ===================
 * Comprehensive legal compliance and regulatory management system
 * 
 * Protects against legal issues with:
 * - Employees, subcontractors, partners, JV, franchising
 * - Government agencies (Israeli ministries, municipalities)
 * - Customers, service providers
 * 
 * Like Airbnb, Booking.com, TripAdvisor compliance systems
 * Created: November 10, 2025
 */

// =================== AUTHORITY DOCUMENTS & LICENSES ===================

/**
 * Government authority approvals and licenses
 * Israeli ministries, municipal permits, international certifications
 */
export const authorityDocuments = pgTable("authority_documents", {
  id: serial("id").primaryKey(),
  documentType: varchar("document_type").notNull(), // business_license, ministry_approval, municipal_permit, insurance_certificate, professional_license
  
  // Issuing Authority
  authorityName: varchar("authority_name").notNull(), // "Israeli Ministry of Agriculture", "Tel Aviv Municipality"
  authorityNameHe: varchar("authority_name_he"), // "משרד החקלאות", "עיריית תל אביב"
  authorityType: varchar("authority_type").notNull(), // ministry, municipality, regulatory_body, insurance_company
  country: varchar("country").default("Israel"),
  
  // Document Details
  documentNumber: varchar("document_number").notNull().unique(),
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  
  // Validity & Expiry
  issuedDate: date("issued_date").notNull(),
  expiryDate: date("expiry_date"), // null = never expires
  status: varchar("status").default("active").notNull(), // active, expired, revoked, pending_renewal
  
  // Files & Verification
  documentUrl: text("document_url").notNull(), // GCS URL to PDF/image
  verificationUrl: text("verification_url"), // Link to government database for verification
  qrCode: text("qr_code"), // QR code for quick verification
  
  // Coverage & Scope
  coverageAmount: decimal("coverage_amount", { precision: 15, scale: 2 }), // For insurance
  coverageCurrency: varchar("coverage_currency").default("ILS"),
  applicableServices: jsonb("applicable_services"), // ["wash", "sitting", "walking", "transport"]
  applicableLocations: jsonb("applicable_locations"), // ["all"] or specific franchises
  
  // Compliance & Risk
  complianceLevel: varchar("compliance_level").default("mandatory").notNull(), // mandatory, recommended, optional
  riskCategory: varchar("risk_category").default("medium"), // low, medium, high, critical
  autoRenewalEnabled: boolean("auto_renewal_enabled").default(false),
  
  // Public Display (like Airbnb shows licenses)
  displayPublicly: boolean("display_publicly").default(true),
  displayBadge: boolean("display_badge").default(true), // Show "Verified" badge
  displayPriority: integer("display_priority").default(1), // 1 = highest priority
  
  // Notifications
  reminderDaysBefore: integer("reminder_days_before").default(30), // Alert 30 days before expiry
  lastReminderSent: timestamp("last_reminder_sent"),
  
  // Audit Trail
  uploadedBy: integer("uploaded_by"), // FK to hrEmployees or users
  verifiedBy: integer("verified_by"), // Admin who verified
  verifiedAt: timestamp("verified_at"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  documentTypeIdx: index("idx_auth_doc_type").on(table.documentType),
  authorityIdx: index("idx_auth_authority").on(table.authorityName),
  statusIdx: index("idx_auth_status").on(table.status),
  expiryIdx: index("idx_auth_expiry").on(table.expiryDate),
  publicDisplayIdx: index("idx_auth_public").on(table.displayPublicly),
}));

/**
 * Provider-specific licenses and certifications
 * For walkers, sitters, drivers, station operators
 */
export const providerLicenses = pgTable("provider_licenses", {
  id: serial("id").primaryKey(),
  
  // Provider Info
  providerId: integer("provider_id").notNull(), // FK to walker/sitter/driver/operator
  providerType: varchar("provider_type").notNull(), // walker, sitter, driver, station_operator
  providerName: varchar("provider_name").notNull(),
  providerEmail: varchar("provider_email").notNull(),
  
  // License Details
  licenseType: varchar("license_type").notNull(), // professional_groomer, first_aid_pet, driver_license, veterinary_technician, food_handler
  licenseNumber: varchar("license_number").notNull(),
  issuingBody: varchar("issuing_body").notNull(), // "Israeli Veterinary Services", "Red Magen David Adom"
  issuingBodyHe: varchar("issuing_body_he"),
  
  // Validity
  issuedDate: date("issued_date").notNull(),
  expiryDate: date("expiry_date"),
  status: varchar("status").default("active").notNull(), // active, expired, suspended, revoked
  
  // Files
  certificateUrl: text("certificate_url").notNull(),
  verificationUrl: text("verification_url"),
  
  // Compliance
  isMandatory: boolean("is_mandatory").default(true), // Required to operate?
  isVerified: boolean("is_verified").default(false),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at"),
  
  // Auto-enforcement
  autoSuspendOnExpiry: boolean("auto_suspend_on_expiry").default(true), // Auto-block provider when expired
  reminderDaysBefore: integer("reminder_days_before").default(30),
  lastReminderSent: timestamp("last_reminder_sent"),
  
  // Audit
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdx: index("idx_prov_lic_provider").on(table.providerId, table.providerType),
  licenseTypeIdx: index("idx_prov_lic_type").on(table.licenseType),
  statusIdx: index("idx_prov_lic_status").on(table.status),
  expiryIdx: index("idx_prov_lic_expiry").on(table.expiryDate),
  mandatoryIdx: index("idx_prov_lic_mandatory").on(table.isMandatory),
}));

// =================== BOOKING POLICIES & DISPUTE RESOLUTION ===================

/**
 * Cancellation and refund policies (like Airbnb/Booking.com)
 */
export const bookingPolicies = pgTable("booking_policies", {
  id: serial("id").primaryKey(),
  
  // Policy Identity
  policyId: varchar("policy_id").unique().notNull(), // CANCEL-FLEX-001, REFUND-STRICT-002
  policyName: varchar("policy_name").notNull(),
  policyNameHe: varchar("policy_name_he"),
  
  // Applicable Services
  serviceType: varchar("service_type").notNull(), // wash, sitting, walking, transport, all
  policyTier: varchar("policy_tier").default("standard").notNull(), // flexible, moderate, strict
  
  // Cancellation Rules (JSON)
  cancellationRules: jsonb("cancellation_rules").notNull(), 
  /* Example:
  {
    "24_hours_before": { "refund_percent": 100, "fee": 0 },
    "12_hours_before": { "refund_percent": 50, "fee": 10 },
    "less_than_12": { "refund_percent": 0, "fee": 20 }
  }
  */
  
  // Refund Settings
  autoRefundEnabled: boolean("auto_refund_enabled").default(true),
  refundProcessingDays: integer("refund_processing_days").default(5), // 5 business days
  refundMethod: varchar("refund_method").default("original_payment"), // original_payment, store_credit, bank_transfer
  
  // Dispute Escalation
  disputeEscalationHours: integer("dispute_escalation_hours").default(48), // 48 hours to resolve
  requiresManualReview: boolean("requires_manual_review").default(false),
  escalationEmail: varchar("escalation_email"), // legal@petwash.co.il
  
  // Legal Protection
  termsUrl: text("terms_url"),
  displayInBookingFlow: boolean("display_in_booking_flow").default(true),
  requiresAcknowledgment: boolean("requires_acknowledgment").default(true),
  
  // Multi-country
  applicableCountries: jsonb("applicable_countries"), // ["IL", "US", "GB"]
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveDate: date("effective_date").notNull(),
  version: varchar("version").default("1.0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  policyIdIdx: uniqueIndex("idx_booking_policy_id").on(table.policyId),
  serviceIdx: index("idx_booking_service").on(table.serviceType),
  activeIdx: index("idx_booking_active").on(table.isActive),
}));

/**
 * Dispute and refund tracking
 */
export const disputeResolutions = pgTable("dispute_resolutions", {
  id: serial("id").primaryKey(),
  
  // Dispute Info
  disputeId: varchar("dispute_id").unique().notNull(), // DISP-2025-001234
  bookingId: integer("booking_id").notNull(), // FK to booking
  serviceType: varchar("service_type").notNull(),
  
  // Parties
  customerId: integer("customer_id").notNull(),
  providerId: integer("provider_id").notNull(),
  providerType: varchar("provider_type").notNull(),
  
  // Dispute Details
  disputeType: varchar("dispute_type").notNull(), // cancellation, quality, damage, no_show, late_arrival
  disputeReason: text("dispute_reason").notNull(),
  disputeReasonHe: text("dispute_reason_he"),
  customerEvidence: jsonb("customer_evidence"), // URLs to photos, videos
  providerEvidence: jsonb("provider_evidence"),
  
  // Financial
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }).notNull(),
  disputedAmount: decimal("disputed_amount", { precision: 10, scale: 2 }).notNull(),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  
  // Resolution
  status: varchar("status").default("open").notNull(), // open, investigating, resolved_customer, resolved_provider, escalated, closed
  resolution: text("resolution"),
  resolutionHe: text("resolution_he"),
  resolvedBy: integer("resolved_by"), // Admin ID
  resolvedAt: timestamp("resolved_at"),
  
  // Escalation
  isEscalated: boolean("is_escalated").default(false),
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),
  legalReviewRequired: boolean("legal_review_required").default(false),
  
  // SLA Tracking
  targetResolutionDate: timestamp("target_resolution_date").notNull(),
  actualResolutionDate: timestamp("actual_resolution_date"),
  slaBreached: boolean("sla_breached").default(false),
  
  // Audit
  aiRecommendation: text("ai_recommendation"), // Gemini AI suggestion
  internalNotes: text("internal_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  disputeIdIdx: uniqueIndex("idx_dispute_id").on(table.disputeId),
  bookingIdx: index("idx_dispute_booking").on(table.bookingId),
  statusIdx: index("idx_dispute_status").on(table.status),
  escalatedIdx: index("idx_dispute_escalated").on(table.isEscalated),
  slaIdx: index("idx_dispute_sla").on(table.targetResolutionDate),
}));

// =================== REVIEW MODERATION & LEGAL PROTECTION ===================

/**
 * Review moderation rules (like TripAdvisor)
 */
export const reviewModerationRules = pgTable("review_moderation_rules", {
  id: serial("id").primaryKey(),
  
  // Rule Identity
  ruleId: varchar("rule_id").unique().notNull(), // MOD-DEFAM-001, MOD-PROFANITY-002
  ruleName: varchar("rule_name").notNull(),
  ruleNameHe: varchar("rule_name_he"),
  
  // Detection
  ruleType: varchar("rule_type").notNull(), // defamation, profanity, fake_review, spam, personal_info
  detectionMethod: varchar("detection_method").notNull(), // ai_gemini, keyword_match, pattern_analysis, manual_review
  
  // Keywords & Patterns
  keywords: jsonb("keywords"), // Banned words/phrases
  keywordsHe: jsonb("keywords_he"),
  patterns: jsonb("patterns"), // Regex patterns
  
  // Action
  moderationAction: varchar("moderation_action").default("flag_for_review").notNull(), // auto_block, flag_for_review, require_approval
  requiresLegalReview: boolean("requires_legal_review").default(false),
  
  // Severity
  severityLevel: varchar("severity_level").default("medium"), // low, medium, high, critical
  autoEscalate: boolean("auto_escalate").default(false),
  
  // Legal Protection
  legalBasis: text("legal_basis"), // "Israeli Defamation Law 1965, Section 7"
  safeHarborApplies: boolean("safe_harbor_applies").default(true), // Platform protection
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ruleIdIdx: uniqueIndex("idx_mod_rule_id").on(table.ruleId),
  typeIdx: index("idx_mod_type").on(table.ruleType),
  activeIdx: index("idx_mod_active").on(table.isActive),
}));

/**
 * Review moderation audit trail
 */
export const reviewModeration = pgTable("review_moderation", {
  id: serial("id").primaryKey(),
  
  // Review Reference
  reviewId: integer("review_id").notNull(), // FK to reviews table
  customerId: integer("customer_id").notNull(),
  providerId: integer("provider_id").notNull(),
  serviceType: varchar("service_type").notNull(),
  
  // Content
  originalReviewText: text("original_review_text").notNull(),
  moderatedReviewText: text("moderated_review_text"),
  rating: integer("rating"),
  
  // Moderation Result
  status: varchar("status").default("pending").notNull(), // pending, approved, rejected, flagged, escalated
  flaggedReason: varchar("flagged_reason"), // defamation, profanity, fake_review, personal_info
  flaggedByRule: varchar("flagged_by_rule"), // Rule ID that triggered
  
  // AI Analysis
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 5, scale: 2 }), // 0-100
  aiDetectedIssues: jsonb("ai_detected_issues"), // ["possible_defamation", "contains_personal_info"]
  aiRecommendation: varchar("ai_recommendation"), // approve, reject, manual_review
  
  // Human Review
  reviewedBy: integer("reviewed_by"), // Admin/moderator ID
  reviewedAt: timestamp("reviewed_at"),
  moderatorNotes: text("moderator_notes"),
  
  // Legal
  legalReviewRequired: boolean("legal_review_required").default(false),
  legalReviewedBy: integer("legal_reviewed_by"),
  legalReviewedAt: timestamp("legal_reviewed_at"),
  legalNotes: text("legal_notes"),
  
  // Provider Response
  providerNotified: boolean("provider_notified").default(false),
  providerNotifiedAt: timestamp("provider_notified_at"),
  providerResponseText: text("provider_response_text"),
  providerResponseAt: timestamp("provider_response_at"),
  
  // Immutable Audit Trail
  auditHash: varchar("audit_hash"), // Cryptographic hash for tamper-proof audit
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  reviewIdx: index("idx_review_mod_review").on(table.reviewId),
  statusIdx: index("idx_review_mod_status").on(table.status),
  legalIdx: index("idx_review_mod_legal").on(table.legalReviewRequired),
}));

// =================== CORPORATE GOVERNANCE ===================

/**
 * Board resolutions and corporate decisions
 */
export const boardResolutions = pgTable("board_resolutions", {
  id: serial("id").primaryKey(),
  
  // Resolution Identity
  resolutionId: varchar("resolution_id").unique().notNull(), // RES-2025-001
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  
  // Type & Category
  resolutionType: varchar("resolution_type").notNull(), // policy_approval, contract_approval, compliance_update, strategic_decision
  category: varchar("category").notNull(), // legal, financial, operational, hr, regulatory
  
  // Details
  description: text("description").notNull(),
  descriptionHe: text("description_he"),
  legalBasis: text("legal_basis"), // "Companies Law 5759-1999, Section 92"
  
  // Decision
  decision: text("decision").notNull(),
  decisionHe: text("decision_he"),
  votingResults: jsonb("voting_results"), // { "for": 5, "against": 0, "abstain": 1 }
  
  // Approval
  approvalStatus: varchar("approval_status").default("draft").notNull(), // draft, pending, approved, rejected
  approvedBy: jsonb("approved_by"), // Array of board member IDs
  approvedAt: timestamp("approved_at"),
  
  // Effective Period
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  
  // Files
  documentUrl: text("document_url"),
  digitalSignatures: jsonb("digital_signatures"), // Board member signatures
  
  // Public Display
  isPublic: boolean("is_public").default(false),
  displayOnWebsite: boolean("display_on_website").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  resolutionIdIdx: uniqueIndex("idx_resolution_id").on(table.resolutionId),
  typeIdx: index("idx_resolution_type").on(table.resolutionType),
  statusIdx: index("idx_resolution_status").on(table.approvalStatus),
}));

/**
 * Corporate seals and trust badges
 */
export const corporateSeals = pgTable("corporate_seals", {
  id: serial("id").primaryKey(),
  
  // Seal Identity
  sealId: varchar("seal_id").unique().notNull(), // SEAL-LICENSE-2025, SEAL-VERIFIED-001
  sealType: varchar("seal_type").notNull(), // licensed_platform, verified_business, ministry_approved, insurance_verified
  
  // Display
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  description: text("description"),
  descriptionHe: text("description_he"),
  
  // Visual
  badgeImageUrl: text("badge_image_url").notNull(), // SVG/PNG badge
  badgeColor: varchar("badge_color").default("#10B981"), // Green for verified
  iconName: varchar("icon_name"), // lucide-react icon name
  
  // Verification
  isVerified: boolean("is_verified").default(true),
  verificationUrl: text("verification_url"), // Link to government database
  qrCodeUrl: text("qr_code_url"),
  
  // Authority Reference
  issuingAuthority: varchar("issuing_authority"),
  authorityDocumentId: integer("authority_document_id"), // FK to authorityDocuments
  
  // Display Rules
  displayLocations: jsonb("display_locations"), // ["website_footer", "booking_page", "mobile_app"]
  displayPriority: integer("display_priority").default(1),
  
  // Validity
  isActive: boolean("is_active").default(true),
  expiryDate: date("expiry_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  sealIdIdx: uniqueIndex("idx_seal_id").on(table.sealId),
  typeIdx: index("idx_seal_type").on(table.sealType),
  activeIdx: index("idx_seal_active").on(table.isActive),
}));

// =================== COMPLIANCE TASKS & MONITORING ===================

/**
 * AI-driven compliance tasks and alerts
 */
export const complianceTasks = pgTable("compliance_tasks", {
  id: serial("id").primaryKey(),
  
  // Task Identity
  taskId: varchar("task_id").unique().notNull(), // TASK-2025-001234
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  
  // Type & Category
  taskType: varchar("task_type").notNull(), // document_renewal, license_verification, policy_update, audit_required
  category: varchar("category").notNull(), // legal, financial, regulatory, operational
  
  // Details
  description: text("description").notNull(),
  descriptionHe: text("description_he"),
  actionRequired: text("action_required").notNull(),
  actionRequiredHe: text("action_required_he"),
  
  // Priority & Urgency
  priority: varchar("priority").default("medium").notNull(), // low, medium, high, critical
  urgency: varchar("urgency").default("normal"), // normal, urgent, emergency
  riskLevel: varchar("risk_level").default("medium"), // low, medium, high, critical
  
  // Assignment
  assignedTo: integer("assigned_to"), // Employee/admin ID
  assignedRole: varchar("assigned_role"), // legal_team, compliance_officer, admin
  assignedAt: timestamp("assigned_at"),
  
  // Deadlines
  dueDate: timestamp("due_date").notNull(),
  reminderDate: timestamp("reminder_date"),
  escalationDate: timestamp("escalation_date"),
  
  // Status
  status: varchar("status").default("pending").notNull(), // pending, in_progress, blocked, completed, overdue, cancelled
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by"),
  
  // AI Automation
  aiGenerated: boolean("ai_generated").default(false),
  aiDetectedIssue: text("ai_detected_issue"),
  aiRecommendedAction: text("ai_recommended_action"),
  autoCloseOnCompletion: boolean("auto_close_on_completion").default(true),
  
  // Related Entities
  relatedEntityType: varchar("related_entity_type"), // authority_document, provider_license, booking_policy
  relatedEntityId: integer("related_entity_id"),
  
  // Notifications
  notificationsSent: integer("notifications_sent").default(0),
  lastNotificationAt: timestamp("last_notification_at"),
  
  // Audit
  notes: text("notes"),
  resolutionNotes: text("resolution_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  taskIdIdx: uniqueIndex("idx_task_id").on(table.taskId),
  statusIdx: index("idx_task_status").on(table.status),
  priorityIdx: index("idx_task_priority").on(table.priority),
  dueIdx: index("idx_task_due").on(table.dueDate),
  assignedIdx: index("idx_task_assigned").on(table.assignedTo),
}));

/**
 * Compliance audit trail (immutable)
 */
export const complianceAuditTrail = pgTable("compliance_audit_trail", {
  id: serial("id").primaryKey(),
  
  // Event Identity
  eventId: varchar("event_id").unique().notNull(), // AUDIT-2025-001234567
  eventType: varchar("event_type").notNull(), // document_uploaded, license_verified, policy_updated, dispute_resolved
  
  // Entity Reference
  entityType: varchar("entity_type").notNull(), // authority_document, provider_license, booking_policy, dispute
  entityId: integer("entity_id").notNull(),
  
  // Action
  action: varchar("action").notNull(), // created, updated, deleted, verified, approved, rejected
  actionBy: integer("action_by"), // User/admin ID
  actionByName: varchar("action_by_name"),
  actionByRole: varchar("action_by_role"),
  
  // Details
  previousState: jsonb("previous_state"), // State before change
  newState: jsonb("new_state"), // State after change
  changesSummary: text("changes_summary"),
  
  // Context
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  deviceFingerprint: varchar("device_fingerprint"),
  
  // Immutability
  cryptographicHash: varchar("cryptographic_hash").notNull(), // SHA-256 hash for tamper-proof
  previousHash: varchar("previous_hash"), // Chain to previous audit entry
  
  // Metadata
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  systemNotes: text("system_notes"),
}, (table) => ({
  eventIdIdx: uniqueIndex("idx_compliance_audit_event_id").on(table.eventId),
  entityIdx: index("idx_compliance_audit_entity").on(table.entityType, table.entityId),
  actionIdx: index("idx_compliance_audit_action").on(table.action),
  timestampIdx: index("idx_compliance_audit_timestamp").on(table.timestamp),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertAuthorityDocumentSchema = createInsertSchema(authorityDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityDocument = z.infer<typeof insertAuthorityDocumentSchema>;
export type AuthorityDocument = typeof authorityDocuments.$inferSelect;

export const insertProviderLicenseSchema = createInsertSchema(providerLicenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProviderLicense = z.infer<typeof insertProviderLicenseSchema>;
export type ProviderLicense = typeof providerLicenses.$inferSelect;

export const insertBookingPolicySchema = createInsertSchema(bookingPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBookingPolicy = z.infer<typeof insertBookingPolicySchema>;
export type BookingPolicy = typeof bookingPolicies.$inferSelect;

export const insertDisputeResolutionSchema = createInsertSchema(disputeResolutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDisputeResolution = z.infer<typeof insertDisputeResolutionSchema>;
export type DisputeResolution = typeof disputeResolutions.$inferSelect;

export const insertReviewModerationRuleSchema = createInsertSchema(reviewModerationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReviewModerationRule = z.infer<typeof insertReviewModerationRuleSchema>;
export type ReviewModerationRule = typeof reviewModerationRules.$inferSelect;

export const insertReviewModerationSchema = createInsertSchema(reviewModeration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReviewModeration = z.infer<typeof insertReviewModerationSchema>;
export type ReviewModeration = typeof reviewModeration.$inferSelect;

export const insertBoardResolutionSchema = createInsertSchema(boardResolutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBoardResolution = z.infer<typeof insertBoardResolutionSchema>;
export type BoardResolution = typeof boardResolutions.$inferSelect;

export const insertCorporateSealSchema = createInsertSchema(corporateSeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCorporateSeal = z.infer<typeof insertCorporateSealSchema>;
export type CorporateSeal = typeof corporateSeals.$inferSelect;

export const insertComplianceTaskSchema = createInsertSchema(complianceTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertComplianceTask = z.infer<typeof insertComplianceTaskSchema>;
export type ComplianceTask = typeof complianceTasks.$inferSelect;

export const insertComplianceAuditTrailSchema = createInsertSchema(complianceAuditTrail).omit({
  id: true,
  timestamp: true,
});
export type InsertComplianceAuditTrail = z.infer<typeof insertComplianceAuditTrailSchema>;
export type ComplianceAuditTrail = typeof complianceAuditTrail.$inferSelect;

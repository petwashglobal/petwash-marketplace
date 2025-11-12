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

// =================== CORPORATE GOVERNANCE ===================

export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  position: varchar("position").notNull(), // Chairman, CEO, CFO, CTO, Independent Director
  bio: text("bio"),
  photoUrl: varchar("photo_url"),
  isActive: boolean("is_active").default(true),
  appointedDate: date("appointed_date").notNull(),
  terminationDate: date("termination_date"),
  votingRights: boolean("voting_rights").default(true),
  equityShares: decimal("equity_shares", { precision: 10, scale: 4 }), // % ownership
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const boardMeetings = pgTable("board_meetings", {
  id: serial("id").primaryKey(),
  meetingDate: timestamp("meeting_date").notNull(),
  meetingType: varchar("meeting_type").notNull(), // regular, special, emergency
  location: varchar("location"), // physical address or "Virtual"
  agenda: text("agenda").notNull(),
  minutesDocument: text("minutes_document"), // URL to meeting minutes PDF
  status: varchar("status").default("scheduled"), // scheduled, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dateIdx: index("idx_board_meetings_date").on(table.meetingDate),
  statusIdx: index("idx_board_meetings_status").on(table.status),
}));

// JOIN TABLE: Board Meeting Attendees
export const boardMeetingAttendees = pgTable("board_meeting_attendees", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => boardMeetings.id, { onDelete: 'cascade' }).notNull(),
  memberId: integer("member_id").references(() => boardMembers.id, { onDelete: 'cascade' }).notNull(),
  attended: boolean("attended").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  meetingIdx: index("idx_meeting_attendees_meeting").on(table.meetingId),
  memberIdx: index("idx_meeting_attendees_member").on(table.memberId),
  uniqueAttendance: uniqueIndex("idx_unique_attendance").on(table.meetingId, table.memberId),
}));

export const boardResolutions = pgTable("board_resolutions", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => boardMeetings.id, { onDelete: 'set null' }),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  proposedBy: integer("proposed_by").references(() => boardMembers.id, { onDelete: 'set null' }),
  votesFor: integer("votes_for").default(0),
  votesAgainst: integer("votes_against").default(0),
  votesAbstain: integer("votes_abstain").default(0),
  status: varchar("status").default("proposed"), // proposed, approved, rejected, withdrawn
  approvedAt: timestamp("approved_at"),
  implementedAt: timestamp("implemented_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  statusIdx: index("idx_board_resolutions_status").on(table.status),
}));

export const boardVotes = pgTable("board_votes", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => boardMeetings.id, { onDelete: 'cascade' }),
  memberId: integer("member_id").references(() => boardMembers.id, { onDelete: 'cascade' }).notNull(),
  resolutionId: integer("resolution_id").references(() => boardResolutions.id, { onDelete: 'cascade' }),
  vote: varchar("vote").notNull(), // for, against, abstain
  comment: text("comment"),
  votedAt: timestamp("voted_at").defaultNow(),
}, (table) => ({
  meetingIdx: index("idx_board_votes_meeting").on(table.meetingId),
  resolutionIdx: index("idx_board_votes_resolution").on(table.resolutionId),
}));

// =================== JV PARTNERS ===================

export const jvPartners = pgTable("jv_partners", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name").notNull(),
  legalName: varchar("legal_name").notNull(),
  registrationNumber: varchar("registration_number").unique(),
  country: varchar("country").notNull(),
  primaryContact: varchar("primary_contact").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  address: text("address"),
  partnershipType: varchar("partnership_type").notNull(), // strategic, financial, technology, distribution
  equityStake: decimal("equity_stake", { precision: 10, scale: 4 }), // % ownership in joint ventures
  isActive: boolean("is_active").default(true),
  partnerSince: date("partner_since").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jvContracts = pgTable("jv_contracts", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => jvPartners.id, { onDelete: 'cascade' }).notNull(),
  contractNumber: varchar("contract_number").unique().notNull(),
  title: varchar("title").notNull(),
  contractType: varchar("contract_type").notNull(), // revenue_share, licensing, distribution, development
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  autoRenewal: boolean("auto_renewal").default(false),
  documentUrl: text("document_url"), // signed contract PDF
  revenueSharePercent: decimal("revenue_share_percent", { precision: 5, scale: 2 }),
  minimumGuarantee: decimal("minimum_guarantee", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("ILS"),
  status: varchar("status").default("active"), // draft, active, expired, terminated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  partnerIdx: index("idx_jv_contracts_partner").on(table.partnerId),
  statusIdx: index("idx_jv_contracts_status").on(table.status),
}));

export const jvRevenueShares = pgTable("jv_revenue_shares", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => jvContracts.id, { onDelete: 'cascade' }).notNull(),
  partnerId: integer("partner_id").references(() => jvPartners.id, { onDelete: 'cascade' }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  grossRevenue: decimal("gross_revenue", { precision: 12, scale: 2 }).notNull(),
  revenueSharePercent: decimal("revenue_share_percent", { precision: 5, scale: 2 }).notNull(),
  shareAmount: decimal("share_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, overdue
  paidAt: timestamp("paid_at"),
  invoiceUrl: text("invoice_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  contractIdx: index("idx_jv_revenue_contract").on(table.contractId),
  partnerIdx: index("idx_jv_revenue_partner").on(table.partnerId),
  periodIdx: index("idx_jv_revenue_period").on(table.periodStart, table.periodEnd),
}));

// =================== SUPPLIERS ===================

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name").notNull(),
  legalName: varchar("legal_name"),
  registrationNumber: varchar("registration_number"),
  taxId: varchar("tax_id"),
  country: varchar("country").notNull(),
  primaryContact: varchar("primary_contact").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  address: text("address"),
  supplierType: varchar("supplier_type").notNull(), // shampoo, equipment, maintenance, logistics, IT
  paymentTerms: varchar("payment_terms").default("Net 30"), // Net 30, Net 60, Immediate
  preferredCurrency: varchar("preferred_currency").default("ILS"),
  bankAccountDetails: jsonb("bank_account_details"), // encrypted
  isActive: boolean("is_active").default(true),
  isApproved: boolean("is_approved").default(false),
  qualityScore: decimal("quality_score", { precision: 3, scale: 1 }).default("0"), // 0-10 rating
  onboardedAt: date("onboarded_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  typeIdx: index("idx_suppliers_type").on(table.supplierType),
  activeIdx: index("idx_suppliers_active").on(table.isActive),
}));

export const supplierContracts = pgTable("supplier_contracts", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: 'cascade' }).notNull(),
  contractNumber: varchar("contract_number").unique().notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  autoRenewal: boolean("auto_renewal").default(false),
  documentUrl: text("document_url"),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("ILS"),
  paymentSchedule: varchar("payment_schedule"), // monthly, quarterly, per_delivery
  status: varchar("status").default("active"), // draft, active, expired, terminated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  supplierIdx: index("idx_supplier_contracts_supplier").on(table.supplierId),
  statusIdx: index("idx_supplier_contracts_status").on(table.status),
}));

export const supplierQualityScores = pgTable("supplier_quality_scores", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: 'cascade' }).notNull(),
  evaluationDate: date("evaluation_date").notNull(),
  qualityScore: decimal("quality_score", { precision: 3, scale: 1 }).notNull(), // 0-10
  deliveryScore: decimal("delivery_score", { precision: 3, scale: 1 }).notNull(), // on-time delivery
  priceScore: decimal("price_score", { precision: 3, scale: 1 }).notNull(), // competitiveness
  serviceScore: decimal("service_score", { precision: 3, scale: 1 }).notNull(), // customer service
  overallScore: decimal("overall_score", { precision: 3, scale: 1 }).notNull(), // weighted average
  comments: text("comments"),
  evaluatedBy: varchar("evaluated_by"), // admin UID
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  supplierIdx: index("idx_quality_scores_supplier").on(table.supplierId),
  dateIdx: index("idx_quality_scores_date").on(table.evaluationDate),
}));

export const supplierPayments = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: 'cascade' }).notNull(),
  contractId: integer("contract_id").references(() => supplierContracts.id, { onDelete: 'set null' }),
  invoiceNumber: varchar("invoice_number").unique().notNull(),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, overdue, cancelled
  paidAt: timestamp("paid_at"),
  paymentMethod: varchar("payment_method"), // bank_transfer, check, credit_card
  paymentReference: varchar("payment_reference"),
  invoiceUrl: text("invoice_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  supplierIdx: index("idx_supplier_payments_supplier").on(table.supplierId),
  statusIdx: index("idx_supplier_payments_status").on(table.paymentStatus),
  dueIdx: index("idx_supplier_payments_due").on(table.dueDate),
}));

// =================== STATION REGISTRY (Canonical Pet Wash Hub IDs) ===================

export const stationRegistry = pgTable("station_registry", {
  id: serial("id").primaryKey(),
  stationId: varchar("station_id").unique().notNull(), // PWH-IL-001, PWH-US-NYC-001
  stationName: varchar("station_name").notNull(),
  stationNameHe: varchar("station_name_he"),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  region: varchar("region"), // state/province
  country: varchar("country").default("IL").notNull(),
  postalCode: varchar("postal_code"),
  coordinates: jsonb("coordinates"), // { lat, lng }
  stationType: varchar("station_type").default("k9000"), // k9000, mobile, popup
  ownershipType: varchar("ownership_type").notNull(), // corporate, franchise, partner
  franchiseeId: integer("franchisee_id"), // references franchisees table
  operatingStatus: varchar("operating_status").default("active"), // active, inactive, maintenance, closed
  installDate: date("install_date"),
  lastMaintenanceDate: date("last_maintenance_date"),
  nextMaintenanceDate: date("next_maintenance_date"),
  qrCode: text("qr_code"), // QR code data for station
  nayaxTerminalId: varchar("nayax_terminal_id"),
  equipmentSerial: varchar("equipment_serial"), // K9000 serial number
  monthlyRevenue: decimal("monthly_revenue", { precision: 10, scale: 2 }).default("0"),
  totalWashes: integer("total_washes").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  photoUrls: jsonb("photo_urls"), // array of station photos
  operatingHours: jsonb("operating_hours"), // { monday: "08:00-20:00", ... }
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  stationIdIdx: uniqueIndex("idx_station_registry_id").on(table.stationId),
  cityIdx: index("idx_station_registry_city").on(table.city),
  countryIdx: index("idx_station_registry_country").on(table.country),
  statusIdx: index("idx_station_registry_status").on(table.operatingStatus),
  franchiseeIdx: index("idx_station_registry_franchisee").on(table.franchiseeId),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

// Board Members
export const insertBoardMemberSchema = createInsertSchema(boardMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBoardMember = z.infer<typeof insertBoardMemberSchema>;
export type BoardMember = typeof boardMembers.$inferSelect;

// Board Meetings
export const insertBoardMeetingSchema = createInsertSchema(boardMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBoardMeeting = z.infer<typeof insertBoardMeetingSchema>;
export type BoardMeeting = typeof boardMeetings.$inferSelect;

// Board Meeting Attendees
export const insertBoardMeetingAttendeeSchema = createInsertSchema(boardMeetingAttendees).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardMeetingAttendee = z.infer<typeof insertBoardMeetingAttendeeSchema>;
export type BoardMeetingAttendee = typeof boardMeetingAttendees.$inferSelect;

// Board Resolutions
export const insertBoardResolutionSchema = createInsertSchema(boardResolutions).omit({
  id: true,
  createdAt: true,
});
export type InsertBoardResolution = z.infer<typeof insertBoardResolutionSchema>;
export type BoardResolution = typeof boardResolutions.$inferSelect;

// Board Votes
export const insertBoardVoteSchema = createInsertSchema(boardVotes).omit({
  id: true,
  votedAt: true,
});
export type InsertBoardVote = z.infer<typeof insertBoardVoteSchema>;
export type BoardVote = typeof boardVotes.$inferSelect;

// JV Partners
export const insertJvPartnerSchema = createInsertSchema(jvPartners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJvPartner = z.infer<typeof insertJvPartnerSchema>;
export type JvPartner = typeof jvPartners.$inferSelect;

// JV Contracts
export const insertJvContractSchema = createInsertSchema(jvContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJvContract = z.infer<typeof insertJvContractSchema>;
export type JvContract = typeof jvContracts.$inferSelect;

// JV Revenue Shares
export const insertJvRevenueShareSchema = createInsertSchema(jvRevenueShares).omit({
  id: true,
  createdAt: true,
});
export type InsertJvRevenueShare = z.infer<typeof insertJvRevenueShareSchema>;
export type JvRevenueShare = typeof jvRevenueShares.$inferSelect;

// Suppliers
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Supplier Contracts
export const insertSupplierContractSchema = createInsertSchema(supplierContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupplierContract = z.infer<typeof insertSupplierContractSchema>;
export type SupplierContract = typeof supplierContracts.$inferSelect;

// Supplier Quality Scores
export const insertSupplierQualityScoreSchema = createInsertSchema(supplierQualityScores).omit({
  id: true,
  createdAt: true,
});
export type InsertSupplierQualityScore = z.infer<typeof insertSupplierQualityScoreSchema>;
export type SupplierQualityScore = typeof supplierQualityScores.$inferSelect;

// Supplier Payments
export const insertSupplierPaymentSchema = createInsertSchema(supplierPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupplierPayment = z.infer<typeof insertSupplierPaymentSchema>;
export type SupplierPayment = typeof supplierPayments.$inferSelect;

// Station Registry
export const insertStationRegistrySchema = createInsertSchema(stationRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStationRegistry = z.infer<typeof insertStationRegistrySchema>;
export type StationRegistry = typeof stationRegistry.$inferSelect;

// =================== GLOBAL CORPORATION STRUCTURE ===================

export const legalEntities = pgTable("legal_entities", {
  id: serial("id").primaryKey(),
  entityId: varchar("entity_id").unique().notNull(), // PWASH-IL-001, PWASH-US-001
  legalName: varchar("legal_name").notNull(),
  tradingName: varchar("trading_name"),
  entityType: varchar("entity_type").notNull(), // parent, subsidiary, branch, representative_office
  parentEntityId: integer("parent_entity_id"), // self-referencing for hierarchy
  jurisdictionCountry: varchar("jurisdiction_country").notNull(),
  jurisdictionState: varchar("jurisdiction_state"), // for US/Canada/Australia
  registrationNumber: varchar("registration_number").unique(),
  taxIdentificationNumber: varchar("tax_identification_number"),
  vatNumber: varchar("vat_number"),
  incorporationDate: date("incorporation_date"),
  fiscalYearEnd: varchar("fiscal_year_end"), // MM-DD format
  baseCurrency: varchar("base_currency").default("ILS"),
  registeredAddress: text("registered_address"),
  businessAddress: text("business_address"),
  isActive: boolean("is_active").default(true),
  isHoldingCompany: boolean("is_holding_company").default(false),
  ownershipPercentage: decimal("ownership_percentage", { precision: 5, scale: 2 }), // if subsidiary
  establishmentPurpose: text("establishment_purpose"),
  authorizedCapital: decimal("authorized_capital", { precision: 15, scale: 2 }),
  paidUpCapital: decimal("paid_up_capital", { precision: 15, scale: 2 }),
  numberOfEmployees: integer("number_of_employees").default(0),
  annualRevenue: decimal("annual_revenue", { precision: 15, scale: 2 }),
  companyWebsite: varchar("company_website"),
  legalCounsel: varchar("legal_counsel"),
  auditor: varchar("auditor"),
  complianceStatus: varchar("compliance_status").default("compliant"), // compliant, warning, non_compliant
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  entityIdIdx: uniqueIndex("idx_legal_entities_id").on(table.entityId),
  countryIdx: index("idx_legal_entities_country").on(table.jurisdictionCountry),
  typeIdx: index("idx_legal_entities_type").on(table.entityType),
  parentIdx: index("idx_legal_entities_parent").on(table.parentEntityId),
  activeIdx: index("idx_legal_entities_active").on(table.isActive),
}));

export const intercompanyAgreements = pgTable("intercompany_agreements", {
  id: serial("id").primaryKey(),
  agreementNumber: varchar("agreement_number").unique().notNull(), // ICA-2025-001
  agreementType: varchar("agreement_type").notNull(), // service_agreement, licensing, cost_sharing, loan, transfer_pricing
  fromEntityId: integer("from_entity_id").references(() => legalEntities.id).notNull(),
  toEntityId: integer("to_entity_id").references(() => legalEntities.id).notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  autoRenewal: boolean("auto_renewal").default(false),
  documentUrl: text("document_url"),
  annualValue: decimal("annual_value", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("USD"),
  transferPricingMethod: varchar("transfer_pricing_method"), // CUP, RPM, CPM, TNMM, PSM
  armLengthCompliant: boolean("arm_length_compliant").default(true),
  status: varchar("status").default("active"), // draft, active, expired, terminated
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  fromEntityIdx: index("idx_intercompany_from").on(table.fromEntityId),
  toEntityIdx: index("idx_intercompany_to").on(table.toEntityId),
  typeIdx: index("idx_intercompany_type").on(table.agreementType),
  statusIdx: index("idx_intercompany_status").on(table.status),
}));

export const taxTreaties = pgTable("tax_treaties", {
  id: serial("id").primaryKey(),
  countryA: varchar("country_a").notNull(),
  countryB: varchar("country_b").notNull(),
  treatyName: varchar("treaty_name").notNull(),
  effectiveDate: date("effective_date"),
  dividendWithholdingRate: decimal("dividend_withholding_rate", { precision: 5, scale: 2 }),
  interestWithholdingRate: decimal("interest_withholding_rate", { precision: 5, scale: 2 }),
  royaltyWithholdingRate: decimal("royalty_withholding_rate", { precision: 5, scale: 2 }),
  capitalGainsProvision: text("capital_gains_provision"),
  permanentEstablishmentDef: text("permanent_establishment_def"),
  treatyDocumentUrl: text("treaty_document_url"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  countriesIdx: index("idx_tax_treaties_countries").on(table.countryA, table.countryB),
  activeIdx: index("idx_tax_treaties_active").on(table.isActive),
}));

export const transferPricingDocumentation = pgTable("transfer_pricing_documentation", {
  id: serial("id").primaryKey(),
  documentYear: integer("document_year").notNull(),
  entityId: integer("entity_id").references(() => legalEntities.id).notNull(),
  documentType: varchar("document_type").notNull(), // master_file, local_file, cbc_report
  reportingCurrency: varchar("reporting_currency").default("USD"),
  totalIntercompanyRevenue: decimal("total_intercompany_revenue", { precision: 15, scale: 2 }),
  totalIntercompanyCosts: decimal("total_intercompany_costs", { precision: 15, scale: 2 }),
  documentUrl: text("document_url"),
  preparedBy: varchar("prepared_by"),
  reviewedBy: varchar("reviewed_by"),
  approvedBy: varchar("approved_by"),
  submittedToAuthority: boolean("submitted_to_authority").default(false),
  submissionDate: date("submission_date"),
  complianceStatus: varchar("compliance_status").default("draft"), // draft, complete, submitted, approved
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearIdx: index("idx_tp_documentation_year").on(table.documentYear),
  entityIdx: index("idx_tp_documentation_entity").on(table.entityId),
  typeIdx: index("idx_tp_documentation_type").on(table.documentType),
}));

// =================== EMPLOYMENT CONTRACTS & AGREEMENTS ===================

export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  templateId: varchar("template_id").unique().notNull(), // TMPL-EMP-FT-001
  templateName: varchar("template_name").notNull(),
  templateType: varchar("template_type").notNull(), // employment, contractor, franchise, nda, ip_assignment
  contractCategory: varchar("contract_category").notNull(), // full_time, part_time, temporary, seasonal, walker, sitter, driver, trainer
  jurisdictionCountry: varchar("jurisdiction_country").notNull(),
  jurisdictionState: varchar("jurisdiction_state"),
  language: varchar("language").default("en"), // en, he, ar, fr, es, ru
  version: varchar("version").notNull(),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  templateContent: text("template_content").notNull(), // HTML/Markdown with {{variables}}
  variablesList: jsonb("variables_list"), // [{name: "employee_name", type: "string", required: true}]
  approvedBy: varchar("approved_by"),
  legalReviewDate: date("legal_review_date"),
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  templateIdIdx: uniqueIndex("idx_contract_templates_id").on(table.templateId),
  typeIdx: index("idx_contract_templates_type").on(table.templateType),
  categoryIdx: index("idx_contract_templates_category").on(table.contractCategory),
  countryIdx: index("idx_contract_templates_country").on(table.jurisdictionCountry),
  activeIdx: index("idx_contract_templates_active").on(table.isActive),
}));

export const generatedContracts = pgTable("generated_contracts", {
  id: serial("id").primaryKey(),
  contractNumber: varchar("contract_number").unique().notNull(), // CONT-2025-0001
  templateId: integer("template_id").references(() => contractTemplates.id).notNull(),
  entityId: integer("entity_id").references(() => legalEntities.id),
  contractType: varchar("contract_type").notNull(),
  partyAName: varchar("party_a_name").notNull(), // Company name
  partyARole: varchar("party_a_role").default("employer"),
  partyBName: varchar("party_b_name").notNull(), // Employee/contractor name
  partyBRole: varchar("party_b_role").notNull(), // employee, contractor, franchisee
  partyBEmail: varchar("party_b_email"),
  variablesData: jsonb("variables_data").notNull(), // {employee_name: "John Doe", salary: 5000, ...}
  generatedContent: text("generated_content").notNull(),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  signatureStatus: varchar("signature_status").default("pending"), // pending, signed, expired, terminated
  docusealSubmissionId: varchar("docuseal_submission_id"),
  signedDocumentUrl: text("signed_document_url"),
  signedByPartyAAt: timestamp("signed_by_party_a_at"),
  signedByPartyBAt: timestamp("signed_by_party_b_at"),
  renewalReminderSent: boolean("renewal_reminder_sent").default(false),
  nextRenewalDate: date("next_renewal_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  contractNumberIdx: uniqueIndex("idx_generated_contracts_number").on(table.contractNumber),
  templateIdx: index("idx_generated_contracts_template").on(table.templateId),
  typeIdx: index("idx_generated_contracts_type").on(table.contractType),
  statusIdx: index("idx_generated_contracts_status").on(table.signatureStatus),
  partyBEmailIdx: index("idx_generated_contracts_party_b_email").on(table.partyBEmail),
}));

export const jobDescriptions = pgTable("job_descriptions", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id").unique().notNull(), // JOB-2025-001
  jobTitle: varchar("job_title").notNull(),
  department: varchar("department").notNull(),
  employmentType: varchar("employment_type").notNull(), // full_time, part_time, temporary, seasonal
  seniorityLevel: varchar("seniority_level").notNull(), // entry, mid, senior, executive
  reportsTo: varchar("reports_to"),
  directReports: integer("direct_reports").default(0),
  location: varchar("location"),
  isRemote: boolean("is_remote").default(false),
  jobSummary: text("job_summary").notNull(),
  keyResponsibilities: text("key_responsibilities").notNull(),
  requiredQualifications: text("required_qualifications").notNull(),
  preferredQualifications: text("preferred_qualifications"),
  technicalSkills: jsonb("technical_skills"), // array of skills
  softSkills: jsonb("soft_skills"),
  salaryRangeMin: decimal("salary_range_min", { precision: 10, scale: 2 }),
  salaryRangeMax: decimal("salary_range_max", { precision: 10, scale: 2 }),
  salaryCurrency: varchar("salary_currency").default("ILS"),
  benefitsPackage: text("benefits_package"),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  jobIdIdx: uniqueIndex("idx_job_descriptions_id").on(table.jobId),
  titleIdx: index("idx_job_descriptions_title").on(table.jobTitle),
  departmentIdx: index("idx_job_descriptions_department").on(table.department),
  activeIdx: index("idx_job_descriptions_active").on(table.isActive),
}));

// =================== ORGANIZATIONAL STRUCTURE & AUTHORITY ===================

export const organizationalChart = pgTable("organizational_chart", {
  id: serial("id").primaryKey(),
  nodeId: varchar("node_id").unique().notNull(), // ORG-CEO, ORG-CFO, ORG-SALES
  nodeName: varchar("node_name").notNull(),
  nodeType: varchar("node_type").notNull(), // executive, department, team, individual
  parentNodeId: integer("parent_node_id"), // self-referencing
  entityId: integer("entity_id").references(() => legalEntities.id),
  employeeId: integer("employee_id"), // reference to hr_employees
  positionTitle: varchar("position_title"),
  departmentName: varchar("department_name"),
  level: integer("level").default(0), // 0=CEO, 1=C-Suite, 2=VPs, etc.
  headcount: integer("headcount").default(0),
  isActive: boolean("is_active").default(true),
  effectiveDate: date("effective_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  nodeIdIdx: uniqueIndex("idx_org_chart_node_id").on(table.nodeId),
  parentIdx: index("idx_org_chart_parent").on(table.parentNodeId),
  entityIdx: index("idx_org_chart_entity").on(table.entityId),
  typeIdx: index("idx_org_chart_type").on(table.nodeType),
  levelIdx: index("idx_org_chart_level").on(table.level),
}));

export const authorityLevels = pgTable("authority_levels", {
  id: serial("id").primaryKey(),
  roleTitle: varchar("role_title").notNull(),
  department: varchar("department"),
  authorityType: varchar("authority_type").notNull(), // spending, hiring, contract_approval, pricing, discount
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("ILS"),
  requiresApproval: boolean("requires_approval").default(false),
  approverRole: varchar("approver_role"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  roleIdx: index("idx_authority_levels_role").on(table.roleTitle),
  typeIdx: index("idx_authority_levels_type").on(table.authorityType),
}));

export const delegationOfAuthority = pgTable("delegation_of_authority", {
  id: serial("id").primaryKey(),
  doaNumber: varchar("doa_number").unique().notNull(), // DOA-2025-001
  delegatorEmployeeId: integer("delegator_employee_id"), // who is delegating
  delegateeEmployeeId: integer("delegatee_employee_id"), // who receives authority
  authorityType: varchar("authority_type").notNull(),
  scopeDescription: text("scope_description").notNull(),
  spendingLimit: decimal("spending_limit", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("ILS"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  reason: text("reason"),
  approvedBy: integer("approved_by"), // higher authority who approved
  status: varchar("status").default("active"), // pending, active, expired, revoked
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  doaNumberIdx: uniqueIndex("idx_doa_number").on(table.doaNumber),
  delegatorIdx: index("idx_doa_delegator").on(table.delegatorEmployeeId),
  delegateeIdx: index("idx_doa_delegatee").on(table.delegateeEmployeeId),
  statusIdx: index("idx_doa_status").on(table.status),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS (NEW) ===================

// Legal Entities
export const insertLegalEntitySchema = createInsertSchema(legalEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLegalEntity = z.infer<typeof insertLegalEntitySchema>;
export type LegalEntity = typeof legalEntities.$inferSelect;

// Intercompany Agreements
export const insertIntercompanyAgreementSchema = createInsertSchema(intercompanyAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertIntercompanyAgreement = z.infer<typeof insertIntercompanyAgreementSchema>;
export type IntercompanyAgreement = typeof intercompanyAgreements.$inferSelect;

// Tax Treaties
export const insertTaxTreatySchema = createInsertSchema(taxTreaties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTaxTreaty = z.infer<typeof insertTaxTreatySchema>;
export type TaxTreaty = typeof taxTreaties.$inferSelect;

// Transfer Pricing Documentation
export const insertTransferPricingDocumentationSchema = createInsertSchema(transferPricingDocumentation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTransferPricingDocumentation = z.infer<typeof insertTransferPricingDocumentationSchema>;
export type TransferPricingDocumentation = typeof transferPricingDocumentation.$inferSelect;

// Contract Templates
export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;

// Generated Contracts
export const insertGeneratedContractSchema = createInsertSchema(generatedContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGeneratedContract = z.infer<typeof insertGeneratedContractSchema>;
export type GeneratedContract = typeof generatedContracts.$inferSelect;

// Job Descriptions
export const insertJobDescriptionSchema = createInsertSchema(jobDescriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJobDescription = z.infer<typeof insertJobDescriptionSchema>;
export type JobDescription = typeof jobDescriptions.$inferSelect;

// Organizational Chart
export const insertOrganizationalChartSchema = createInsertSchema(organizationalChart).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganizationalChart = z.infer<typeof insertOrganizationalChartSchema>;
export type OrganizationalChart = typeof organizationalChart.$inferSelect;

// Authority Levels
export const insertAuthorityLevelSchema = createInsertSchema(authorityLevels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAuthorityLevel = z.infer<typeof insertAuthorityLevelSchema>;
export type AuthorityLevel = typeof authorityLevels.$inferSelect;

// Delegation of Authority
export const insertDelegationOfAuthoritySchema = createInsertSchema(delegationOfAuthority).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDelegationOfAuthority = z.infer<typeof insertDelegationOfAuthoritySchema>;
export type DelegationOfAuthority = typeof delegationOfAuthority.$inferSelect;

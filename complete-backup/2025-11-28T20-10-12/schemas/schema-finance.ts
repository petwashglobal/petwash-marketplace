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

// =================== ACCOUNTS/FINANCE DEPARTMENT ===================

export const accountsPayable = pgTable("accounts_payable", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number").unique().notNull(),
  supplierId: integer("supplier_id").notNull(), // FK to suppliers - cross-module
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: varchar("payment_status").default("pending"), // pending, scheduled, paid, overdue, cancelled
  paymentDate: date("payment_date"),
  paymentMethod: varchar("payment_method"),
  paymentReference: varchar("payment_reference"),
  glAccountCode: varchar("gl_account_code"), // General Ledger account
  category: varchar("category"), // supplies, equipment, services, utilities
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  invoiceUrl: text("invoice_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  supplierIdx: index("idx_ap_supplier").on(table.supplierId),
  statusIdx: index("idx_ap_status").on(table.paymentStatus),
  dueIdx: index("idx_ap_due").on(table.dueDate),
}));

export const accountsReceivable = pgTable("accounts_receivable", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number").unique().notNull(),
  customerId: varchar("customer_id").notNull(), // can be corporate client or franchise
  customerType: varchar("customer_type").notNull(), // customer, franchise, partner
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, overdue, partial, cancelled
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  balanceDue: decimal("balance_due", { precision: 12, scale: 2 }),
  paymentDate: date("payment_date"),
  paymentMethod: varchar("payment_method"),
  glAccountCode: varchar("gl_account_code"),
  category: varchar("category"), // wash_services, franchise_fees, product_sales
  invoiceUrl: text("invoice_url"),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderDate: date("last_reminder_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  customerIdx: index("idx_ar_customer").on(table.customerId),
  statusIdx: index("idx_ar_status").on(table.paymentStatus),
  dueIdx: index("idx_ar_due").on(table.dueDate),
}));

export const generalLedger = pgTable("general_ledger", {
  id: serial("id").primaryKey(),
  entryNumber: varchar("entry_number").unique().notNull(), // GL-2025-0001
  entryDate: date("entry_date").notNull(),
  accountCode: varchar("account_code").notNull(), // 1000, 2000, 3000, etc.
  accountName: varchar("account_name").notNull(),
  accountType: varchar("account_type").notNull(), // asset, liability, equity, revenue, expense
  debit: decimal("debit", { precision: 12, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 12, scale: 2 }).default("0"),
  currency: varchar("currency").default("ILS"),
  description: text("description").notNull(),
  referenceType: varchar("reference_type"), // invoice, payment, journal_entry
  referenceId: varchar("reference_id"),
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period").notNull(), // 1-12 for months
  enteredBy: integer("entered_by"),
  approvedBy: integer("approved_by"),
  isReconciled: boolean("is_reconciled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  entryNumberIdx: uniqueIndex("idx_gl_entry").on(table.entryNumber),
  accountIdx: index("idx_gl_account").on(table.accountCode),
  dateIdx: index("idx_gl_date").on(table.entryDate),
  fiscalIdx: index("idx_gl_fiscal").on(table.fiscalYear, table.fiscalPeriod),
}));

// =================== TAX COMPLIANCE & AUDIT TRAIL ===================

export const taxReturns = pgTable("tax_returns", {
  id: serial("id").primaryKey(),
  returnNumber: varchar("return_number").unique().notNull(), // TAX-2025-Q1-001
  returnType: varchar("return_type").notNull(), // vat_monthly, vat_quarterly, income_annual
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period").notNull(), // 1-12 for months, 1-4 for quarters
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).notNull(),
  taxableIncome: decimal("taxable_income", { precision: 12, scale: 2 }).notNull(),
  vatCollected: decimal("vat_collected", { precision: 12, scale: 2 }).default("0"),
  vatPaid: decimal("vat_paid", { precision: 12, scale: 2 }).default("0"),
  netVATOwed: decimal("net_vat_owed", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status").default("draft"), // draft, submitted, approved, rejected
  submittedToITA: boolean("submitted_to_ita").default(false),
  submittedAt: timestamp("submitted_at"),
  itaReferenceNumber: varchar("ita_reference_number"),
  approvedAt: timestamp("approved_at"),
  preparedBy: integer("prepared_by"),
  reviewedBy: integer("reviewed_by"),
  notes: text("notes"),
  attachments: jsonb("attachments"), // URLs to supporting documents
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  returnNumberIdx: uniqueIndex("idx_tax_returns_number").on(table.returnNumber),
  fiscalIdx: index("idx_tax_returns_fiscal").on(table.fiscalYear, table.fiscalPeriod),
  statusIdx: index("idx_tax_returns_status").on(table.status),
}));

export const taxPayments = pgTable("tax_payments", {
  id: serial("id").primaryKey(),
  paymentNumber: varchar("payment_number").unique().notNull(), // TAXPAY-2025-001
  taxReturnId: integer("tax_return_id"), // FK to tax_returns
  paymentType: varchar("payment_type").notNull(), // vat, income_tax, advance_tax
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: varchar("payment_method"), // bank_transfer, check, ita_direct_debit
  bankReference: varchar("bank_reference"),
  itaReceiptNumber: varchar("ita_receipt_number"),
  fiscalYear: integer("fiscal_year").notNull(),
  fiscalPeriod: integer("fiscal_period"),
  status: varchar("status").default("pending"), // pending, processed, confirmed, rejected
  confirmationUrl: text("confirmation_url"),
  paidBy: integer("paid_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  paymentNumberIdx: uniqueIndex("idx_tax_payments_number").on(table.paymentNumber),
  returnIdx: index("idx_tax_payments_return").on(table.taxReturnId),
  fiscalIdx: index("idx_tax_payments_fiscal").on(table.fiscalYear, table.fiscalPeriod),
}));

export const taxAuditLogs = pgTable("tax_audit_logs", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type").notNull(), // return_created, return_submitted, payment_made, ita_response
  entityType: varchar("entity_type").notNull(), // tax_return, tax_payment
  entityId: integer("entity_id").notNull(),
  action: varchar("action").notNull(), // create, update, submit, approve, reject, pay
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  userId: integer("user_id"),
  userEmail: varchar("user_email"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  auditHash: varchar("audit_hash").notNull(), // SHA-256 signature for immutability
  previousAuditHash: varchar("previous_audit_hash"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  entityIdx: index("idx_tax_audit_entity").on(table.entityType, table.entityId),
  eventIdx: index("idx_tax_audit_event").on(table.eventType),
  userIdx: index("idx_tax_audit_user").on(table.userId),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertAccountsPayableSchema = createInsertSchema(accountsPayable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoiceDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  paymentDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  approvedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertAccountsPayable = z.infer<typeof insertAccountsPayableSchema>;
export type AccountsPayable = typeof accountsPayable.$inferSelect;

export const insertAccountsReceivableSchema = createInsertSchema(accountsReceivable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoiceDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  paymentDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  lastReminderDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertAccountsReceivable = z.infer<typeof insertAccountsReceivableSchema>;
export type AccountsReceivable = typeof accountsReceivable.$inferSelect;

export const insertGeneralLedgerSchema = createInsertSchema(generalLedger).omit({
  id: true,
  createdAt: true,
}).extend({
  entryDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});
export type InsertGeneralLedger = z.infer<typeof insertGeneralLedgerSchema>;
export type GeneralLedger = typeof generalLedger.$inferSelect;

export const insertTaxReturnSchema = createInsertSchema(taxReturns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  periodStart: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  periodEnd: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  submittedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  approvedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertTaxReturn = z.infer<typeof insertTaxReturnSchema>;
export type TaxReturn = typeof taxReturns.$inferSelect;

export const insertTaxPaymentSchema = createInsertSchema(taxPayments).omit({
  id: true,
  createdAt: true,
}).extend({
  paymentDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});
export type InsertTaxPayment = z.infer<typeof insertTaxPaymentSchema>;
export type TaxPayment = typeof taxPayments.$inferSelect;

export const insertTaxAuditLogSchema = createInsertSchema(taxAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertTaxAuditLog = z.infer<typeof insertTaxAuditLogSchema>;
export type TaxAuditLog = typeof taxAuditLogs.$inferSelect;

// =================== MULTI-JURISDICTION TAX COMPLIANCE ===================

// US State Nexus Tracking (for multi-state tax compliance)
export const usStateNexus = pgTable("us_state_nexus", {
  id: serial("id").primaryKey(),
  state: varchar("state").notNull(),
  nexusType: varchar("nexus_type").notNull(),
  establishedDate: date("established_date").notNull(),
  salesThreshold: varchar("sales_threshold"),
  transactionThreshold: integer("transaction_threshold"),
  registrationNumber: varchar("registration_number"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  stateNexusTypeIdx: uniqueIndex("idx_us_state_nexus_state_type").on(table.state, table.nexusType),
  stateIdx: index("idx_us_state_nexus_state").on(table.state),
}));

// US Federal Tax Filings (quarterly/annual)
export const usFederalTaxFilings = pgTable("us_federal_tax_filings", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id"),
  filingType: varchar("filing_type").notNull(),
  taxYear: integer("tax_year").notNull(),
  quarter: integer("quarter"),
  taxAmount: varchar("tax_amount").notNull(),
  withholdingAmount: varchar("withholding_amount"),
  filingDate: date("filing_date").notNull(),
  confirmationNumber: varchar("confirmation_number"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  filingTypeYearIdx: index("idx_us_federal_filings_type_year").on(table.filingType, table.taxYear),
  entityIdx: index("idx_us_federal_filings_entity").on(table.entityId),
}));

// US State Tax Filings
export const usStateTaxFilings = pgTable("us_state_tax_filings", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id"),
  state: varchar("state").notNull(),
  filingType: varchar("filing_type").notNull(),
  taxYear: integer("tax_year").notNull(),
  quarter: integer("quarter"),
  taxAmount: varchar("tax_amount").notNull(),
  filingDate: date("filing_date").notNull(),
  confirmationNumber: varchar("confirmation_number"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  stateFilingTypeYearIdx: index("idx_us_state_filings_state_type_year").on(table.state, table.filingType, table.taxYear),
  entityIdx: index("idx_us_state_filings_entity").on(table.entityId),
}));

// US Federal Tax Compliance
export const usFederalTax = pgTable("us_federal_tax", {
  id: serial("id").primaryKey(),
  taxYear: integer("tax_year").notNull(),
  entityId: integer("entity_id").notNull(),
  ein: varchar("ein"),
  entityType: varchar("entity_type").notNull(),
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }).notNull(),
  deductions: decimal("deductions", { precision: 15, scale: 2 }).default("0"),
  taxableIncome: decimal("taxable_income", { precision: 15, scale: 2 }).notNull(),
  federalTaxRate: decimal("federal_tax_rate", { precision: 5, scale: 2 }),
  federalTaxOwed: decimal("federal_tax_owed", { precision: 15, scale: 2 }).notNull(),
  estimatedPaymentsMade: decimal("estimated_payments_made", { precision: 15, scale: 2 }).default("0"),
  form1120Filed: boolean("form_1120_filed").default(false),
  form1120SFiled: boolean("form_1120s_filed").default(false),
  form1065Filed: boolean("form_1065_filed").default(false),
  filingDeadline: date("filing_deadline").notNull(),
  filedDate: date("filed_date"),
  confirmationNumber: varchar("confirmation_number"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearIdx: index("idx_us_federal_tax_year").on(table.taxYear),
  entityIdx: index("idx_us_federal_tax_entity").on(table.entityId),
}));

// US State Tax Compliance
export const usStateTax = pgTable("us_state_tax", {
  id: serial("id").primaryKey(),
  taxYear: integer("tax_year").notNull(),
  entityId: integer("entity_id").notNull(),
  state: varchar("state").notNull(),
  stateEin: varchar("state_ein"),
  hasNexus: boolean("has_nexus").default(false),
  nexusType: varchar("nexus_type"),
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }),
  apportionmentPercentage: decimal("apportionment_percentage", { precision: 5, scale: 2 }),
  taxableIncome: decimal("taxable_income", { precision: 15, scale: 2 }),
  stateTaxRate: decimal("state_tax_rate", { precision: 5, scale: 2 }),
  incomeTaxOwed: decimal("income_tax_owed", { precision: 15, scale: 2 }).default("0"),
  salesTaxCollected: decimal("sales_tax_collected", { precision: 15, scale: 2 }).default("0"),
  salesTaxRemitted: decimal("sales_tax_remitted", { precision: 15, scale: 2 }).default("0"),
  filingDeadline: date("filing_deadline"),
  filedDate: date("filed_date"),
  confirmationNumber: varchar("confirmation_number"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearStateIdx: index("idx_us_state_tax_year_state").on(table.taxYear, table.state),
  entityIdx: index("idx_us_state_tax_entity").on(table.entityId),
}));

// US Payroll Tax
export const usPayrollTax = pgTable("us_payroll_tax", {
  id: serial("id").primaryKey(),
  taxYear: integer("tax_year").notNull(),
  quarter: varchar("quarter"),
  entityId: integer("entity_id").notNull(),
  totalW2Wages: decimal("total_w2_wages", { precision: 15, scale: 2 }).default("0"),
  totalW2Employees: integer("total_w2_employees").default(0),
  total1099Payments: decimal("total_1099_payments", { precision: 15, scale: 2 }).default("0"),
  total1099Contractors: integer("total_1099_contractors").default(0),
  federalWithholding: decimal("federal_withholding", { precision: 15, scale: 2 }).default("0"),
  socialSecurityWithheld: decimal("social_security_withheld", { precision: 15, scale: 2 }).default("0"),
  medicareWithheld: decimal("medicare_withheld", { precision: 15, scale: 2 }).default("0"),
  stateWithholding: decimal("state_withholding", { precision: 15, scale: 2 }).default("0"),
  form941Filed: boolean("form_941_filed").default(false),
  form940Filed: boolean("form_940_filed").default(false),
  w2sFiled: boolean("w2s_filed").default(false),
  w3Filed: boolean("w3_filed").default(false),
  form1099sFiled: boolean("form_1099s_filed").default(false),
  filingDeadline: date("filing_deadline"),
  filedDate: date("filed_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearIdx: index("idx_us_payroll_tax_year").on(table.taxYear),
  entityIdx: index("idx_us_payroll_tax_entity").on(table.entityId),
}));

// Canadian Tax Compliance
export const canadianTax = pgTable("canadian_tax", {
  id: serial("id").primaryKey(),
  taxYear: integer("tax_year").notNull(),
  entityId: integer("entity_id").notNull(),
  businessNumber: varchar("business_number"),
  province: varchar("province").notNull(),
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }).notNull(),
  federalTaxableIncome: decimal("federal_taxable_income", { precision: 15, scale: 2 }),
  federalTaxRate: decimal("federal_tax_rate", { precision: 5, scale: 2 }),
  federalTaxOwed: decimal("federal_tax_owed", { precision: 15, scale: 2 }),
  provincialTaxableIncome: decimal("provincial_taxable_income", { precision: 15, scale: 2 }),
  provincialTaxRate: decimal("provincial_tax_rate", { precision: 5, scale: 2 }),
  provincialTaxOwed: decimal("provincial_tax_owed", { precision: 15, scale: 2 }),
  gstHstCollected: decimal("gst_hst_collected", { precision: 15, scale: 2 }).default("0"),
  gstHstRemitted: decimal("gst_hst_remitted", { precision: 15, scale: 2 }).default("0"),
  cppContributions: decimal("cpp_contributions", { precision: 15, scale: 2 }).default("0"),
  eiContributions: decimal("ei_contributions", { precision: 15, scale: 2 }).default("0"),
  t2Filed: boolean("t2_filed").default(false),
  t4sFiled: boolean("t4s_filed").default(false),
  t4asFiled: boolean("t4as_filed").default(false),
  gstHstReturn: varchar("gst_hst_return"),
  filingDeadline: date("filing_deadline"),
  filedDate: date("filed_date"),
  confirmationNumber: varchar("confirmation_number"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearIdx: index("idx_canadian_tax_year").on(table.taxYear),
  entityIdx: index("idx_canadian_tax_entity").on(table.entityId),
}));

// UK Tax Compliance
export const ukTax = pgTable("uk_tax", {
  id: serial("id").primaryKey(),
  taxYear: varchar("tax_year").notNull(),
  entityId: integer("entity_id").notNull(),
  companyRegistrationNumber: varchar("company_registration_number"),
  utr: varchar("utr"),
  vatNumber: varchar("vat_number"),
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }).notNull(),
  corporationTaxableProfit: decimal("corporation_taxable_profit", { precision: 15, scale: 2 }),
  corporationTaxRate: decimal("corporation_tax_rate", { precision: 5, scale: 2 }),
  corporationTaxOwed: decimal("corporation_tax_owed", { precision: 15, scale: 2 }),
  vatCollected: decimal("vat_collected", { precision: 15, scale: 2 }).default("0"),
  vatPaid: decimal("vat_paid", { precision: 15, scale: 2 }).default("0"),
  vatNetOwed: decimal("vat_net_owed", { precision: 15, scale: 2 }),
  payeWithheld: decimal("paye_withheld", { precision: 15, scale: 2 }).default("0"),
  nicEmployer: decimal("nic_employer", { precision: 15, scale: 2 }).default("0"),
  nicEmployee: decimal("nic_employee", { precision: 15, scale: 2 }).default("0"),
  ct600Filed: boolean("ct600_filed").default(false),
  p60sIssued: boolean("p60s_issued").default(false),
  mtdCompliant: boolean("mtd_compliant").default(false),
  vatReturnFrequency: varchar("vat_return_frequency"),
  filingDeadline: date("filing_deadline"),
  filedDate: date("filed_date"),
  hmrcReference: varchar("hmrc_reference"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearIdx: index("idx_uk_tax_year").on(table.taxYear),
  entityIdx: index("idx_uk_tax_entity").on(table.entityId),
}));

// Australian Tax Compliance
export const australianTax = pgTable("australian_tax", {
  id: serial("id").primaryKey(),
  financialYear: varchar("financial_year").notNull(),
  entityId: integer("entity_id").notNull(),
  abn: varchar("abn"),
  acn: varchar("acn"),
  tfn: varchar("tfn"),
  grossRevenue: decimal("gross_revenue", { precision: 15, scale: 2 }).notNull(),
  taxableIncome: decimal("taxable_income", { precision: 15, scale: 2 }),
  corporateTaxRate: decimal("corporate_tax_rate", { precision: 5, scale: 2 }),
  corporateTaxOwed: decimal("corporate_tax_owed", { precision: 15, scale: 2 }),
  gstCollected: decimal("gst_collected", { precision: 15, scale: 2 }).default("0"),
  gstPaid: decimal("gst_paid", { precision: 15, scale: 2 }).default("0"),
  gstNetOwed: decimal("gst_net_owed", { precision: 15, scale: 2 }),
  paygWithholding: decimal("payg_withholding", { precision: 15, scale: 2 }).default("0"),
  superannuationContributions: decimal("superannuation_contributions", { precision: 15, scale: 2 }).default("0"),
  basStatements: integer("bas_statements").default(0),
  companyTaxReturnFiled: boolean("company_tax_return_filed").default(false),
  paymentSummariesIssued: boolean("payment_summaries_issued").default(false),
  gstReturnFrequency: varchar("gst_return_frequency"),
  filingDeadline: date("filing_deadline"),
  filedDate: date("filed_date"),
  atoReference: varchar("ato_reference"),
  filingStatus: varchar("filing_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  yearIdx: index("idx_australian_tax_year").on(table.financialYear),
  entityIdx: index("idx_australian_tax_entity").on(table.entityId),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS (MULTI-JURISDICTION TAX) ===================

export const insertUsFederalTaxSchema = createInsertSchema(usFederalTax).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsFederalTax = z.infer<typeof insertUsFederalTaxSchema>;
export type UsFederalTax = typeof usFederalTax.$inferSelect;

export const insertUsStateTaxSchema = createInsertSchema(usStateTax).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsStateTax = z.infer<typeof insertUsStateTaxSchema>;
export type UsStateTax = typeof usStateTax.$inferSelect;

export const insertUsPayrollTaxSchema = createInsertSchema(usPayrollTax).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsPayrollTax = z.infer<typeof insertUsPayrollTaxSchema>;
export type UsPayrollTax = typeof usPayrollTax.$inferSelect;

export const insertCanadianTaxSchema = createInsertSchema(canadianTax).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCanadianTax = z.infer<typeof insertCanadianTaxSchema>;
export type CanadianTax = typeof canadianTax.$inferSelect;

export const insertUkTaxSchema = createInsertSchema(ukTax).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUkTax = z.infer<typeof insertUkTaxSchema>;
export type UkTax = typeof ukTax.$inferSelect;

export const insertAustralianTaxSchema = createInsertSchema(australianTax).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAustralianTax = z.infer<typeof insertAustralianTaxSchema>;
export type AustralianTax = typeof australianTax.$inferSelect;

export const insertUsStateNexusSchema = createInsertSchema(usStateNexus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsStateNexus = z.infer<typeof insertUsStateNexusSchema>;
export type UsStateNexus = typeof usStateNexus.$inferSelect;

export const insertUsFederalTaxFilingSchema = createInsertSchema(usFederalTaxFilings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsFederalTaxFiling = z.infer<typeof insertUsFederalTaxFilingSchema>;
export type UsFederalTaxFiling = typeof usFederalTaxFilings.$inferSelect;

export const insertUsStateTaxFilingSchema = createInsertSchema(usStateTaxFilings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUsStateTaxFiling = z.infer<typeof insertUsStateTaxFilingSchema>;
export type UsStateTaxFiling = typeof usStateTaxFilings.$inferSelect;

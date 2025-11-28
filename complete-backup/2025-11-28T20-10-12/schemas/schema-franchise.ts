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

// =================== FRANCHISE MANAGEMENT ===================

export const franchisees = pgTable("franchisees", {
  id: serial("id").primaryKey(),
  franchiseeId: varchar("franchisee_id").unique().notNull(), // FR-IL-001
  companyName: varchar("company_name").notNull(),
  legalName: varchar("legal_name"),
  registrationNumber: varchar("registration_number"),
  taxId: varchar("tax_id"),
  country: varchar("country").default("IL"),
  primaryContact: varchar("primary_contact").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  address: text("address"),
  contractStartDate: date("contract_start_date").notNull(),
  contractEndDate: date("contract_end_date"),
  franchiseFee: decimal("franchise_fee", { precision: 12, scale: 2 }), // initial fee
  royaltyPercent: decimal("royalty_percent", { precision: 5, scale: 2 }), // ongoing % of revenue
  numberOfStations: integer("number_of_stations").default(0),
  monthlyRevenue: decimal("monthly_revenue", { precision: 12, scale: 2 }).default("0"),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  status: varchar("status").default("active"), // active, inactive, suspended, terminated
  performanceRating: decimal("performance_rating", { precision: 3, scale: 2 }).default("0"), // 0-10
  contractDocumentUrl: text("contract_document_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  franchiseeIdIdx: uniqueIndex("idx_franchisee_id").on(table.franchiseeId),
  countryIdx: index("idx_franchisee_country").on(table.country),
  statusIdx: index("idx_franchisee_status").on(table.status),
}));

export const franchiseRoyaltyPayments = pgTable("franchise_royalty_payments", {
  id: serial("id").primaryKey(),
  franchiseeId: integer("franchisee_id").references(() => franchisees.id, { onDelete: 'cascade' }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  grossRevenue: decimal("gross_revenue", { precision: 12, scale: 2 }).notNull(),
  royaltyPercent: decimal("royalty_percent", { precision: 5, scale: 2 }).notNull(),
  royaltyAmount: decimal("royalty_amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency").default("ILS"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, overdue
  dueDate: date("due_date").notNull(),
  paidDate: date("paid_date"),
  paymentMethod: varchar("payment_method"),
  paymentReference: varchar("payment_reference"),
  invoiceUrl: text("invoice_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  franchiseeIdx: index("idx_royalty_franchisee").on(table.franchiseeId),
  periodIdx: index("idx_royalty_period").on(table.periodStart, table.periodEnd),
  statusIdx: index("idx_royalty_status").on(table.paymentStatus),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertFranchiseeSchema = createInsertSchema(franchisees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFranchisee = z.infer<typeof insertFranchiseeSchema>;
export type Franchisee = typeof franchisees.$inferSelect;

export const insertFranchiseRoyaltyPaymentSchema = createInsertSchema(franchiseRoyaltyPayments).omit({
  id: true,
  createdAt: true,
});
export type InsertFranchiseRoyaltyPayment = z.infer<typeof insertFranchiseRoyaltyPaymentSchema>;
export type FranchiseRoyaltyPayment = typeof franchiseRoyaltyPayments.$inferSelect;

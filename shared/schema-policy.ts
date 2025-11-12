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

// =================== POLICY MANAGEMENT & COMPLIANCE ===================

export const policyDocuments = pgTable("policy_documents", {
  id: serial("id").primaryKey(),
  policyId: varchar("policy_id").unique().notNull(), // POL-HR-001, POL-SEC-002
  title: varchar("title").notNull(),
  titleHe: varchar("title_he"),
  category: varchar("category").notNull(), // HR, Security, Operations, Legal, IT
  description: text("description"),
  documentUrl: text("document_url").notNull(),
  version: varchar("version").notNull(),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  requiresAcknowledgment: boolean("requires_acknowledgment").default(true),
  targetAudience: varchar("target_audience").notNull(), // all_employees, managers, specific_department
  department: varchar("department"), // filter by department
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  policyIdIdx: uniqueIndex("idx_policy_id").on(table.policyId),
  categoryIdx: index("idx_policy_category").on(table.category),
  activeIdx: index("idx_policy_active").on(table.isActive),
}));

// JOIN TABLE: Policy Acknowledgments (replaces JSONB array)
export const policyAcknowledgments = pgTable("policy_acknowledgments", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policyDocuments.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer("employee_id").notNull(), // FK to hrEmployees - cross-module reference
  version: varchar("version").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  digitalSignature: text("digital_signature"),
}, (table) => ({
  policyEmployeeIdx: index("idx_ack_policy_employee").on(table.policyId, table.employeeId),
  uniqueAck: uniqueIndex("idx_unique_policy_ack").on(table.policyId, table.employeeId, table.version),
}));

export const complianceCertifications = pgTable("compliance_certifications", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(), // FK to hrEmployees - cross-module reference
  certificationType: varchar("certification_type").notNull(), // food_safety, first_aid, data_protection
  certificateNumber: varchar("certificate_number"),
  issuedBy: varchar("issued_by").notNull(),
  issuedDate: date("issued_date").notNull(),
  expiryDate: date("expiry_date").notNull(),
  certificateUrl: text("certificate_url"),
  status: varchar("status").default("active"), // active, expired, revoked
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_cert_employee").on(table.employeeId),
  expiryIdx: index("idx_cert_expiry").on(table.expiryDate),
  statusIdx: index("idx_cert_status").on(table.status),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertPolicyDocumentSchema = createInsertSchema(policyDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPolicyDocument = z.infer<typeof insertPolicyDocumentSchema>;
export type PolicyDocument = typeof policyDocuments.$inferSelect;

export const insertPolicyAcknowledgmentSchema = createInsertSchema(policyAcknowledgments).omit({
  id: true,
  acknowledgedAt: true,
});
export type InsertPolicyAcknowledgment = z.infer<typeof insertPolicyAcknowledgmentSchema>;
export type PolicyAcknowledgment = typeof policyAcknowledgments.$inferSelect;

export const insertComplianceCertificationSchema = createInsertSchema(complianceCertifications).omit({
  id: true,
  createdAt: true,
});
export type InsertComplianceCertification = z.infer<typeof insertComplianceCertificationSchema>;
export type ComplianceCertification = typeof complianceCertifications.$inferSelect;

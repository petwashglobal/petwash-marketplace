import { pgTable, serial, varchar, text, timestamp, boolean, integer, jsonb, index, uniqueIndex, decimal, date } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// =================== PAYROLL INTEGRATIONS ===================

export const payrollProviders = pgTable("payroll_providers", {
  id: serial("id").primaryKey(),
  providerName: varchar("provider_name").notNull(),
  providerType: varchar("provider_type").notNull(),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  apiBaseUrl: varchar("api_base_url"),
  webhookUrl: varchar("webhook_url"),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  syncErrors: jsonb("sync_errors"),
  configuration: jsonb("configuration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerNameIdx: uniqueIndex("idx_payroll_provider_name").on(table.providerName),
  providerTypeIdx: index("idx_payroll_provider_type").on(table.providerType),
}));

export const payrollEmployeeMappings = pgTable("payroll_employee_mappings", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => payrollProviders.id, { onDelete: 'cascade' }).notNull(),
  internalEmployeeId: integer("internal_employee_id").notNull(),
  externalEmployeeId: varchar("external_employee_id").notNull(),
  externalEmployeeUuid: varchar("external_employee_uuid"),
  employeeName: varchar("employee_name").notNull(),
  employeeEmail: varchar("employee_email"),
  syncStatus: varchar("sync_status").default("active"),
  lastSyncedAt: timestamp("last_synced_at"),
  syncErrors: jsonb("sync_errors"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerEmployeeIdx: uniqueIndex("idx_payroll_provider_employee").on(table.providerId, table.externalEmployeeId),
  internalEmployeeIdx: index("idx_payroll_internal_employee").on(table.internalEmployeeId),
  providerIdIdx: index("idx_payroll_mapping_provider").on(table.providerId),
}));

export const payrollSyncLogs = pgTable("payroll_sync_logs", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => payrollProviders.id, { onDelete: 'cascade' }).notNull(),
  syncType: varchar("sync_type").notNull(),
  syncDirection: varchar("sync_direction").notNull(),
  recordsProcessed: integer("records_processed").default(0),
  recordsSucceeded: integer("records_succeeded").default(0),
  recordsFailed: integer("records_failed").default(0),
  syncStatus: varchar("sync_status").notNull(),
  errorDetails: jsonb("error_details"),
  syncData: jsonb("sync_data"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  providerIdIdx: index("idx_payroll_sync_provider").on(table.providerId),
  syncTypeIdx: index("idx_payroll_sync_type").on(table.syncType),
  statusIdx: index("idx_payroll_sync_status").on(table.syncStatus),
  startedAtIdx: index("idx_payroll_sync_started").on(table.startedAt),
}));

export const adpIntegration = pgTable("adp_integration", {
  id: serial("id").primaryKey(),
  companyCode: varchar("company_code").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  certificatePath: varchar("certificate_path"),
  environment: varchar("environment").default("production"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  syncConfiguration: jsonb("sync_configuration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  companyCodeIdx: uniqueIndex("idx_adp_company_code").on(table.companyCode),
}));

export const gustoIntegration = pgTable("gusto_integration", {
  id: serial("id").primaryKey(),
  companyId: varchar("company_id").unique().notNull(),
  apiToken: text("api_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  environment: varchar("environment").default("production"),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  syncConfiguration: jsonb("sync_configuration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  companyIdIdx: uniqueIndex("idx_gusto_company_id").on(table.companyId),
}));

export const deelIntegration = pgTable("deel_integration", {
  id: serial("id").primaryKey(),
  organizationId: varchar("organization_id").unique().notNull(),
  apiKey: text("api_key").notNull(),
  webhookSecret: text("webhook_secret"),
  environment: varchar("environment").default("production"),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  syncConfiguration: jsonb("sync_configuration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  organizationIdIdx: uniqueIndex("idx_deel_organization_id").on(table.organizationId),
}));

export const payrollPayPeriods = pgTable("payroll_pay_periods", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => payrollProviders.id, { onDelete: 'cascade' }).notNull(),
  externalPayPeriodId: varchar("external_pay_period_id"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  payDate: date("pay_date").notNull(),
  frequency: varchar("frequency").notNull(),
  status: varchar("status").default("pending"),
  totalGrossPay: decimal("total_gross_pay", { precision: 12, scale: 2 }),
  totalNetPay: decimal("total_net_pay", { precision: 12, scale: 2 }),
  totalTaxes: decimal("total_taxes", { precision: 12, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 12, scale: 2 }),
  employeeCount: integer("employee_count"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  providerIdIdx: index("idx_payroll_period_provider").on(table.providerId),
  periodStartIdx: index("idx_payroll_period_start").on(table.periodStart),
  payDateIdx: index("idx_payroll_period_pay_date").on(table.payDate),
  statusIdx: index("idx_payroll_period_status").on(table.status),
}));

export const payrollPaychecks = pgTable("payroll_paychecks", {
  id: serial("id").primaryKey(),
  payPeriodId: integer("pay_period_id").references(() => payrollPayPeriods.id, { onDelete: 'cascade' }).notNull(),
  employeeMappingId: integer("employee_mapping_id").references(() => payrollEmployeeMappings.id, { onDelete: 'cascade' }).notNull(),
  externalPaycheckId: varchar("external_paycheck_id"),
  employeeName: varchar("employee_name").notNull(),
  grossPay: decimal("gross_pay", { precision: 10, scale: 2 }).notNull(),
  netPay: decimal("net_pay", { precision: 10, scale: 2 }).notNull(),
  federalTax: decimal("federal_tax", { precision: 10, scale: 2 }),
  stateTax: decimal("state_tax", { precision: 10, scale: 2 }),
  localTax: decimal("local_tax", { precision: 10, scale: 2 }),
  socialSecurity: decimal("social_security", { precision: 10, scale: 2 }),
  medicare: decimal("medicare", { precision: 10, scale: 2 }),
  otherDeductions: decimal("other_deductions", { precision: 10, scale: 2 }),
  earnings: jsonb("earnings"),
  deductions: jsonb("deductions"),
  taxes: jsonb("taxes"),
  directDeposits: jsonb("direct_deposits"),
  status: varchar("status").default("pending"),
  payDate: date("pay_date"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  payPeriodIdx: index("idx_payroll_paycheck_period").on(table.payPeriodId),
  employeeIdx: index("idx_payroll_paycheck_employee").on(table.employeeMappingId),
  payDateIdx: index("idx_payroll_paycheck_pay_date").on(table.payDate),
  statusIdx: index("idx_payroll_paycheck_status").on(table.status),
}));

export const payrollTimesheets = pgTable("payroll_timesheets", {
  id: serial("id").primaryKey(),
  employeeMappingId: integer("employee_mapping_id").references(() => payrollEmployeeMappings.id, { onDelete: 'cascade' }).notNull(),
  externalTimesheetId: varchar("external_timesheet_id"),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  regularHours: decimal("regular_hours", { precision: 6, scale: 2 }),
  overtimeHours: decimal("overtime_hours", { precision: 6, scale: 2 }),
  doubleTimeHours: decimal("double_time_hours", { precision: 6, scale: 2 }),
  ptoHours: decimal("pto_hours", { precision: 6, scale: 2 }),
  sickHours: decimal("sick_hours", { precision: 6, scale: 2 }),
  holidayHours: decimal("holiday_hours", { precision: 6, scale: 2 }),
  totalHours: decimal("total_hours", { precision: 6, scale: 2 }),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  totalPay: decimal("total_pay", { precision: 10, scale: 2 }),
  status: varchar("status").default("draft"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  timeEntries: jsonb("time_entries"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  employeeIdx: index("idx_payroll_timesheet_employee").on(table.employeeMappingId),
  periodStartIdx: index("idx_payroll_timesheet_period").on(table.periodStart),
  statusIdx: index("idx_payroll_timesheet_status").on(table.status),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertPayrollProviderSchema = createInsertSchema(payrollProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayrollProvider = z.infer<typeof insertPayrollProviderSchema>;
export type PayrollProvider = typeof payrollProviders.$inferSelect;

export const insertPayrollEmployeeMappingSchema = createInsertSchema(payrollEmployeeMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayrollEmployeeMapping = z.infer<typeof insertPayrollEmployeeMappingSchema>;
export type PayrollEmployeeMapping = typeof payrollEmployeeMappings.$inferSelect;

export const insertPayrollSyncLogSchema = createInsertSchema(payrollSyncLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertPayrollSyncLog = z.infer<typeof insertPayrollSyncLogSchema>;
export type PayrollSyncLog = typeof payrollSyncLogs.$inferSelect;

export const insertAdpIntegrationSchema = createInsertSchema(adpIntegration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdpIntegration = z.infer<typeof insertAdpIntegrationSchema>;
export type AdpIntegration = typeof adpIntegration.$inferSelect;

export const insertGustoIntegrationSchema = createInsertSchema(gustoIntegration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGustoIntegration = z.infer<typeof insertGustoIntegrationSchema>;
export type GustoIntegration = typeof gustoIntegration.$inferSelect;

export const insertDeelIntegrationSchema = createInsertSchema(deelIntegration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDeelIntegration = z.infer<typeof insertDeelIntegrationSchema>;
export type DeelIntegration = typeof deelIntegration.$inferSelect;

export const insertPayrollPayPeriodSchema = createInsertSchema(payrollPayPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayrollPayPeriod = z.infer<typeof insertPayrollPayPeriodSchema>;
export type PayrollPayPeriod = typeof payrollPayPeriods.$inferSelect;

export const insertPayrollPaycheckSchema = createInsertSchema(payrollPaychecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayrollPaycheck = z.infer<typeof insertPayrollPaycheckSchema>;
export type PayrollPaycheck = typeof payrollPaychecks.$inferSelect;

export const insertPayrollTimesheetSchema = createInsertSchema(payrollTimesheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayrollTimesheet = z.infer<typeof insertPayrollTimesheetSchema>;
export type PayrollTimesheet = typeof payrollTimesheets.$inferSelect;

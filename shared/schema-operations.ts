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
  date,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";
import { stationRegistry } from "./schema-corporate";
import { franchisees } from "./schema-franchise";
import { hrEmployees } from "./schema-hr";

// =================== OPERATIONS DEPARTMENT ===================

export const opsTasksTable = pgTable("ops_tasks", {
  id: serial("id").primaryKey(),
  taskId: varchar("task_id").unique().notNull(), // OPS-2025-0001
  title: varchar("title").notNull(),
  description: text("description"),
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  category: varchar("category").notNull(), // maintenance, customer_support, logistics, admin
  
  // Foreign Keys for Enterprise Structure
  assignedTo: integer("assigned_to"), // FK to employees.id
  stationId: varchar("station_id"), // FK to stationRegistry.stationId
  franchiseId: integer("franchise_id"), // FK to franchisees.id
  createdBy: integer("created_by"), // FK to employees.id
  
  // Multi-Region Support
  region: varchar("region"), // EMEA, APAC, AMER, etc.
  country: varchar("country"), // ISO 3166-1 alpha-2 code (IL, US, CA, etc.)
  timeZone: varchar("time_zone"), // IANA timezone (Asia/Jerusalem, etc.)
  
  // Escalation Management
  escalationLevel: integer("escalation_level").default(0), // 0=None, 1-5=Escalation tiers
  escalatedTo: integer("escalated_to"), // FK to employees.id
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),
  escalationHistory: jsonb("escalation_history"), // Array of {level, to, at, reason}
  
  // Task Management
  dueDate: timestamp("due_date"),
  status: varchar("status").default("pending"), // pending, in_progress, completed, cancelled, blocked, escalated
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  attachments: jsonb("attachments"), // array of file URLs
  
  // Audit Trail
  modifiedBy: integer("modified_by"), // FK to employees.id (last modifier)
  actionLog: jsonb("action_log"), // Array of {action, by, at, details}
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Basic Indexes
  taskIdIdx: uniqueIndex("idx_ops_tasks_id").on(table.taskId),
  assignedIdx: index("idx_ops_tasks_assigned").on(table.assignedTo),
  statusIdx: index("idx_ops_tasks_status").on(table.status),
  priorityIdx: index("idx_ops_tasks_priority").on(table.priority),
  dueIdx: index("idx_ops_tasks_due").on(table.dueDate),
  
  // Multi-Region Indexes
  regionIdx: index("idx_ops_tasks_region").on(table.region),
  countryIdx: index("idx_ops_tasks_country").on(table.country),
  franchiseIdx: index("idx_ops_tasks_franchise").on(table.franchiseId),
  
  // Escalation Indexes
  escalationIdx: index("idx_ops_tasks_escalation").on(table.escalationLevel),
  escalatedToIdx: index("idx_ops_tasks_escalated_to").on(table.escalatedTo),
  
  // Composite Indexes for Global Operations
  franchiseStatusIdx: index("idx_ops_tasks_franchise_status").on(table.franchiseId, table.status),
  regionPriorityIdx: index("idx_ops_tasks_region_priority").on(table.region, table.priority),
  
  // Foreign Key Constraints
  assignedToFk: foreignKey({
    columns: [table.assignedTo],
    foreignColumns: [hrEmployees.id],
    name: "fk_ops_tasks_assigned_to"
  }),
  stationFk: foreignKey({
    columns: [table.stationId],
    foreignColumns: [stationRegistry.stationId],
    name: "fk_ops_tasks_station"
  }),
  franchiseFk: foreignKey({
    columns: [table.franchiseId],
    foreignColumns: [franchisees.id],
    name: "fk_ops_tasks_franchise"
  }),
  createdByFk: foreignKey({
    columns: [table.createdBy],
    foreignColumns: [hrEmployees.id],
    name: "fk_ops_tasks_created_by"
  }),
  escalatedToFk: foreignKey({
    columns: [table.escalatedTo],
    foreignColumns: [hrEmployees.id],
    name: "fk_ops_tasks_escalated_to"
  }),
  modifiedByFk: foreignKey({
    columns: [table.modifiedBy],
    foreignColumns: [hrEmployees.id],
    name: "fk_ops_tasks_modified_by"
  }),
}));

export const opsIncidents = pgTable("ops_incidents", {
  id: serial("id").primaryKey(),
  incidentId: varchar("incident_id").unique().notNull(), // INC-2025-0001
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  severity: varchar("severity").notNull(), // low, medium, high, critical
  category: varchar("category").notNull(), // equipment_failure, customer_complaint, safety, security
  
  // Foreign Keys for Enterprise Structure
  stationId: varchar("station_id"), // FK to stationRegistry.stationId
  franchiseId: integer("franchise_id"), // FK to franchisees.id
  reportedBy: integer("reported_by"), // FK to hrEmployees.id
  assignedTo: integer("assigned_to"), // FK to hrEmployees.id
  
  // Multi-Region Support
  region: varchar("region"), // EMEA, APAC, AMER, etc.
  country: varchar("country"), // ISO 3166-1 alpha-2 code (IL, US, CA, etc.)
  timeZone: varchar("time_zone"), // IANA timezone
  
  // Escalation Management
  escalationLevel: integer("escalation_level").default(0), // 0=None, 1-5=Escalation tiers
  escalatedTo: integer("escalated_to"), // FK to hrEmployees.id
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),
  escalationHistory: jsonb("escalation_history"), // Array of {level, to, at, reason}
  
  // Incident Management
  status: varchar("status").default("open"), // open, investigating, resolved, closed, escalated
  priority: varchar("priority").default("medium"),
  impactLevel: varchar("impact_level"), // minor, moderate, major, severe
  rootCause: text("root_cause"),
  resolution: text("resolution"),
  preventiveMeasures: text("preventive_measures"),
  
  // SLA & Compliance
  slaDeadline: timestamp("sla_deadline"),
  slaBreach: boolean("sla_breach").default(false),
  slaBreachReason: text("sla_breach_reason"),
  complianceFlags: jsonb("compliance_flags"), // {gdpr_reported, regulatory_notification, etc.}
  
  // Audit Trail
  modifiedBy: integer("modified_by"), // FK to hrEmployees.id (last modifier)
  actionLog: jsonb("action_log"), // Array of {action, by, at, details}
  
  // Timestamps
  reportedAt: timestamp("reported_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Attachments
  attachments: jsonb("attachments"),
}, (table) => ({
  // Basic Indexes
  incidentIdIdx: uniqueIndex("idx_incidents_id").on(table.incidentId),
  severityIdx: index("idx_incidents_severity").on(table.severity),
  statusIdx: index("idx_incidents_status").on(table.status),
  stationIdx: index("idx_incidents_station").on(table.stationId),
  slaIdx: index("idx_incidents_sla").on(table.slaDeadline),
  
  // Multi-Region Indexes
  regionIdx: index("idx_incidents_region").on(table.region),
  countryIdx: index("idx_incidents_country").on(table.country),
  franchiseIdx: index("idx_incidents_franchise").on(table.franchiseId),
  
  // Escalation Indexes
  escalationIdx: index("idx_incidents_escalation").on(table.escalationLevel),
  escalatedToIdx: index("idx_incidents_escalated_to").on(table.escalatedTo),
  
  // Composite Indexes for Global Operations
  franchiseSeverityIdx: index("idx_incidents_franchise_severity").on(table.franchiseId, table.severity),
  regionStatusIdx: index("idx_incidents_region_status").on(table.region, table.status),
  slaBatchIdx: index("idx_incidents_sla_breach").on(table.slaBreach, table.slaDeadline),
  
  // Foreign Key Constraints
  stationFk: foreignKey({
    columns: [table.stationId],
    foreignColumns: [stationRegistry.stationId],
    name: "fk_incidents_station"
  }),
  franchiseFk: foreignKey({
    columns: [table.franchiseId],
    foreignColumns: [franchisees.id],
    name: "fk_incidents_franchise"
  }),
  reportedByFk: foreignKey({
    columns: [table.reportedBy],
    foreignColumns: [hrEmployees.id],
    name: "fk_incidents_reported_by"
  }),
  assignedToFk: foreignKey({
    columns: [table.assignedTo],
    foreignColumns: [hrEmployees.id],
    name: "fk_incidents_assigned_to"
  }),
  escalatedToFk: foreignKey({
    columns: [table.escalatedTo],
    foreignColumns: [hrEmployees.id],
    name: "fk_incidents_escalated_to"
  }),
  modifiedByFk: foreignKey({
    columns: [table.modifiedBy],
    foreignColumns: [hrEmployees.id],
    name: "fk_incidents_modified_by"
  }),
}));

export const opsSlaTracking = pgTable("ops_sla_tracking", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type").notNull(), // task, incident, support_ticket
  entityId: integer("entity_id").notNull(),
  slaType: varchar("sla_type").notNull(), // response_time, resolution_time, acknowledgment_time
  targetMinutes: integer("target_minutes").notNull(),
  startTime: timestamp("start_time").notNull(),
  deadlineTime: timestamp("deadline_time").notNull(),
  completedTime: timestamp("completed_time"),
  actualMinutes: integer("actual_minutes"),
  isBreach: boolean("is_breach").default(false),
  breachMinutes: integer("breach_minutes"),
  status: varchar("status").default("pending"), // pending, met, breached
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  entityIdx: index("idx_sla_entity").on(table.entityType, table.entityId),
  statusIdx: index("idx_sla_status").on(table.status),
  deadlineIdx: index("idx_sla_deadline").on(table.deadlineTime),
}));

// =================== INSERT SCHEMAS & TYPE EXPORTS ===================

export const insertOpsTaskSchema = createInsertSchema(opsTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  completedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  escalatedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertOpsTask = z.infer<typeof insertOpsTaskSchema>;
export type OpsTask = typeof opsTasksTable.$inferSelect;

export const insertOpsIncidentSchema = createInsertSchema(opsIncidents).omit({
  id: true,
  reportedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  acknowledgedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  resolvedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  closedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  slaDeadline: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  escalatedAt: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertOpsIncident = z.infer<typeof insertOpsIncidentSchema>;
export type OpsIncident = typeof opsIncidents.$inferSelect;

export const insertOpsSlaTrackingSchema = createInsertSchema(opsSlaTracking).omit({
  id: true,
  createdAt: true,
}).extend({
  startTime: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  deadlineTime: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  completedTime: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
});
export type InsertOpsSlaTracking = z.infer<typeof insertOpsSlaTrackingSchema>;
export type OpsSlaTracking = typeof opsSlaTracking.$inferSelect;

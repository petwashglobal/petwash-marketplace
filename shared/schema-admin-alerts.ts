/**
 * PetWash™ Unified Admin Alerts ("מרכז התראות") — Control Tower §7/§17.
 *
 * THE PROBLEM this solves: alert-like signals were scattered across ~6
 * DISCONNECTED tables (station_alerts, ops_incidents, ops_tasks,
 * compliance_tasks, bay_faults, walk_alerts) plus a generic sendAlert() that
 * only fans out to email/Slack/Firestore. There was no single admin queue of
 * "what needs attention right now".
 *
 * This table is that single queue. It is ADDITIVE — it does NOT replace the
 * domain tables; the AlertEngine auto-creates a row here when a bad condition
 * is detected (paid-not-activated, station/bay offline+fault, SUMIT doc failed,
 * eGift email failed, coupon abuse, stock low, reconfirmation/insurance expiry)
 * and auto-resolves it when the condition clears.
 *
 * IDEMPOTENCY: `dedupeKey` identifies the underlying condition (e.g.
 * "bay_fault:<bayId>"). The AlertEngine keeps at most ONE non-terminal alert
 * per dedupeKey, so a recurring sweep never spams duplicates. A partial unique
 * index (migration 0062) enforces this at the DB level for active states.
 */

import {
  pgTable,
  serial,
  varchar,
  timestamp,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Lifecycle: open → acknowledged → resolved; open → snoozed → (auto re-open at snoozedUntil); open → dismissed. */
export const ALERT_STATUSES = ["open", "acknowledged", "snoozed", "resolved", "dismissed"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Terminal states — an alert in these is "done" and the dedupeKey is free to re-fire. */
export const ALERT_TERMINAL_STATUSES = ["resolved", "dismissed"] as const;

/** Spec §7 severities. (Audit log uses info|warning|error|critical; alerts collapse to these three.) */
export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** Source categories — drive the filter chips + Hebrew labels in the UI. */
export const ALERT_CATEGORIES = [
  "payment",       // paid-but-not-activated
  "station",       // station offline
  "bay",           // bay offline / fault
  "finance_doc",   // SUMIT invoice/receipt failed
  "egift",         // eGift / email send failed
  "coupon_abuse",  // discount abuse
  "stock",         // stock low
  "expiry",        // insurance / document / reconfirmation expiry
  "provider",      // provider needs attention
  "support",       // SLA overdue
  "system",        // generic / sendAlert bridge
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const adminAlerts = pgTable("admin_alerts", {
  id: serial("id").primaryKey(),

  /** Stable identity of the underlying condition — idempotency key (e.g. "paid_not_activated:PW-PAY-..."). */
  dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),

  category: varchar("category", { length: 32 }).notNull(),   // ALERT_CATEGORIES
  severity: varchar("severity", { length: 16 }).notNull(),   // ALERT_SEVERITIES
  status: varchar("status", { length: 16 }).notNull().default("open"),

  title: text("title").notNull(),       // Hebrew, short
  message: text("message").notNull(),    // Hebrew, one or two lines

  // Linked entity — lets the UI deep-link to the offending record.
  linkedEntityType: varchar("linked_entity_type", { length: 40 }), // payment | bay | station | provider | coupon | job | item
  linkedEntityId: varchar("linked_entity_id", { length: 120 }),

  // Assignment + lifecycle actors.
  assignedTo: varchar("assigned_to", { length: 128 }),  // admin uid
  assignedAt: timestamp("assigned_at"),
  dueAt: timestamp("due_at"),
  snoozedUntil: timestamp("snoozed_until"),

  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by", { length: 128 }),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by", { length: 128 }),
  resolutionNote: text("resolution_note"),

  /** auto_sweep | auto_resolved | manual | send_alert_bridge */
  source: varchar("source", { length: 24 }).notNull().default("auto_sweep"),
  metadata: jsonb("metadata").notNull().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  dedupeIdx:   index("idx_admin_alerts_dedupe").on(t.dedupeKey),
  statusIdx:   index("idx_admin_alerts_status").on(t.status, t.createdAt),
  severityIdx: index("idx_admin_alerts_severity").on(t.severity),
  categoryIdx: index("idx_admin_alerts_category").on(t.category),
  assignedIdx: index("idx_admin_alerts_assigned").on(t.assignedTo),
}));

export const insertAdminAlertSchema = createInsertSchema(adminAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminAlert = z.infer<typeof insertAdminAlertSchema>;
export type AdminAlert = typeof adminAlerts.$inferSelect;

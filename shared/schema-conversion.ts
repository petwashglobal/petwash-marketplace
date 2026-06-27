/**
 * Conversion / Booking-Rescue schema (CEO master spec 2026-06-27).
 *
 * "No dead clicks, no lost leads." Captures every started-but-stopped intent
 * (user_intent_events) → a lead (conversion_leads) the rescue engine reminds and
 * recovers, logging each send (conversion_recovery_events). ADDITIVE + money-safe:
 * value_estimate is analytics only; reminders run behind CONVERSION_RESCUE_ENABLED.
 *
 * Migration: migrations/0082_conversion_rescue.sql.
 */
import { pgTable, serial, varchar, integer, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── §3. Intent event types ─────────────────────────────────────────────────────
export const INTENT_EVENT_TYPES = [
  "SERVICE_VIEWED", "PROVIDER_SEARCHED", "PROVIDER_PROFILE_VIEWED", "PROVIDER_MESSAGED",
  "BOOKING_STARTED", "BOOKING_FORM_PARTIAL", "BOOKING_ENQUIRY_SENT", "PROVIDER_NO_REPLY",
  "PROVIDER_ACCEPTED_WAITING_PAYMENT", "PAYMENT_STARTED", "PAYMENT_FAILED", "PAYMENT_ABANDONED",
  "BOOKING_EXPIRED", "BOOKING_CANCELLED_BEFORE_PAYMENT",
  "SHOP_PRODUCT_VIEWED", "SHOP_CART_ABANDONED",
  "GIFT_STARTED", "GIFT_ABANDONED",
  "PAW_FINDER_REPORT_STARTED", "PAW_FINDER_REPORT_ABANDONED",
  "PETTREK_WAITLIST_VIEWED", "WAITLIST_STARTED", "WAITLIST_ABANDONED",
  "K9000_REDEMPTION_FAILED", "K9000_PAYMENT_FAILED",
] as const;
export type IntentEventType = (typeof INTENT_EVENT_TYPES)[number];

export const LEAD_TYPES = [
  "PET_SITTER_BOOKING", "WALK_MY_PET_BOOKING", "ACADEMY_COURSE", "SHOP_CART",
  "GIFT_PURCHASE", "PAW_FINDER_REPORT", "PETTREK_WAITLIST", "K9000_WALLET", "K9000_PAYMENT",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUSES = [
  "NEW", "ACTIVE", "REMINDER_SENT", "WAITING_PROVIDER", "WAITING_CUSTOMER",
  "PAYMENT_PENDING", "RESCUED", "CONVERTED", "LOST", "CLOSED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const PLATFORM_KEYS = [
  "SITTER_SUITE", "WALK_MY_PET", "ACADEMY", "SHOP", "GIFT", "PAW_FINDER", "PETTREK", "K9000",
] as const;

// ── §3. user_intent_events ─────────────────────────────────────────────────────
export const userIntentEvents = pgTable("user_intent_events", {
  id: serial("id").primaryKey(),
  eventKey: varchar("event_key").notNull(),
  userId: varchar("user_id"),
  guestId: varchar("guest_id"),
  sessionId: varchar("session_id"),
  platformKey: varchar("platform_key"),
  eventType: varchar("event_type").notNull(),
  relatedProviderId: varchar("related_provider_id"),
  relatedBookingId: varchar("related_booking_id"),
  relatedPetId: varchar("related_pet_id"),
  relatedProductId: varchar("related_product_id"),
  relatedStationId: varchar("related_station_id"),
  city: varchar("city"),
  country: varchar("country"),
  device: varchar("device"),
  sourcePage: varchar("source_page"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxUser: index("idx_intent_user").on(t.userId, t.createdAt),
  idxGuest: index("idx_intent_guest").on(t.guestId, t.createdAt),
  idxType: index("idx_intent_type").on(t.eventType, t.createdAt),
  idxBooking: index("idx_intent_booking").on(t.relatedBookingId),
}));

// ── §8. conversion_leads ───────────────────────────────────────────────────────
export const conversionLeads = pgTable("conversion_leads", {
  id: serial("id").primaryKey(),
  leadKey: varchar("lead_key").notNull(),
  userId: varchar("user_id"),
  guestId: varchar("guest_id"),
  platformKey: varchar("platform_key"),
  leadType: varchar("lead_type").notNull(),
  relatedBookingId: varchar("related_booking_id"),
  relatedProviderId: varchar("related_provider_id"),
  score: integer("score").notNull().default(0),
  status: varchar("status").notNull().default("NEW"),
  valueEstimateCents: integer("value_estimate_cents").notNull().default(0),
  city: varchar("city"),
  lastEventType: varchar("last_event_type"),
  lastActionAt: timestamp("last_action_at"),
  nextActionDueAt: timestamp("next_action_due_at"),
  remindersSent: integer("reminders_sent").notNull().default(0),
  assignedAdmin: varchar("assigned_admin"),
  aiSummary: varchar("ai_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idxStatus: index("idx_lead_status").on(t.status, t.nextActionDueAt),
  idxPlatform: index("idx_lead_platform").on(t.platformKey, t.status),
}));

// ── conversion_recovery_events ─────────────────────────────────────────────────
export const conversionRecoveryEvents = pgTable("conversion_recovery_events", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id"),
  userId: varchar("user_id"),
  guestId: varchar("guest_id"),
  platformKey: varchar("platform_key"),
  stage: varchar("stage").notNull(),
  channel: varchar("channel").notNull(),
  templateKey: varchar("template_key"),
  shadowOnly: boolean("shadow_only").notNull().default(true),
  deliveryStatus: varchar("delivery_status").notNull().default("queued"),
  failureReason: varchar("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxLead: index("idx_recovery_lead").on(t.leadId, t.createdAt),
  idxDedup: index("idx_recovery_dedup").on(t.leadId, t.stage, t.channel),
}));

// ── Insert schemas ─────────────────────────────────────────────────────────────
export const insertUserIntentEventSchema = createInsertSchema(userIntentEvents).omit({ id: true, createdAt: true });
export const createIntentSchema = z.object({
  eventType: z.enum(INTENT_EVENT_TYPES),
  platformKey: z.enum(PLATFORM_KEYS).optional(),
  guestId: z.string().optional(),
  sessionId: z.string().optional(),
  relatedProviderId: z.string().optional(),
  relatedBookingId: z.string().optional(),
  relatedPetId: z.string().optional(),
  relatedProductId: z.string().optional(),
  relatedStationId: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  device: z.string().optional(),
  sourcePage: z.string().optional(),
  valueEstimateCents: z.number().int().nonnegative().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UserIntentEvent = typeof userIntentEvents.$inferSelect;
export type ConversionLead = typeof conversionLeads.$inferSelect;
export type ConversionRecoveryEvent = typeof conversionRecoveryEvents.$inferSelect;

export const conversionSchemas = { userIntentEvents, conversionLeads, conversionRecoveryEvents };

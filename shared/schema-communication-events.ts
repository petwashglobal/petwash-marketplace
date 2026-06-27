/**
 * Unified communication-events log (CEO comms master spec §10).
 *
 * ONE append-only timeline for EVERY booking-linked communication — chat,
 * push, SMS, email, call, system message, support — so nothing "disappears
 * into random WhatsApp or private calls without record" and admin/legal can
 * reconstruct the full history per booking. This table does NOT replace the
 * channel systems (chat_messages, notification_logs, FCM/SMS/email); it is the
 * cross-channel index that ties them together by booking_id. Writes are
 * best-effort and non-blocking (see CommunicationEventService) — logging must
 * never break a send.
 *
 * Migration: migrations/0083_communication_events.sql
 */
import { pgTable, serial, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const COMMUNICATION_CHANNELS = [
  "CHAT", "PUSH", "SMS", "EMAIL", "CALL", "SYSTEM", "SUPPORT",
] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const communicationEvents = pgTable("communication_events", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id"),            // nullable: some comms (e.g. OTP) aren't booking-scoped
  threadId: varchar("thread_id"),              // chat thread / conversation id when applicable
  senderUserId: varchar("sender_user_id"),
  receiverUserId: varchar("receiver_user_id"),
  channel: varchar("channel").notNull(),       // one of COMMUNICATION_CHANNELS
  eventType: varchar("event_type").notNull(),  // e.g. message_sent, push_sent, sms_sent, call_attempted, provider_accepted
  contentSummary: text("content_summary"),     // short, non-sensitive summary (never full PII bodies)
  externalMessageId: varchar("external_message_id"), // provider id (Twilio/SendGrid/FCM/Nayax) for delivery correlation
  status: varchar("status"),                   // sent | delivered | opened | failed | connected | flagged …
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxBooking: index("idx_comm_events_booking").on(t.bookingId, t.createdAt),
  idxChannel: index("idx_comm_events_channel").on(t.channel, t.createdAt),
  idxThread: index("idx_comm_events_thread").on(t.threadId),
}));

export const insertCommunicationEventSchema = createInsertSchema(communicationEvents).omit({ id: true, createdAt: true });
export type CommunicationEvent = typeof communicationEvents.$inferSelect;
export type InsertCommunicationEvent = z.infer<typeof insertCommunicationEventSchema>;

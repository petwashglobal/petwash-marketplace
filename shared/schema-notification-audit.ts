/**
 * Notification audit — proves every send was consent-checked, and stores push
 * tokens securely. PetWash Ltd, 2026-06-21.
 *
 * notification_events — one row per attempted send (marketing or otherwise). It
 *   records WHICH consent was checked and the OUTCOME, so a §30א audit can show
 *   "this marketing message was sent only after consent X was verified" — or that
 *   it was blocked_no_consent. Complements the consent gate in CampaignDeliveryService.
 *
 * push_devices — canonical Postgres store of FCM tokens (the council found tokens
 *   lived only in Firestore with no audit). Token is stored HASHED (lookup) +
 *   encrypted (never plaintext).
 *
 * ADDITIVE — no existing table is altered.
 */
import { pgTable, serial, varchar, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const NOTIFICATION_CHANNELS = ["sms", "email", "push", "in_app", "whatsapp"] as const;
export const NOTIFICATION_CATEGORIES = ["essential", "care", "marketing", "booking", "support"] as const;
export const NOTIFICATION_STATUSES = ["queued", "sent", "delivered", "failed", "blocked_no_consent", "unsubscribed"] as const;

export const notificationEvents = pgTable("notification_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }),
  petId: varchar("pet_id", { length: 128 }),
  channel: varchar("channel", { length: 16 }).notNull(),     // NOTIFICATION_CHANNELS
  category: varchar("category", { length: 16 }).notNull(),    // NOTIFICATION_CATEGORIES
  templateKey: varchar("template_key", { length: 80 }),

  /** Was a consent check performed before this send? (marketing → must be true) */
  consentChecked: boolean("consent_checked").notNull().default(false),
  /** allowed | blocked_no_consent | not_required (transactional) */
  consentResult: varchar("consent_result", { length: 24 }),
  consentRecordId: varchar("consent_record_id", { length: 128 }),

  destinationMasked: varchar("destination_masked", { length: 64 }), // e.g. ****1234
  status: varchar("status", { length: 24 }).notNull(),       // NOTIFICATION_STATUSES
  providerMessageId: varchar("provider_message_id", { length: 128 }),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata").notNull().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
}, (t) => ({
  userIdx:   index("idx_notif_events_user").on(t.userId, t.createdAt),
  statusIdx: index("idx_notif_events_status").on(t.status),
  catIdx:    index("idx_notif_events_category").on(t.category),
}));

export const pushDevices = pgTable("push_devices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 128 }).notNull(),
  deviceType: varchar("device_type", { length: 16 }),        // ios | android | web
  pushTokenHash: varchar("push_token_hash", { length: 128 }).notNull(),
  tokenEncrypted: text("token_encrypted"),
  deviceName: varchar("device_name", { length: 120 }),
  appVersion: varchar("app_version", { length: 40 }),
  locale: varchar("locale", { length: 16 }),
  timezone: varchar("timezone", { length: 48 }),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | revoked | expired
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  userIdx:  index("idx_push_devices_user").on(t.userId),
  hashIdx:  index("idx_push_devices_hash").on(t.pushTokenHash),
}));

export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type PushDevice = typeof pushDevices.$inferSelect;

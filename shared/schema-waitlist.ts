/**
 * PetWash™ Universal Waitlist / demand-capture engine (CEO "no dead pages" spec).
 *
 * One table behind every not-yet-live surface: PetTrek waitlist, shop product
 * wishlist, a service not live in a city, K9000 station requests, provider/
 * partner interest, early access. A "coming soon" page must still CREATE a
 * record here instead of being dead. Keyed by platformKey + interestType.
 *
 * Works for logged-in users (userId) and anonymous visitors (guestId).
 * Backed by migration 0080_waitlist_entries.sql (additive).
 */
import { pgTable, serial, varchar, text, boolean, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Platform/surface the interest is for. */
export const WAITLIST_PLATFORMS = [
  "PETTREK", "PAW_FINDER", "SITTER_SUITE", "WALK_MY_PET", "ACADEMY",
  "SHOP", "K9000_STATION", "PROVIDER", "PARTNER", "CITY", "PRODUCT", "OTHER",
] as const;
export type WaitlistPlatform = (typeof WAITLIST_PLATFORMS)[number];

/** Lifecycle. */
export const WAITLIST_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "WAITING_FOR_LAUNCH", "INVITED",
  "CONVERTED", "CLOSED", "DUPLICATE", "SPAM",
] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const waitlistEntries = pgTable("waitlist_entries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  guestId: varchar("guest_id", { length: 255 }),

  fullName: varchar("full_name", { length: 255 }),
  mobile: varchar("mobile", { length: 40 }),
  email: varchar("email", { length: 320 }),
  city: varchar("city", { length: 120 }),
  country: varchar("country", { length: 80 }),
  postcode: varchar("postcode", { length: 40 }),
  language: varchar("language", { length: 8 }),

  petType: varchar("pet_type", { length: 40 }),
  petName: varchar("pet_name", { length: 120 }),

  platformKey: varchar("platform_key", { length: 40 }).notNull(),
  interestType: varchar("interest_type", { length: 60 }),
  message: text("message"),

  sourcePage: varchar("source_page", { length: 255 }),
  campaignSource: varchar("campaign_source", { length: 120 }),

  consentToContact: boolean("consent_to_contact").notNull().default(false),
  marketingConsent: boolean("marketing_consent").notNull().default(false),

  status: varchar("status", { length: 24 }).notNull().default("NEW"),
  priorityScore: integer("priority_score").notNull().default(0),
  aiTags: jsonb("ai_tags").$type<string[]>().notNull().default([]),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  platformIdx: index("idx_waitlist_platform").on(table.platformKey),
  statusIdx: index("idx_waitlist_status").on(table.status),
  userIdx: index("idx_waitlist_user").on(table.userId),
  emailIdx: index("idx_waitlist_email").on(table.email),
}));

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;

/** Public capture payload — what a "Join waitlist" form posts. platformKey is
 *  required; everything else optional so a page can capture progressively. */
export const createWaitlistEntrySchema = createInsertSchema(waitlistEntries, {
  platformKey: z.enum(WAITLIST_PLATFORMS),
  email: z.string().email().optional(),
}).pick({
  fullName: true, mobile: true, email: true, city: true, country: true,
  postcode: true, language: true, petType: true, petName: true,
  platformKey: true, interestType: true, message: true,
  sourcePage: true, campaignSource: true,
  consentToContact: true, marketingConsent: true,
});
export type CreateWaitlistEntry = z.infer<typeof createWaitlistEntrySchema>;

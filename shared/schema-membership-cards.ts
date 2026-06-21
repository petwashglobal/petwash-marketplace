/**
 * Membership credential system — PetWash Ltd, 2026.
 *
 * The single record behind a member's PHYSICAL card + MOBILE WALLET pass + QR
 * redemption. One row per user. The QR/barcode carry only an opaque token — NEVER
 * personal data — and resolve to this row on scan.
 *
 *   QR content:      https://petwash.co.il/m/{qr_token}
 *   Barcode content: {barcode_value}
 *
 * On scan we look up the token, reject if not active, show a renewal message if
 * expired, and otherwise return the allowed benefits. Every scan is logged.
 */
import { pgTable, serial, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const CARD_STATUSES = ["active", "frozen", "lost", "expired", "cancelled"] as const;
export const CARD_TIERS = ["standard", "gold", "platinum", "founder", "vip"] as const;
export const SCAN_TYPES = ["qr", "barcode", "nfc"] as const;
export const SCAN_RESULTS = ["approved", "rejected", "expired", "suspicious"] as const;

/** Short tier code used in the human-facing member id (PW-{code}-{n}). */
export const TIER_CODE: Record<(typeof CARD_TIERS)[number], string> = {
  standard: "STD",
  gold: "GLD",
  platinum: "PLT",
  founder: "FDR",
  vip: "VIP",
};

export const membershipCards = pgTable(
  "membership_cards",
  {
    id: serial("id").primaryKey(),
    // One card per user (Firebase UID).
    userId: varchar("user_id", { length: 128 }).notNull().unique(),

    // Human-facing id printed on the card, e.g. PW-PLT-000128.
    memberId: varchar("member_id", { length: 32 }).notNull().unique(),
    // Grouped 16-digit display number, e.g. "2318 4721 8506 1193". Display only —
    // it is a membership number, NOT a payment card number.
    cardNumberDisplay: varchar("card_number_display", { length: 32 }).notNull(),

    // Opaque secure token embedded in the QR (never personal data). Rotatable.
    qrToken: varchar("qr_token", { length: 64 }).notNull().unique(),
    // Barcode backup value, e.g. PWPLT000128X9.
    barcodeValue: varchar("barcode_value", { length: 40 }).notNull().unique(),

    cardStatus: varchar("card_status", { length: 16 }).notNull().default("active"), // CARD_STATUSES
    tier: varchar("tier", { length: 16 }).notNull().default("standard"),            // CARD_TIERS

    validFrom: timestamp("valid_from").defaultNow().notNull(),
    validUntil: timestamp("valid_until"),

    // Convenience copies surfaced on scan (authoritative balances live in the wallet).
    washCreditBalance: integer("wash_credit_balance").default(0).notNull(),
    loyaltyPoints: integer("loyalty_points").default(0).notNull(),

    // Optional Nayax linkage (closed-loop hardware).
    linkedNayaxCustomerId: varchar("linked_nayax_customer_id", { length: 128 }),
    linkedNayaxCardId: varchar("linked_nayax_card_id", { length: 128 }),

    lastScanAt: timestamp("last_scan_at"),
    lastUsedStationId: varchar("last_used_station_id", { length: 64 }),

    // Audit for admin actions (freeze / regenerate).
    frozenReason: text("frozen_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_membership_cards_user").on(t.userId),
    index("idx_membership_cards_member").on(t.memberId),
    index("idx_membership_cards_status").on(t.cardStatus),
  ],
);

/** Append-only log of every credential scan (QR / barcode / NFC). */
export const cardScanEvents = pgTable(
  "card_scan_events",
  {
    id: serial("id").primaryKey(),
    scanId: varchar("scan_id", { length: 40 }).notNull().unique(),
    userId: varchar("user_id", { length: 128 }),
    memberId: varchar("member_id", { length: 32 }),
    stationId: varchar("station_id", { length: 64 }),
    providerId: varchar("provider_id", { length: 128 }),
    scanType: varchar("scan_type", { length: 12 }).notNull(),   // SCAN_TYPES
    result: varchar("result", { length: 16 }).notNull(),        // SCAN_RESULTS
    detail: text("detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_card_scan_member").on(t.memberId),
    index("idx_card_scan_created").on(t.createdAt),
  ],
);

export type MembershipCard = typeof membershipCards.$inferSelect;
export type CardScanEvent = typeof cardScanEvents.$inferSelect;

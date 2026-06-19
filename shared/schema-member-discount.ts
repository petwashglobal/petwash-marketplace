/**
 * MEMBER WASH DISCOUNT — verified-discount engine (additive, flag-aware).
 *
 * CEO design (2026-06-20):
 *   - Prestige Basic loyalty member → 5% off EVERY K9000 wash (AUTOMATIC,
 *     derived from loyalty membership at price time — NO row required here).
 *   - Senior (65+) / disability → member mails PHYSICAL documents to the
 *     PetWash registered address. Admin reviews + DESTROYS the documents.
 *     NOTHING is stored digitally. Admin then ticks an approved discount of
 *     5%, 7% or 10% that applies to the K9000 WASH price ONLY.
 *
 * PRIVACY — this table stores NO document / ID / passport / certificate data.
 * It records ONLY the DECISION: the approved percent, who approved it, when,
 * and a free-text reason / review note. The document review is offline and the
 * physical papers are destroyed; we never keep an image, number, or scan.
 *
 * SCOPE — these discounts apply to K9000 WASH SKUs ONLY (single wash + wash
 * packages). They never apply to eGift, wallet top-up, shop, or any other
 * service. Scope is enforced in the price path, not here.
 *
 * Backed by migration 0059_member_wash_discounts.sql (additive — no existing
 * table is altered). 2026-06-20.
 */
import { pgTable, serial, varchar, integer, timestamp, text, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/** Why a member qualifies for a wash discount. */
export const MEMBER_DISCOUNT_TYPES = ['senior', 'disability', 'prestige_basic'] as const;
export type MemberDiscountType = (typeof MEMBER_DISCOUNT_TYPES)[number];

/** Approved percents the admin may tick. Hard-capped at 10. */
export const MEMBER_DISCOUNT_PERCENTS = [5, 7, 10] as const;
export type MemberDiscountPercent = (typeof MEMBER_DISCOUNT_PERCENTS)[number];

/** Lifecycle of a member discount record. */
export const MEMBER_DISCOUNT_STATUSES = ['pending', 'approved', 'revoked'] as const;
export type MemberDiscountStatus = (typeof MEMBER_DISCOUNT_STATUSES)[number];

/** How the discount entered the system. */
export const MEMBER_DISCOUNT_SOURCES = ['postal_review', 'auto_loyalty'] as const;
export type MemberDiscountSource = (typeof MEMBER_DISCOUNT_SOURCES)[number];

/** Maximum discount percent the engine will ever apply (clamp). */
export const MEMBER_DISCOUNT_MAX_PERCENT = 10;

export const memberWashDiscounts = pgTable(
  'member_wash_discounts',
  {
    id: serial('id').primaryKey(),
    // Firebase UID of the member the discount belongs to.
    userId: varchar('user_id', { length: 255 }).notNull(),
    // senior | disability | prestige_basic
    discountType: varchar('discount_type', { length: 32 }).notNull(),
    // Approved percent (5 / 7 / 10). Clamped to <= 10 at write + at apply time.
    discountPercent: integer('discount_percent').notNull(),
    // pending | approved | revoked
    status: varchar('status', { length: 16 }).notNull().default('pending'),
    // Firebase UID / email of the admin who approved or revoked it.
    verifiedByAdminId: varchar('verified_by_admin_id', { length: 255 }),
    verifiedAt: timestamp('verified_at'),
    // postal_review (senior/disability) | auto_loyalty (reserved; prestige is
    // derived live, not stored).
    source: varchar('source', { length: 32 }).notNull().default('postal_review'),
    // Free-text decision context. NEVER put ID / document data here.
    reason: text('reason'),
    reviewNote: text('review_note'),
    // Optional expiry — null = no expiry. A discount past its expiry is ignored.
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_member_wash_discounts_user').on(table.userId),
    statusIdx: index('idx_member_wash_discounts_status').on(table.status),
  }),
);

export type MemberWashDiscount = typeof memberWashDiscounts.$inferSelect;
export const insertMemberWashDiscountSchema = createInsertSchema(memberWashDiscounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMemberWashDiscount = z.infer<typeof insertMemberWashDiscountSchema>;

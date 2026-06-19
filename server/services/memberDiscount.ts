/**
 * MEMBER WASH DISCOUNT — server-authoritative resolver.
 *
 * The ONE place that decides what percent a member gets off a K9000 wash. The
 * client never supplies a discount; the price path calls this resolver, which
 * reads loyalty membership + the admin-approved discount record and returns the
 * single highest applicable percent (clamped to <= 10).
 *
 * Two sources combine:
 *   - Prestige Basic (automatic): any loyalty member gets 5%. Derived live from
 *     loyalty status — no admin tick, no stored row.
 *   - Senior / disability (postal review): the admin-approved percent (5/7/10)
 *     from member_wash_discounts where status='approved' and not expired.
 *
 * The member's effective wash discount is the MAX of the two, capped at 10.
 *
 * SCOPE: this resolver answers "what % off the wash", nothing else. Whether it
 * is applied at all (wash SKUs only) is decided by the caller.
 */
import { db } from '../db';
import { memberWashDiscounts, MEMBER_DISCOUNT_MAX_PERCENT } from '@shared/schema-member-discount';
import { and, eq, desc } from 'drizzle-orm';
import { getLoyaltyStatus } from './loyalty';
import { logger } from '../lib/logger';

/** Automatic discount for any Prestige Basic (loyalty) member. */
export const PRESTIGE_BASIC_PERCENT = 5;

export interface WashDiscount {
  /** Final percent off the wash price (0..10). */
  percent: number;
  /** Why — the dominant source of the percent. */
  source: 'prestige_basic' | 'senior' | 'disability' | 'none';
  /** True when the loyalty-derived Prestige Basic 5% is in effect. */
  prestigeBasic: boolean;
  /** True when an admin-approved senior/disability discount is in effect. */
  approved: boolean;
}

/** Clamp any percent into the legal [0, MAX] band and integer-ise it. */
export function clampWashPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(Math.round(percent), MEMBER_DISCOUNT_MAX_PERCENT);
}

/**
 * Apply a wash discount percent to a wash amount (in cents) server-side.
 * Rounds to whole cents and never returns more than the original amount or a
 * negative number. Pure — safe to unit-test.
 */
export function applyWashDiscountCents(
  amountCents: number,
  percent: number,
): { netCents: number; discountCents: number; percent: number } {
  const p = clampWashPercent(percent);
  if (p === 0 || !Number.isFinite(amountCents) || amountCents <= 0) {
    return { netCents: Math.max(0, Math.round(amountCents) || 0), discountCents: 0, percent: 0 };
  }
  const discountCents = Math.round((amountCents * p) / 100);
  const netCents = Math.max(0, amountCents - discountCents);
  return { netCents, discountCents, percent: p };
}

/**
 * Resolve the member's effective K9000 wash discount, server-side.
 * Combines automatic Prestige Basic (loyalty) 5% with any admin-approved
 * senior/disability percent and returns the single highest applicable value,
 * clamped to <= 10. Never throws — defaults to 0% on any error.
 */
export async function resolveWashDiscount(userId: string | undefined | null): Promise<WashDiscount> {
  const none: WashDiscount = { percent: 0, source: 'none', prestigeBasic: false, approved: false };
  if (!userId) return none;

  let prestigePercent = 0;
  try {
    const loyalty = await getLoyaltyStatus(userId);
    // CEO design: any Prestige Basic / loyalty member gets the automatic 5%.
    if (loyalty) prestigePercent = PRESTIGE_BASIC_PERCENT;
  } catch (err: any) {
    logger.warn('[MemberDiscount] loyalty lookup failed (continuing without prestige)', {
      userId, err: err?.message,
    });
  }

  let approvedPercent = 0;
  let approvedType: 'senior' | 'disability' | null = null;
  try {
    const rows = await db
      .select()
      .from(memberWashDiscounts)
      .where(and(eq(memberWashDiscounts.userId, userId), eq(memberWashDiscounts.status, 'approved')))
      .orderBy(desc(memberWashDiscounts.discountPercent));

    const now = Date.now();
    for (const row of rows) {
      // Skip expired and any non-postal (prestige is derived, never stored).
      if (row.expiresAt && new Date(row.expiresAt).getTime() <= now) continue;
      if (row.discountType !== 'senior' && row.discountType !== 'disability') continue;
      const p = clampWashPercent(row.discountPercent);
      if (p > approvedPercent) {
        approvedPercent = p;
        approvedType = row.discountType;
      }
    }
  } catch (err: any) {
    logger.warn('[MemberDiscount] approved-discount lookup failed (continuing without approval)', {
      userId, err: err?.message,
    });
  }

  const percent = clampWashPercent(Math.max(prestigePercent, approvedPercent));
  if (percent === 0) return none;

  // Pick the dominant source label for display: the approved senior/disability
  // discount wins the label when it is the larger (or equal) value.
  let source: WashDiscount['source'];
  if (approvedPercent >= prestigePercent && approvedType) {
    source = approvedType;
  } else {
    source = 'prestige_basic';
  }

  return {
    percent,
    source,
    prestigeBasic: prestigePercent > 0,
    approved: approvedPercent > 0,
  };
}

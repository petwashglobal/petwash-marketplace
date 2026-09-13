import { logger } from './logger';

/**
 * The member tier discount, from a VERIFIED, ACTIVE Prestige membership only.
 *
 * Used by the online wash-package purchase (routes.ts) and, since 2026-09-13,
 * by the K9000 bay (qr-activation.ts), so both surfaces charge the same member
 * the same way. Returns null when there is no active membership or the lookup
 * fails — a lookup failure must never lower a price.
 *
 * "Active" now requires both contacts verified (privilegeMemberActivation.ts);
 * the number comes from the CEO-locked ladder in shared/schema-loyalty.ts
 * (calculateTotalDiscount: base club 5% + tier bonus, capped at
 * MAX_DISCOUNT_CAP). Callers apply their own surface cap on top.
 */
export async function resolveMemberTierDiscount(userId: string): Promise<{ percent: number; tier: string } | null> {
  try {
    const { calculateTotalDiscount } = await import('@shared/schema-loyalty');
    const { findPrivilegeMemberForUser } = await import('./privilegeMemberLookup');
    const { canonicalTierId } = await import('@shared/lib/tierLabels');
    // 2026-09-13: this looked up privilege_members.firebase_uid, which no join
    // route wrote — so no member ever got the tier discount. See the helper.
    const member = await findPrivilegeMemberForUser(userId);
    if (!member || member.status !== 'active') return null;
    // Lower-case, alias-resolved: TIER_CONFIGS ids are lower-case and the
    // lookup below is exact, so 'GOLD' used to resolve to a 0% bonus.
    const tier = canonicalTierId(member.tier);
    const percent = calculateTotalDiscount(tier as any, 'none', false);
    return Number.isFinite(percent) ? { percent, tier } : null;
  } catch (err: any) {
    // A lookup failure must never change the price. Fall through to whatever
    // the priority ladder decided — the member keeps today's discount.
    logger.warn('[Loyalty] tier discount lookup failed — leaving discount unchanged', {
      userId, error: err?.message,
    });
    return null;
  }
}

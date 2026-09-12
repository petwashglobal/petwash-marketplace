import { db } from '../db';
import { eq } from 'drizzle-orm';
import { privilegeMembers } from '@shared/schema';
import { logger } from './logger';
import { tierPassLabel } from '@shared/lib/tierLabels';

/**
 * Member tier — ONE truth for every surface that shows or reports it.
 *
 * users.loyaltyTier is written as 'bronze' at signup for EVERY account
 * (AuthService, WalletService, social-oauth…), so it cannot say whether the
 * member joined PetWash Prestige. Enrollment is an active privilegeMembers row
 * for the email — the same truth lib/userCapabilities uses. Until then the
 * tier is 'new' and is shown as "Member".
 *
 * Read-only: nothing here touches balances or discounts (those come from
 * loyaltyDiscountPercent / the ledger, never from the tier label).
 */
export type MemberTier = 'new' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'black' | string;

export async function isPrestigeEnrolled(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  try {
    const [row] = await db
      .select({ status: privilegeMembers.status })
      .from(privilegeMembers)
      .where(eq(privilegeMembers.email, email.toLowerCase()))
      .limit(1);
    return !!row && (row.status ?? 'active') === 'active';
  } catch (e: any) {
    logger.warn('[MemberTier] prestige lookup failed (defaulting not enrolled)', { error: e?.message });
    return false;
  }
}

/** The tier to show/report for a member: 'new' unless enrolled. */
export async function resolveMemberTier(loyaltyTier: string | undefined | null, email: string | undefined | null): Promise<MemberTier> {
  return (await isPrestigeEnrolled(email)) ? ((loyaltyTier || 'bronze').toLowerCase()) : 'new';
}

/** What a pass or screen prints for a tier — never the raw 'new'. */
/** ONE tier ladder (2026-09-12): the CEO-locked names in shared/schema-loyalty.ts, upper-cased for passes. */
export function tierLabel(tier: string | undefined | null): string {
  return tierPassLabel(tier);
}

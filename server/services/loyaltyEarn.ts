/**
 * Canonical loyalty earn engine (Prestige task #13).
 *
 * The bug this fixes: the loyaltyProfiles/pointsTransactions store — the ONE every
 * Prestige surface reads (dashboard, rewards, tier-up emails) — was only ever fed
 * the welcome 100 points at enrollment. Nothing added points for real spend, so a
 * member's balance never grew, tiers never climbed, and the AI "one wash from
 * Gold" nudge had nothing to work with. (The only spend trigger that existed wrote
 * to a DIFFERENT store the Prestige UI doesn't read.)
 *
 * This is the single canonical function to award points into System A. Call it on
 * any confirmed PetWash-owned sale (wash-package purchase, eGift, shop, marketplace
 * booking). Rate is 1 point per ₪1 (repo-wide constant).
 */
import { db } from '../db';
import { loyaltyProfiles, pointsTransactions } from '@shared/schema-loyalty';
import { detectTierUpgrade } from '../email/luxury-email-service';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';

/** Repo-wide earn rate: 1 loyalty point per ₪1 of confirmed spend. */
export const POINTS_PER_SHEKEL = 1;

export interface AwardPointsInput {
  userId: string;
  /** Points to award (will be floored). Use pointsForSpend() for ₪→points. */
  amount: number;
  /** e.g. 'wash_package_purchase', 'egift', 'shop', 'marketplace_booking'. */
  source: string;
  /** Idempotency key for this earn event (e.g. washHistoryId). */
  sourceId: string;
  description?: string;
}

export interface AwardPointsResult {
  awarded: boolean;
  skipped?: 'no_profile' | 'duplicate' | 'zero' | 'error';
  points?: number;
  newBalance?: number;
  tierUpgraded?: boolean;
  newTier?: string;
}

/** Convert a ₪ amount to whole loyalty points. */
export function pointsForSpend(shekels: number): number {
  return Math.floor(Math.max(0, Number(shekels) || 0) * POINTS_PER_SHEKEL);
}

/**
 * Award points into the canonical loyaltyProfiles + pointsTransactions store and
 * apply any tier upgrade. Idempotent per (userId, source, sourceId) so a webhook
 * retry can never double-award. Only enrolled members (with a loyaltyProfiles row)
 * earn — everyone else is skipped, not errored. Never throws.
 */
export async function awardLoyaltyPoints(input: AwardPointsInput): Promise<AwardPointsResult> {
  const { userId, source, sourceId, description } = input;
  const amount = Math.floor(input.amount);
  if (!userId || amount <= 0) return { awarded: false, skipped: 'zero' };

  try {
    // Idempotency — already awarded for this exact source event?
    const existing = await db
      .select({ id: pointsTransactions.id })
      .from(pointsTransactions)
      .where(and(
        eq(pointsTransactions.userId, userId),
        eq(pointsTransactions.source, source),
        eq(pointsTransactions.sourceId, sourceId),
      ))
      .limit(1);
    if (existing.length) return { awarded: false, skipped: 'duplicate' };

    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);
    if (!profile) return { awarded: false, skipped: 'no_profile' };

    const newBalance = profile.points + amount;
    const newLifetime = profile.lifetimePoints + amount;

    await db
      .update(loyaltyProfiles)
      .set({ points: newBalance, lifetimePoints: newLifetime, updatedAt: new Date() })
      .where(eq(loyaltyProfiles.userId, userId));

    const tierCheck = detectTierUpgrade(profile.lifetimePoints, newLifetime);
    if (tierCheck.upgraded) {
      await db
        .update(loyaltyProfiles)
        .set({ tier: tierCheck.newTier, tierSince: new Date() })
        .where(eq(loyaltyProfiles.userId, userId));
      logger.info('[LoyaltyEarn] Tier upgrade', { userId, from: tierCheck.previousTier, to: tierCheck.newTier });
    }

    await db.insert(pointsTransactions).values({
      userId,
      type: 'earned',
      amount,
      balance: newBalance,
      source,
      sourceId,
      description: description ?? `Earned ${amount} points`,
    });

    logger.info('[LoyaltyEarn] Awarded points', {
      userId, amount, source, sourceId, newBalance, tierUpgraded: tierCheck.upgraded,
    });
    return {
      awarded: true,
      points: amount,
      newBalance,
      tierUpgraded: tierCheck.upgraded,
      newTier: tierCheck.upgraded ? tierCheck.newTier : undefined,
    };
  } catch (err: any) {
    logger.error('[LoyaltyEarn] Failed to award points', { error: err?.message, userId, source, sourceId });
    return { awarded: false, skipped: 'error' };
  }
}

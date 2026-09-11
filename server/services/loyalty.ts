/**
 * LOYALTY SERVICE
 * Centralized loyalty tier and points management
 * 
 * Features:
 * - Tier verification with caching
 * - Points retrieval
 * - PostgreSQL + Firestore fallback
 * - Memoization for performance
 */

import { db } from '../db';
import admin from '../lib/firebase-admin';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import memoizee from 'memoizee';
import { MEMBER_DISCOUNT_MAX_PERCENT } from '@shared/schema-member-discount';

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface LoyaltyUser {
  userId: string;
  email: string;
  tier: LoyaltyTier;
  points: number;
  discount: number; // percentage
}

/**
 * Get loyalty tier discount percentage.
 *
 * THIS TABLE IS STALE AND IS NOT THE AUTHORITY. The canonical ladder is
 * shared/schema-loyalty.ts (7 tiers, base 5% + tierBonusPercent, capped at
 * MAX_DISCOUNT_CAP) — that is what the customer-facing page advertises and
 * where the CEO-locked tier names come from. The five names below
 * (BRONZE..DIAMOND) match no surface we ship.
 *
 * WHY IT IS CLAMPED RATHER THAN DELETED. Nothing charges off this number
 * today — verified end to end: `getLoyaltyStatus` puts it on
 * `LoyaltyUser.discount`, and the only consumers are
 * `services/memberDiscount.ts`, which reads the object purely as an EXISTENCE
 * check (`if (loyalty) prestigePercent = PRESTIGE_BASIC_PERCENT`) and never
 * touches `.discount`, and `middleware/loyalty.ts`, which never reads it at
 * all. So this is a phantom field, not a live leak.
 *
 * But it is a loaded gun. The raw table returns 20% for DIAMOND while the real
 * charge caps at MEMBER_DISCOUNT_MAX_PERCENT (10%), and the comment in
 * routes.ts already says out loud that it "should be deleted before someone
 * wires it". Deleting it means touching three import sites and a public type
 * for no behaviour change; clamping it means that the day someone DOES wire
 * it, it cannot breach the cap. Same defence `actions/loyaltySync.ts` already
 * applies to its own copy of this table.
 *
 * Advertising a discount larger than the one charged is a false-discount
 * promise, which is the failure this guards against.
 */
export function getTierDiscount(tier: LoyaltyTier): number {
  const discounts: Record<LoyaltyTier, number> = {
    BRONZE: 0,
    SILVER: 5,
    GOLD: 10,
    PLATINUM: 15,
    DIAMOND: 20,
  };
  return Math.min(discounts[tier] || 0, MEMBER_DISCOUNT_MAX_PERCENT);
}

/**
 * Check if user meets minimum tier requirement
 */
export function meetsTierRequirement(userTier: LoyaltyTier, minimumTier: LoyaltyTier): boolean {
  const tierOrder: LoyaltyTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
  const userIndex = tierOrder.indexOf(userTier);
  const minIndex = tierOrder.indexOf(minimumTier);
  
  return userIndex >= minIndex;
}

/**
 * Get user's loyalty status (with caching)
 * Cached for 5 minutes to reduce database load
 */
const _getLoyaltyStatusUncached = async (userId: string): Promise<LoyaltyUser | null> => {
  try {
    // Try PostgreSQL first (id column stores Firebase UID)
    const result = await db.execute(sql`
      SELECT 
        id as "userId",
        email,
        loyalty_tier as tier,
        loyalty_points as points
      FROM users
      WHERE id = ${userId}
    `);
    
    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0] as any;
      
      // Normalize tier to uppercase (schema stores lowercase, service uses uppercase)
      const rawTier = (user.tier || '').toUpperCase();
      const normalizedTier = (['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].includes(rawTier) 
        ? rawTier 
        : 'BRONZE') as LoyaltyTier;
      
      return {
        userId: user.userId,
        email: user.email,
        tier: normalizedTier,
        points: parseInt(user.points) || 0,
        discount: getTierDiscount(normalizedTier),
      };
    }
    
    // Fallback to Firestore
    logger.info('[LoyaltyService] User not in PostgreSQL, trying Firestore', { userId });
    
    const firestore = admin.firestore();
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      logger.warn('[LoyaltyService] User not found in PostgreSQL or Firestore', { userId });
      return null;
    }
    
    const userData = userDoc.data();
    const rawFirestoreTier = (userData?.loyaltyTier || 'bronze').toUpperCase();
    const firestoreTier = (['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'].includes(rawFirestoreTier) 
      ? rawFirestoreTier 
      : 'BRONZE') as LoyaltyTier;
    
    return {
      userId,
      email: userData?.email || '',
      tier: firestoreTier,
      points: userData?.loyaltyPoints || 0,
      discount: getTierDiscount(firestoreTier),
    };
  } catch (error: any) {
    logger.error('[LoyaltyService] Failed to get loyalty status', {
      userId,
      error: error.message,
    });
    return null;
  }
};

/**
 * Get loyalty status with 5-minute cache
 */
export const getLoyaltyStatus = memoizee(_getLoyaltyStatusUncached, {
  promise: true,
  maxAge: 5 * 60 * 1000, // 5 minutes
  preFetch: true,
  length: 1, // Only cache by userId (first argument)
});

/**
 * Verify user is a loyalty member (any tier)
 */
export async function isLoyaltyMember(userId: string): Promise<boolean> {
  const status = await getLoyaltyStatus(userId);
  return status !== null && status.tier !== null;
}

/**
 * Verify user meets minimum tier requirement
 */
export async function hasTierLevel(userId: string, minimumTier: LoyaltyTier): Promise<boolean> {
  const status = await getLoyaltyStatus(userId);
  
  if (!status) {
    return false;
  }
  
  return meetsTierRequirement(status.tier, minimumTier);
}

/**
 * Clear cache for a specific user (use after loyalty updates)
 */
export function clearLoyaltyCache(userId: string): void {
  getLoyaltyStatus.delete(userId);
  logger.info('[LoyaltyService] Cache cleared', { userId });
}

/**
 * Clear all loyalty caches (use sparingly)
 */
export function clearAllLoyaltyCaches(): void {
  getLoyaltyStatus.clear();
  logger.info('[LoyaltyService] All caches cleared');
}

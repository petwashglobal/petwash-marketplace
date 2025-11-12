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
import admin from 'firebase-admin';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import memoizee from 'memoizee';

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface LoyaltyUser {
  userId: string;
  email: string;
  tier: LoyaltyTier;
  points: number;
  discount: number; // percentage
}

/**
 * Get loyalty tier discount percentage
 */
export function getTierDiscount(tier: LoyaltyTier): number {
  const discounts: Record<LoyaltyTier, number> = {
    BRONZE: 0,
    SILVER: 5,
    GOLD: 10,
    PLATINUM: 15,
    DIAMOND: 20,
  };
  return discounts[tier] || 0;
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
    // Try PostgreSQL first
    const result = await db.execute(sql`
      SELECT 
        firebase_uid as "userId",
        email,
        loyalty_tier as tier,
        loyalty_points as points
      FROM users
      WHERE firebase_uid = ${userId}
    `);
    
    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0] as any;
      
      // Verify user has at least Bronze tier
      if (!user.tier) {
        logger.warn('[LoyaltyService] User has no tier assigned', { userId });
        return null;
      }
      
      return {
        userId: user.userId,
        email: user.email,
        tier: user.tier as LoyaltyTier,
        points: parseInt(user.points) || 0,
        discount: getTierDiscount(user.tier as LoyaltyTier),
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
    const tier = (userData?.loyaltyTier || 'BRONZE') as LoyaltyTier;
    
    return {
      userId,
      email: userData?.email || '',
      tier,
      points: userData?.loyaltyPoints || 0,
      discount: getTierDiscount(tier),
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

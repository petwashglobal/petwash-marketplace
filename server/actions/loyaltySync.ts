/**
 * LOYALTY POINTS REALTIME SYNC
 * PostgreSQL + Firebase Sync for Instant Mobile Updates
 * 
 * Features:
 * - Atomic points updates (PostgreSQL transaction safety)
 * - Real-time Firestore sync for mobile apps
 * - Automatic tier calculation (Silver, Gold, Platinum, Diamond)
 * - Activity logging for fraud detection
 */

import admin from 'firebase-admin';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * Loyalty tier thresholds
 */
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 100,
  GOLD: 500,
  PLATINUM: 1000,
  DIAMOND: 5000,
};

/**
 * Calculate loyalty tier based on points
 */
function calculateTier(points: number): string {
  if (points >= TIER_THRESHOLDS.DIAMOND) return 'DIAMOND';
  if (points >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (points >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (points >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

/**
 * Get tier discount percentage
 */
function getTierDiscount(tier: string): number {
  const discounts = {
    BRONZE: 0,
    SILVER: 5,
    GOLD: 10,
    PLATINUM: 15,
    DIAMOND: 20,
  };
  return discounts[tier as keyof typeof discounts] || 0;
}

/**
 * Update user loyalty points with real-time sync
 * 
 * @param userId - Firebase UID
 * @param pointsDelta - Points to add (positive) or subtract (negative)
 * @param reason - Reason for points change (e.g., 'purchase', 'referral', 'birthday')
 * @param metadata - Additional context data
 * @returns Updated user loyalty data
 */
export async function updateLoyalty(
  userId: string,
  pointsDelta: number,
  reason: string = 'manual_adjustment',
  metadata?: Record<string, any>
) {
  let postgresUpdated = false;
  let newPoints = 0;
  let newTier = '';
  let discount = 0;
  
  try {
    logger.info('[LoyaltySync] Updating loyalty points', {
      userId,
      pointsDelta,
      reason,
    });
    
    // STEP 1: Atomic PostgreSQL transaction (all DB changes in one transaction)
    await db.transaction(async (tx) => {
      // Update loyalty points
      const result = await tx.execute(sql`
        UPDATE users 
        SET 
          loyalty_points = GREATEST(0, loyalty_points + ${pointsDelta}),
          updated_at = NOW()
        WHERE firebase_uid = ${userId}
        RETURNING 
          loyalty_points as points,
          email,
          display_name as "displayName",
          loyalty_tier as "oldTier"
      `);
      
      if (!result.rows || result.rows.length === 0) {
        throw new Error(`User not found in PostgreSQL: ${userId}`);
      }
      
      const userData = result.rows[0] as any;
      newPoints = userData.points;
      const oldTier = userData.oldTier;
      
      // Calculate new tier
      newTier = calculateTier(newPoints);
      discount = getTierDiscount(newTier);
      
      // Update tier in same transaction
      await tx.execute(sql`
        UPDATE users 
        SET loyalty_tier = ${newTier}
        WHERE firebase_uid = ${userId}
      `);
      
      // Log activity in same transaction
      await tx.execute(sql`
        INSERT INTO loyalty_activity_log (
          user_id,
          points_delta,
          reason,
          new_balance,
          new_tier,
          metadata,
          created_at
        ) VALUES (
          ${userId},
          ${pointsDelta},
          ${reason},
          ${newPoints},
          ${newTier},
          ${JSON.stringify({ ...metadata, oldTier })},
          NOW()
        )
      `);
      
      // Mark that PostgreSQL update succeeded
      postgresUpdated = true;
      
      logger.info('[LoyaltySync] PostgreSQL transaction committed', {
        userId,
        newPoints,
        newTier,
      });
    });
    
    // STEP 2: Sync to Firestore (with merge to handle new users)
    const firestore = admin.firestore();
    await firestore.collection('users').doc(userId).set({
      loyaltyPoints: newPoints,
      loyaltyTier: newTier,
      loyaltyDiscount: discount,
      lastLoyaltyUpdate: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }); // merge: true creates doc if missing
    
    logger.info('[LoyaltySync] Firestore sync complete', {
      userId,
      newPoints,
      newTier,
      discount: `${discount}%`,
    });
    
    // STEP 3: Send push notification if tier upgraded (best-effort, don't fail)
    const oldTier = metadata?.oldTier;
    if (oldTier && oldTier !== newTier) {
      // Don't await - fire and forget
      sendTierUpgradeNotification(userId, newTier, discount).catch(err => {
        logger.warn('[LoyaltySync] Push notification failed (non-critical)', {
          userId,
          error: err.message,
        });
      });
    }
    
    return {
      success: true,
      points: newPoints,
      tier: newTier,
      discount,
      change: pointsDelta,
    };
    
  } catch (error: any) {
    logger.error('[LoyaltySync] Failed to update loyalty', {
      userId,
      postgresUpdated,
      error: error.message,
      stack: error.stack,
    });
    
    // CRITICAL: If Firestore failed but PostgreSQL succeeded, we need compensation
    if (postgresUpdated) {
      logger.error('[LoyaltySync] 🚨 CRITICAL: PostgreSQL updated but Firestore failed - attempting rollback', {
        userId,
        points: newPoints,
        tier: newTier,
      });
      
      try {
        // Attempt rollback by reversing the points change
        await db.execute(sql`
          UPDATE users 
          SET 
            loyalty_points = GREATEST(0, loyalty_points - ${pointsDelta}),
            updated_at = NOW()
          WHERE firebase_uid = ${userId}
        `);
        
        // Recalculate tier after rollback
        const rollbackTier = calculateTier(Math.max(0, newPoints - pointsDelta));
        await db.execute(sql`
          UPDATE users 
          SET loyalty_tier = ${rollbackTier}
          WHERE firebase_uid = ${userId}
        `);
        
        // Log rollback event
        await db.execute(sql`
          INSERT INTO loyalty_activity_log (
            user_id,
            points_delta,
            reason,
            new_balance,
            new_tier,
            metadata,
            created_at
          ) VALUES (
            ${userId},
            ${-pointsDelta},
            'rollback_firestore_failure',
            ${Math.max(0, newPoints - pointsDelta)},
            ${rollbackTier},
            ${JSON.stringify({ originalError: error.message, ...metadata })},
            NOW()
          )
        `);
        
        logger.info('[LoyaltySync] ✅ Rollback successful', { userId });
      } catch (rollbackError: any) {
        logger.error('[LoyaltySync] 🚨🚨 ROLLBACK FAILED - MANUAL INTERVENTION REQUIRED', {
          userId,
          originalError: error.message,
          rollbackError: rollbackError.message,
        });
        
        // Alert ops team
        // TODO: Send Slack/email alert to ops
      }
    }
    
    throw error;
  }
}

/**
 * Send push notification for tier upgrade
 */
async function sendTierUpgradeNotification(
  userId: string,
  newTier: string,
  discount: number
) {
  try {
    // Get user's FCM token from Firestore
    const firestore = admin.firestore();
    const userDoc = await firestore.collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;
    
    if (!fcmToken) {
      logger.warn('[LoyaltySync] No FCM token for tier upgrade notification', { userId });
      return;
    }
    
    const messaging = admin.messaging();
    await messaging.send({
      token: fcmToken,
      notification: {
        title: '🎉 Tier Upgrade!',
        body: `Congratulations! You've reached ${newTier} tier with ${discount}% discount!`,
      },
      data: {
        type: 'tier_upgrade',
        tier: newTier,
        discount: discount.toString(),
      },
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
      },
    });
    
    logger.info('[LoyaltySync] Tier upgrade notification sent', {
      userId,
      newTier,
    });
  } catch (error: any) {
    logger.error('[LoyaltySync] Failed to send tier upgrade notification', {
      userId,
      error: error.message,
    });
  }
}

/**
 * Get user's current loyalty status
 */
export async function getLoyaltyStatus(userId: string) {
  try {
    const result = await db.execute(sql`
      SELECT 
        loyalty_points as points,
        loyalty_tier as tier
      FROM users
      WHERE firebase_uid = ${userId}
    `);
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    const data = result.rows[0] as any;
    const discount = getTierDiscount(data.tier);
    
    // Calculate points needed for next tier
    let nextTier = '';
    let pointsToNext = 0;
    
    if (data.points < TIER_THRESHOLDS.SILVER) {
      nextTier = 'SILVER';
      pointsToNext = TIER_THRESHOLDS.SILVER - data.points;
    } else if (data.points < TIER_THRESHOLDS.GOLD) {
      nextTier = 'GOLD';
      pointsToNext = TIER_THRESHOLDS.GOLD - data.points;
    } else if (data.points < TIER_THRESHOLDS.PLATINUM) {
      nextTier = 'PLATINUM';
      pointsToNext = TIER_THRESHOLDS.PLATINUM - data.points;
    } else if (data.points < TIER_THRESHOLDS.DIAMOND) {
      nextTier = 'DIAMOND';
      pointsToNext = TIER_THRESHOLDS.DIAMOND - data.points;
    }
    
    return {
      points: data.points,
      tier: data.tier,
      discount,
      nextTier,
      pointsToNext,
    };
  } catch (error: any) {
    logger.error('[LoyaltySync] Failed to get loyalty status', {
      userId,
      error: error.message,
    });
    return null;
  }
}

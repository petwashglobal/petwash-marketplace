import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import {
  loyaltyProfiles,
  pointsTransactions,
  badges,
  userBadges,
  dailyChallenges,
  userChallenges,
  rewardsMarketplace,
  userRedemptions,
  referrals,
  type LoyaltyProfile,
  type PointsTransaction,
  type Badge,
  type UserBadge,
  type DailyChallenge,
  type UserChallenge,
  type RewardItem,
  type UserRedemption,
  type Referral,
  insertLoyaltyProfileSchema,
  insertPointsTransactionSchema,
  insertBadgeSchema,
  insertUserBadgeSchema,
  insertDailyChallengeSchema,
  insertUserChallengeSchema,
  insertRewardItemSchema,
  insertUserRedemptionSchema,
  insertReferralSchema,
} from '../../shared/schema-loyalty';
import { users, loyaltyCampaigns } from '../../shared/schema';
import type { AuthenticatedRequest } from '../middleware/rbac';
import { requireAdmin } from '../middleware/rbac';
import { logger } from '../lib/logger';

const router = Router();

// ========================================
// LOYALTY PROFILE
// ========================================

/**
 * GET /api/loyalty/profile - Get user's loyalty profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;

    let [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);

    // Create profile if doesn't exist
    if (!profile) {
      [profile] = await db
        .insert(loyaltyProfiles)
        .values({
          userId,
          tier: 'new',
          tierSince: new Date(),
          tierProgress: 0,
          tierThreshold: 1000,
          points: 0,
          lifetimePoints: 0,
          xp: 0,
          level: 1,
          totalWashes: 0,
          currentStreak: 0,
          longestStreak: 0,
          averageWashInterval: 21,
          isVip: false,
          conciergeAccess: false,
          prioritySupport: false,
        })
        .returning();
    }

    res.json(profile);
  } catch (error) {
    logger.error('Error fetching loyalty profile:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty profile' });
  }
});

/**
 * PATCH /api/loyalty/profile - Update loyalty profile (customer-editable fields only)
 * Security: Only allows updating non-privileged preferences. Tier, points, VIP status are read-only.
 */
router.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    
    // WHITELIST: Only allow customers to update their preferences, never privileged fields
    const allowedFields = {
      preferredStations: req.body.preferredStations,
      preferredTimes: req.body.preferredTimes,
    };
    
    // Remove undefined fields
    const updates: any = {};
    Object.entries(allowedFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates[key] = value;
      }
    });
    
    // If no valid updates, return current profile
    if (Object.keys(updates).length === 0) {
      const [current] = await db
        .select()
        .from(loyaltyProfiles)
        .where(eq(loyaltyProfiles.userId, userId))
        .limit(1);
      
      return res.json(current || { error: 'Profile not found' });
    }
    
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(loyaltyProfiles)
      .set(updates)
      .where(eq(loyaltyProfiles.userId, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Loyalty profile not found' });
    }

    logger.info(`Loyalty profile updated for user ${userId}`, { updates: Object.keys(updates) });
    res.json(updated);
  } catch (error) {
    logger.error('Error updating loyalty profile:', error);
    res.status(500).json({ error: 'Failed to update loyalty profile' });
  }
});

// ========================================
// POINTS & TRANSACTIONS
// ========================================

/**
 * GET /api/loyalty/points/history - Get points transaction history
 */
router.get('/points/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const transactions = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.userId, userId))
      .orderBy(desc(pointsTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(transactions);
  } catch (error) {
    logger.error('Error fetching points history:', error);
    res.status(500).json({ error: 'Failed to fetch points history' });
  }
});

/**
 * POST /api/loyalty/points/add - Add points (admin/system only)
 * NOTE: This is an admin-only endpoint. Customer-facing point awards should happen through
 * other business logic (washes, challenges, etc.)
 */
router.post('/points/add', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, amount, source, sourceId, description } = req.body;

    // Get current balance
    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Loyalty profile not found' });
    }

    const newBalance = profile.points + amount;
    const newLifetimePoints = profile.lifetimePoints + (amount > 0 ? amount : 0);

    // Update profile
    await db
      .update(loyaltyProfiles)
      .set({
        points: newBalance,
        lifetimePoints: newLifetimePoints,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyProfiles.userId, userId));

    // Log transaction
    const [transaction] = await db
      .insert(pointsTransactions)
      .values({
        userId,
        type: amount > 0 ? 'earned' : 'redeemed',
        amount,
        balance: newBalance,
        source,
        sourceId,
        description,
      })
      .returning();

    res.json(transaction);
  } catch (error) {
    logger.error('Error adding points:', error);
    res.status(500).json({ error: 'Failed to add points' });
  }
});

// ========================================
// BADGES
// ========================================

/**
 * GET /api/loyalty/badges - Get all available badges
 */
router.get('/badges', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.isActive, true))
      .orderBy(badges.displayOrder);

    res.json(allBadges);
  } catch (error) {
    logger.error('Error fetching badges:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

/**
 * GET /api/loyalty/badges/unlocked - Get user's unlocked badges
 */
router.get('/badges/unlocked', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;

    const unlockedBadges = await db
      .select({
        userBadge: userBadges,
        badge: badges,
      })
      .from(userBadges)
      .leftJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.unlockedAt));

    res.json(unlockedBadges);
  } catch (error) {
    logger.error('Error fetching unlocked badges:', error);
    res.status(500).json({ error: 'Failed to fetch unlocked badges' });
  }
});

/**
 * POST /api/loyalty/badges/unlock - Unlock a badge for user (ADMIN/SYSTEM ONLY)
 * Security: This endpoint can award points/XP, so it must be restricted to trusted actors.
 * Customers should earn badges automatically via backend business logic, not by calling this API.
 */
router.post('/badges/unlock', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Admin can award badges to any user
    const { userId, badgeId } = req.body;
    
    if (!userId || !badgeId) {
      return res.status(400).json({ error: 'userId and badgeId are required' });
    }

    // Check if already unlocked
    const [existing] = await db
      .select()
      .from(userBadges)
      .where(and(
        eq(userBadges.userId, userId),
        eq(userBadges.badgeId, badgeId)
      ))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: 'Badge already unlocked' });
    }

    // Get badge details for rewards
    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, badgeId))
      .limit(1);

    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    // Unlock badge
    const [unlocked] = await db
      .insert(userBadges)
      .values({
        userId,
        badgeId,
        isNew: true,
      })
      .returning();

    // Award points and XP
    if (badge.pointsReward > 0 || badge.xpReward > 0) {
      const [profile] = await db
        .select()
        .from(loyaltyProfiles)
        .where(eq(loyaltyProfiles.userId, userId))
        .limit(1);

      if (profile) {
        await db
          .update(loyaltyProfiles)
          .set({
            points: profile.points + badge.pointsReward,
            lifetimePoints: profile.lifetimePoints + badge.pointsReward,
            xp: profile.xp + badge.xpReward,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyProfiles.userId, userId));

        // Log points transaction
        if (badge.pointsReward > 0) {
          await db.insert(pointsTransactions).values({
            userId,
            type: 'bonus',
            amount: badge.pointsReward,
            balance: profile.points + badge.pointsReward,
            source: 'badge_unlock',
            sourceId: badge.id.toString(),
            description: `Badge unlocked: ${badge.name}`,
          });
        }
      }
    }

    res.json({ unlocked, badge });
  } catch (error) {
    logger.error('Error unlocking badge:', error);
    res.status(500).json({ error: 'Failed to unlock badge' });
  }
});

// ========================================
// CHALLENGES
// ========================================

/**
 * GET /api/loyalty/challenges/active - Get active challenges for user
 */
router.get('/challenges/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const now = new Date();

    const activeChallenges = await db
      .select({
        userChallenge: userChallenges,
        challenge: dailyChallenges,
      })
      .from(userChallenges)
      .leftJoin(dailyChallenges, eq(userChallenges.challengeId, dailyChallenges.id))
      .where(and(
        eq(userChallenges.userId, userId),
        eq(userChallenges.status, 'active'),
        gte(userChallenges.expiresAt, now)
      ))
      .orderBy(userChallenges.expiresAt);

    res.json(activeChallenges);
  } catch (error) {
    logger.error('Error fetching active challenges:', error);
    res.status(500).json({ error: 'Failed to fetch active challenges' });
  }
});

/**
 * POST /api/loyalty/challenges/claim - Claim challenge reward
 */
router.post('/challenges/claim', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Security: Always use authenticated user's ID, never trust client input
    const userId = req.firebaseUser!.uid;
    const { challengeId } = req.body;

    // Get user challenge
    const [userChallenge] = await db
      .select()
      .from(userChallenges)
      .where(and(
        eq(userChallenges.userId, userId),
        eq(userChallenges.challengeId, challengeId),
        eq(userChallenges.status, 'completed')
      ))
      .limit(1);

    if (!userChallenge) {
      return res.status(404).json({ error: 'Challenge not found or not completed' });
    }

    // Get challenge details
    const [challenge] = await db
      .select()
      .from(dailyChallenges)
      .where(eq(dailyChallenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Update challenge status
    await db
      .update(userChallenges)
      .set({
        status: 'claimed',
        claimedAt: new Date(),
      })
      .where(and(
        eq(userChallenges.userId, userId),
        eq(userChallenges.challengeId, challengeId)
      ));

    // Award rewards
    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);

    if (profile) {
      await db
        .update(loyaltyProfiles)
        .set({
          points: profile.points + challenge.pointsReward,
          lifetimePoints: profile.lifetimePoints + challenge.pointsReward,
          xp: profile.xp + challenge.xpReward,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyProfiles.userId, userId));

      // Log transaction
      await db.insert(pointsTransactions).values({
        userId,
        type: 'bonus',
        amount: challenge.pointsReward,
        balance: profile.points + challenge.pointsReward,
        source: 'challenge_completion',
        sourceId: challenge.id.toString(),
        description: `Challenge completed: ${challenge.name}`,
      });
    }

    res.json({ message: 'Reward claimed successfully', reward: { points: challenge.pointsReward, xp: challenge.xpReward } });
  } catch (error) {
    logger.error('Error claiming challenge reward:', error);
    res.status(500).json({ error: 'Failed to claim challenge reward' });
  }
});

// ========================================
// REWARDS MARKETPLACE
// ========================================

/**
 * GET /api/loyalty/rewards - Get all available rewards
 */
router.get('/rewards', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();

    const availableRewards = await db
      .select()
      .from(rewardsMarketplace)
      .where(and(
        eq(rewardsMarketplace.isActive, true),
        gte(rewardsMarketplace.validUntil, now)
      ))
      .orderBy(rewardsMarketplace.displayOrder);

    res.json(availableRewards);
  } catch (error) {
    logger.error('Error fetching rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

/**
 * POST /api/loyalty/rewards/redeem - Redeem a reward
 */
router.post('/rewards/redeem', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Security: Always use authenticated user's ID, never trust client input
    const userId = req.firebaseUser!.uid;
    const { rewardId } = req.body;

    // Get reward details
    const [reward] = await db
      .select()
      .from(rewardsMarketplace)
      .where(eq(rewardsMarketplace.id, rewardId))
      .limit(1);

    if (!reward || !reward.isActive) {
      return res.status(404).json({ error: 'Reward not found or unavailable' });
    }

    // Check user points
    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Loyalty profile not found' });
    }

    if (profile.points < reward.pointsCost) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    // Check stock
    if (reward.stock !== null && reward.stock <= 0) {
      return res.status(400).json({ error: 'Reward out of stock' });
    }

    // Create redemption
    const voucherCode = `REWARD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    const [redemption] = await db
      .insert(userRedemptions)
      .values({
        userId,
        rewardId,
        pointsCost: reward.pointsCost,
        status: 'pending',
        voucherCode,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      })
      .returning();

    // Deduct points
    await db
      .update(loyaltyProfiles)
      .set({
        points: profile.points - reward.pointsCost,
        updatedAt: new Date(),
      })
      .where(eq(loyaltyProfiles.userId, userId));

    // Log transaction
    await db.insert(pointsTransactions).values({
      userId,
      type: 'redeemed',
      amount: -reward.pointsCost,
      balance: profile.points - reward.pointsCost,
      source: 'reward_redemption',
      sourceId: reward.id.toString(),
      description: `Redeemed: ${reward.name}`,
    });

    // Update stock if applicable
    if (reward.stock !== null) {
      await db
        .update(rewardsMarketplace)
        .set({
          stock: reward.stock - 1,
          updatedAt: new Date(),
        })
        .where(eq(rewardsMarketplace.id, rewardId));
    }

    res.json({ redemption, voucherCode });
  } catch (error) {
    logger.error('Error redeeming reward:', error);
    res.status(500).json({ error: 'Failed to redeem reward' });
  }
});

/**
 * GET /api/loyalty/redemptions - Get user's redemption history
 */
router.get('/redemptions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;

    const redemptions = await db
      .select({
        redemption: userRedemptions,
        reward: rewardsMarketplace,
      })
      .from(userRedemptions)
      .leftJoin(rewardsMarketplace, eq(userRedemptions.rewardId, rewardsMarketplace.id))
      .where(eq(userRedemptions.userId, userId))
      .orderBy(desc(userRedemptions.createdAt));

    res.json(redemptions);
  } catch (error) {
    logger.error('Error fetching redemptions:', error);
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

// ========================================
// REFERRALS
// ========================================

/**
 * GET /api/loyalty/referral/code - Get user's referral code
 */
router.get('/referral/code', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;

    // Generate code from user ID (deterministic)
    const code = `PW${Buffer.from(userId).toString('base64').substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

    // Get referral stats
    const referralStats = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    const totalReferrals = referralStats.length;
    const qualifiedReferrals = referralStats.filter(r => r.status === 'qualified' || r.status === 'rewarded').length;
    const totalPointsEarned = referralStats.reduce((sum, r) => sum + (r.referrerPointsEarned || 0), 0);

    res.json({
      code,
      stats: {
        total: totalReferrals,
        qualified: qualifiedReferrals,
        pointsEarned: totalPointsEarned,
      },
    });
  } catch (error) {
    logger.error('Error fetching referral code:', error);
    res.status(500).json({ error: 'Failed to fetch referral code' });
  }
});

// ========================================
// PERSONALIZED CAMPAIGNS (CONFIDENTIAL)
// ========================================

/**
 * GET /api/loyalty/personalized-message - Get personalized loyalty message
 * CONFIDENTIAL: Returns personalized discount offers based on user attributes
 * (seniors, students, councils, disability verified, custom groups)
 */
router.get('/personalized-message', async (req: Request, res: Response) => {
  try {
    const language = (req.query.language as string) || 'en';
    const now = new Date();

    // Get active campaigns
    const campaigns = await db
      .select()
      .from(loyaltyCampaigns)
      .where(and(
        eq(loyaltyCampaigns.isActive, true),
        gte(loyaltyCampaigns.endDate, now)
      ))
      .orderBy(desc(loyaltyCampaigns.specialDiscountPercent));

    // If user is authenticated, check for personalized campaigns
    const authReq = req as AuthenticatedRequest;
    if (authReq.firebaseUser) {
      const userId = authReq.firebaseUser.uid;
      
      // Get user details
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user) {
        // Check for personalized campaign based on user attributes
        for (const campaign of campaigns) {
          let matches = false;

          switch (campaign.targetGroup) {
            case 'seniors':
              matches = user.isSeniorVerified === true;
              break;
            case 'disability':
              matches = user.isDisabilityVerified === true;
              break;
            case 'vip':
              matches = user.loyaltyTier === 'platinum';
              break;
            case 'custom':
              // Custom JSON condition (future extensibility)
              try {
                if (campaign.customCondition) {
                  const condition = JSON.parse(campaign.customCondition);
                  // Add custom condition logic here
                }
              } catch (e) {
                logger.error('Error parsing custom condition:', e);
              }
              break;
          }

          if (matches) {
            return res.json({
              hasPersonalizedMessage: true,
              message: language === 'he' ? campaign.messageHe : campaign.messageEn,
              specialDiscountPercent: campaign.specialDiscountPercent,
              targetGroup: campaign.targetGroup,
            });
          }
        }
      }
    }

    // No personalized message - return standard message
    res.json({
      hasPersonalizedMessage: false,
      message: null,
    });
  } catch (error) {
    logger.error('Error fetching personalized message:', error);
    res.status(500).json({ error: 'Failed to fetch personalized message' });
  }
});

export default router;

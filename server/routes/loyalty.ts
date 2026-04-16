import { getVertexAIConfig } from '../lib/gemini-client';
import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { authService } from '../services/AuthService';
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
import { adminAuth } from '../lib/firebase-admin';
import { logger } from '../lib/logger';
import { sendLoyaltyEnrollmentConfirmation, sendClubWelcomeEmail, sendTierUpgradeEmail, sendPurchaseRewardEmail, detectTierUpgrade } from '../email/luxury-email-service';
import { eventPublisher } from '../services/EventPublisher';
import { DomainEventType } from '@shared/events';
import { logLoyaltyEnrollment } from '../services/googleSheetsIntegration';
import { FinancialDocumentService } from '../services/FinancialDocumentService';
import {
  dispatchNotifications,
  buildPrestigeJoinedSms,
  buildPointsRedeemedSms,
  buildMembershipRenewedSms,
  buildMembershipCancelledSms,
} from '../services/PetWashNotificationEngine';
import { z } from 'zod';
import { SUPPORT_EMAIL as CANONICAL_SUPPORT_EMAIL } from '@shared/support-contact';

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

    // Create profile if doesn't exist (new enrollment)
    if (!profile) {
      [profile] = await db
        .insert(loyaltyProfiles)
        .values({
          userId,
          tier: 'bronze',
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
      
      // Send loyalty enrollment confirmation email
      try {
        const userEmail = req.firebaseUser!.email;
        const firstName = req.firebaseUser!.displayName?.split(' ')[0] || 'Member';
        const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';
        
        if (userEmail) {
          await sendClubWelcomeEmail(userEmail, firstName, {
            tier: 'bronze',
            points: 0,
            language,
          });
          logger.info('[Loyalty] Club welcome email sent', { userId, email: userEmail });
        }
      } catch (emailError) {
        logger.error('[Loyalty] Failed to send enrollment email', { emailError, userId });
        // Don't fail the request if email fails
      }
    }

    res.json(profile);
  } catch (error) {
    logger.error('Error fetching loyalty profile:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty profile' });
  }
});

/**
 * POST /api/loyalty/auto-enroll - Auto-enroll new social sign-in users into loyalty program
 * Called automatically when a new user signs up via Google, Apple, or Facebook
 */
router.post('/auto-enroll', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.firebaseUser!.uid;
    const allowedProviders = ['google', 'apple', 'facebook', 'social', 'email', 'phone', 'tiktok', 'instagram'];
    const rawProvider = typeof req.body?.provider === 'string' ? req.body.provider : 'social';
    const provider = allowedProviders.includes(rawProvider) ? rawProvider : 'social';
    const email = req.firebaseUser!.email || (typeof req.body?.email === 'string' ? req.body.email : null);
    const displayName = req.firebaseUser!.displayName || (typeof req.body?.displayName === 'string' ? req.body.displayName : null);

    const allowedRoles = ['pet_parent', 'provider'];
    const rawRole = typeof req.body?.role === 'string' ? req.body.role : 'pet_parent';
    const userRole = allowedRoles.includes(rawRole) ? rawRole : 'pet_parent';

    const [existing] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, userId))
      .limit(1);

    if (existing) {
      return res.json({ success: true, enrolled: false, message: 'Already enrolled', profile: existing });
    }

    const welcomePoints = userRole === 'pet_parent' ? 100 : 100;

    const [profile] = await db
      .insert(loyaltyProfiles)
      .values({
        userId,
        tier: 'bronze',
        tierSince: new Date(),
        tierProgress: 0,
        tierThreshold: 1000,
        points: welcomePoints,
        lifetimePoints: welcomePoints,
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

    try {
      await db.insert(pointsTransactions).values({
        userId,
        type: 'earned',
        amount: welcomePoints,
        balance: welcomePoints,
        source: 'signup',
        description: `Welcome bonus - signed up via ${provider || 'social'} as ${userRole}`,
      });
    } catch (txErr) {
      logger.warn('[Loyalty] Failed to record welcome points transaction', { txErr });
    }

    try {
      const existingClaims = (await adminAuth.getUser(userId)).customClaims || {};
      await adminAuth.setCustomUserClaims(userId, {
        ...existingClaims,
        accountType: userRole === 'provider' ? 'provider' : 'pet_parent',
        role: userRole === 'provider' ? 'provider' : 'public',
        loyaltyTier: 'bronze',
        loyaltyMember: true,
        program: 'PetWash Privilege',
      });
      logger.info('[Loyalty] Custom claims set for user', { userId, accountType: userRole });
    } catch (claimsErr) {
      logger.warn('[Loyalty] Failed to set custom claims (non-blocking)', { claimsErr, userId });
    }

    if (userRole === 'provider') {
      try {
        const [certifiedBadge] = await db
          .select()
          .from(badges)
          .where(eq(badges.code, 'certified_provider'))
          .limit(1);

        if (certifiedBadge) {
          await db.insert(userBadges).values({
            userId,
            badgeId: certifiedBadge.id,
            isNew: true,
          });
          logger.info('[Loyalty] Certified badge awarded to provider', { userId });
        }
      } catch (badgeErr) {
        logger.warn('[Loyalty] Failed to award certified badge', { badgeErr, userId });
      }
    }

    try {
      const firstName = (displayName || '').split(' ')[0] || 'Member';
      const language = (req.headers['accept-language']?.includes('he') ? 'he' : 'en') as 'he' | 'en';

      if (email) {
        await sendClubWelcomeEmail(email, firstName, {
          tier: 'bronze',
          points: welcomePoints,
          language,
        });
        logger.info('[Loyalty] Club welcome email sent', { userId, provider, role: userRole });
      }
    } catch (emailError) {
      logger.error('[Loyalty] Failed to send auto-enroll email', { emailError, userId });
    }

    try {
      await logLoyaltyEnrollment({
        memberId: userId,
        firstName: (displayName || '').split(' ')[0] || '',
        lastName: (displayName || '').split(' ').slice(1).join(' ') || '',
        email: email || '',
        phone: '',
        enrollmentSource: `auto-enroll-${provider}`,
        tier: 'bronze',
        welcomePoints,
        language: req.headers['accept-language']?.includes('he') ? 'he' : 'en',
        country: 'IL',
        memberType: userRole,
      });
    } catch (sheetErr) {
      logger.warn('[Loyalty] Failed to log enrollment to Google Sheets', { sheetErr, userId });
    }

    // ── Financial document (membership_receipt) + SMS/push (fire-and-forget) ──
    try {
      const memberNumber = `PW-${userId.slice(-8).toUpperCase()}`;
      const firstName = (displayName || '').split(' ')[0] || 'חבר יקר';
      const tier = 'bronze';

      const membershipHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ Prestige — ברוך הבא לתוכנית!</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">שם</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${firstName}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">מס׳ חבר</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${memberNumber}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">רמה</td><td style="padding:8px;border-bottom:1px solid #eee;">Bronze</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">נקודות פתיחה</td><td style="padding:8px;border-bottom:1px solid #eee;">${welcomePoints}</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${new Date().toLocaleDateString('he-IL')}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il</p>
</body></html>`;

      const [userRow] = await db.select({ phone: users.phone })
        .from(users).where(eq(users.id, userId)).limit(1);

      const docRef = await FinancialDocumentService.create({
        userId,
        documentType: 'membership_receipt',
        issuedByEntity: 'PetWash',
        documentPayloadJson: { memberNumber, tier, welcomePoints, enrolledAt: new Date().toISOString() },
        renderedHtml: membershipHtml,
      });

      dispatchNotifications({
        userId,
        eventType: 'prestige_joined',
        templateKey: 'customer_prestige_joined',
        channels: ['sms', 'push'],
        sms: userRow?.phone ? {
          to: userRow.phone,
          text: buildPrestigeJoinedSms({ memberNumber, tier }),
        } : undefined,
        push: {
          userId,
          title: `ברוך הבא ל-Prestige! 👑`,
          body: `הצטרפת לתוכנית הנאמנות של PetWash™. מס׳ חבר: ${memberNumber}`,
          data: { documentRef: docRef, type: 'prestige_joined', memberNumber, tier },
        },
        debugPayload: { memberNumber, tier, documentRef: docRef },
      }).catch((e) => logger.error('[Loyalty] Notification dispatch failed silently', { error: e?.message }));
    } catch (notifErr: any) {
      logger.warn('[Loyalty] Financial doc / notification post-enroll failed (non-blocking)', { error: notifErr?.message });
    }

    logger.info(`[Loyalty] New user auto-enrolled via ${provider} as ${userRole}`, { userId, welcomePoints });

    // Ensure wallet account exists for this user (idempotent — no-op if already exists)
    // Covers Google/Apple/social login users whose wallet may not yet have been created
    authService.ensureWalletAccount(userId).catch((walletErr: any) =>
      logger.warn('[Loyalty] Wallet ensure failed after auto-enroll (non-blocking)', { error: walletErr?.message, userId })
    );

    res.json({ success: true, enrolled: true, welcomePoints, role: userRole, profile });
  } catch (error) {
    logger.error('Error in loyalty auto-enroll:', error);
    res.status(500).json({ error: 'Failed to auto-enroll in loyalty program' });
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

    const tierCheck = detectTierUpgrade(profile.lifetimePoints, newLifetimePoints);
    if (tierCheck.upgraded) {
      await db
        .update(loyaltyProfiles)
        .set({
          tier: tierCheck.newTier,
          tierSince: new Date(),
        })
        .where(eq(loyaltyProfiles.userId, userId));

      logger.info('[Loyalty] Tier upgrade detected', { userId, from: tierCheck.previousTier, to: tierCheck.newTier });

      eventPublisher.publishEvent(
        DomainEventType.LOYALTY_TIER_UPGRADED,
        {
          userId,
          previousTier: tierCheck.previousTier,
          newTier: tierCheck.newTier,
          lifetimePoints: newLifetimePoints,
        },
        { source: 'loyalty/add-points', aggregateType: 'loyalty', aggregateId: userId, userId },
      ).catch((e: any) =>
        logger.error('[Loyalty] LOYALTY_TIER_UPGRADED event publish failed', { error: e?.message, userId }),
      );
    }

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

    try {
      const firebaseUser = await adminAuth.getUser(userId);
      const userEmail = firebaseUser.email;
      const firstName = firebaseUser.displayName?.split(' ')[0] || 'Member';

      if (userEmail && tierCheck.upgraded) {
        await sendTierUpgradeEmail(
          userEmail,
          firstName,
          tierCheck.previousTier,
          tierCheck.newTier,
          { points: newBalance, language: 'he' }
        );
        logger.info('[Loyalty] Tier upgrade email sent', { userId, newTier: tierCheck.newTier });
      }

      if (userEmail && amount > 0 && source !== 'admin_adjustment') {
        await sendPurchaseRewardEmail(
          userEmail,
          firstName,
          amount,
          newBalance,
          { tier: (tierCheck.upgraded ? tierCheck.newTier : profile.tier) as any, language: 'he' }
        );
        logger.info('[Loyalty] Purchase reward email sent', { userId, pointsEarned: amount });
      }
    } catch (emailErr) {
      logger.error('[Loyalty] Failed to send points email (non-blocking)', { emailErr, userId });
    }

    res.json({ ...transaction, tierUpgrade: tierCheck.upgraded ? tierCheck : undefined });
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
    const voucherCode = `REWARD-${Date.now()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    
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

    // ── Loyalty redemption document + notifications (fire-and-forget) ──
    (async () => {
      try {
        const [customer] = await db.select({ email: users.email, phone: users.phone })
          .from(users).where(eq(users.id, userId)).limit(1);

        const newBalance = profile.points - reward.pointsCost;
        const issuedAt = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

        const redemptionHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ — אישור מימוש נקודות</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">פרס</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${reward.name}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">נקודות שנוצלו</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#c0392b;">${reward.pointsCost}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">יתרת נקודות</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#1a7a1a;">${newBalance}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">קוד קופון</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${voucherCode}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">תוקף</td><td style="padding:8px;border-bottom:1px solid #eee;">30 יום</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך</td><td style="padding:8px;">${issuedAt}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il/prestige</p>
</body></html>`;

        const docRef = await FinancialDocumentService.create({
          userId,
          documentType: 'loyalty_redemption_receipt',
          issuedByEntity: 'PetWash',
          documentPayloadJson: {
            rewardId: reward.id,
            rewardName: reward.name,
            pointsCost: reward.pointsCost,
            newBalance,
            voucherCode,
            redemptionId: redemption.id,
          },
          renderedHtml: redemptionHtml,
          idempotencyKey: `loyalty_redemption_receipt:${redemption.id}:${userId}`,
        });

        await dispatchNotifications({
          userId,
          eventType: 'points_redeemed',
          templateKey: 'customer_points_redeemed',
          channels: ['sms', 'push'],
          sms: customer?.phone ? {
            to: customer.phone,
            text: buildPointsRedeemedSms({
              rewardName: reward.name,
              pointsCost: reward.pointsCost,
              voucherCode,
              newBalance,
            }),
          } : undefined,
          push: {
            userId,
            title: `נקודות מומשו – Pet Wash™ 🏆`,
            body: `${reward.name} ממתין לך! קוד: ${voucherCode} (${reward.pointsCost} נקודות)`,
            data: { rewardId: String(reward.id), documentRef: docRef, type: 'points_redeemed' },
          },
          debugPayload: {
            rewardName: reward.name,
            voucherCode,
            smsText: buildPointsRedeemedSms({ rewardName: reward.name, pointsCost: reward.pointsCost, voucherCode, newBalance }),
            pushTitle: `נקודות מומשו – Pet Wash™ 🏆`,
            pushBody: `${reward.name} — קוד ${voucherCode}`,
            documentRef: docRef,
          },
        });
      } catch (notifErr: any) {
        logger.error('[Loyalty] Post-redemption notification failed silently', { error: notifErr?.message });
      }
    })();

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

/**
 * POST /api/loyalty/ai-rewards-message
 * T012: Gemini generates a personalized loyalty rewards message based on user tier and points.
 */
router.post('/ai-rewards-message', async (req: Request, res: Response) => {
  try {
    const uid = (req as any).firebaseUser?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { tier = 'bronze', points = 0, totalWashes = 0, nextTierPoints = 0 } = req.body;

    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI(getVertexAIConfig());
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `You are the PetWash™ loyalty program AI concierge. Write a warm, personalized 2-sentence message for a ${tier.toUpperCase()} tier member who has ${points} points and ${totalWashes} total washes. ${nextTierPoints > 0 ? `They need ${nextTierPoints} more points to reach the next tier.` : 'They are at the top tier!'} Be encouraging, celebratory, and mention their pet care dedication. Include one pet-themed emoji. Keep it under 40 words.` }]
      }],
    });

    res.json({ message: result.text?.trim() || `Welcome back, loyal PetWash™ ${tier} member! Your dedication to pet care is remarkable. 🐾` });
  } catch (error) {
    logger.error('Error generating AI loyalty message', error);
    res.status(500).json({ error: 'Failed to generate loyalty message' });
  }
});

// ========================================
// MEMBERSHIP RENEWAL
// ========================================

/**
 * POST /api/loyalty/membership/renew
 * Manually renew a Prestige membership for one year.
 * Admin use or triggered from a payment webhook.
 */
router.post('/membership/renew', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, targetUserId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Loyalty profile not found' });
    }

    const renewedUntilDate = new Date();
    renewedUntilDate.setFullYear(renewedUntilDate.getFullYear() + 1);
    const renewedUntilStr = renewedUntilDate.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

    await db
      .update(loyaltyProfiles)
      .set({ updatedAt: new Date() })
      .where(eq(loyaltyProfiles.userId, targetUserId));

    // ── Financial document + notifications (fire-and-forget) ──
    (async () => {
      try {
        const [customer] = await db.select({ email: users.email, phone: users.phone })
          .from(users).where(eq(users.id, targetUserId)).limit(1);

        const issuedAt = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
        const tier = profile.tier || 'bronze';

        const renewalHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ Prestige — חידוש חברות</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">רמת חברות</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${tier}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">תקף עד</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:#1a7a1a;">${renewedUntilStr}</td></tr>
  <tr><td style="padding:8px;color:#555;">תאריך חידוש</td><td style="padding:8px;">${issuedAt}</td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL} | petwash.co.il/prestige</p>
</body></html>`;

        const docRef = await FinancialDocumentService.create({
          userId: targetUserId,
          documentType: 'membership_receipt',
          issuedByEntity: 'PetWash',
          documentPayloadJson: {
            tier,
            renewedUntil: renewedUntilDate.toISOString(),
            renewedUntilStr,
            eventSubtype: 'renewal',
          },
          renderedHtml: renewalHtml,
          idempotencyKey: `membership_renewed:${targetUserId}:${renewedUntilDate.toISOString().slice(0, 10)}`,
        });

        await dispatchNotifications({
          userId: targetUserId,
          eventType: 'membership_renewed',
          templateKey: 'customer_membership_renewed',
          channels: ['sms', 'push'],
          sms: customer?.phone ? {
            to: customer.phone,
            text: buildMembershipRenewedSms({ tier, renewedUntil: renewedUntilStr }),
          } : undefined,
          push: {
            userId: targetUserId,
            title: `PetWash™ Prestige — חברות חודשה 👑`,
            body: `חברות ${tier} שלך חודשה עד ${renewedUntilStr}`,
            data: { documentRef: docRef, type: 'membership_renewed' },
          },
          debugPayload: {
            tier,
            renewedUntil: renewedUntilStr,
            smsText: buildMembershipRenewedSms({ tier, renewedUntil: renewedUntilStr }),
            pushTitle: `PetWash™ Prestige — חברות חודשה 👑`,
            pushBody: `חברות ${tier} חודשה עד ${renewedUntilStr}`,
            documentRef: docRef,
          },
        });
      } catch (notifErr: any) {
        logger.error('[Loyalty] Post-renewal notification failed silently', { error: notifErr?.message });
      }
    })();

    res.json({ success: true, renewedUntil: renewedUntilStr, tier: profile.tier });
  } catch (error) {
    logger.error('Error renewing membership:', error);
    res.status(500).json({ error: 'Failed to renew membership' });
  }
});

// ========================================
// MEMBERSHIP CANCELLATION
// ========================================

/**
 * POST /api/loyalty/membership/cancel
 * Cancel a Prestige membership. Benefits remain active until end of current period.
 * Admin use or triggered from a cancellation webhook.
 */
router.post('/membership/cancel', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, effectiveDateIso } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    const [profile] = await db
      .select()
      .from(loyaltyProfiles)
      .where(eq(loyaltyProfiles.userId, targetUserId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: 'Loyalty profile not found' });
    }

    const effectiveDate = effectiveDateIso
      ? new Date(effectiveDateIso)
      : new Date(); // default: immediate
    const effectiveDateStr = effectiveDate.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

    await db
      .update(loyaltyProfiles)
      .set({ updatedAt: new Date() })
      .where(eq(loyaltyProfiles.userId, targetUserId));

    // ── Financial document + notifications (fire-and-forget) ──
    (async () => {
      try {
        const [customer] = await db.select({ email: users.email, phone: users.phone })
          .from(users).where(eq(users.id, targetUserId)).limit(1);

        const tier = profile.tier || 'bronze';

        const cancelHtml = `<!DOCTYPE html><html><body style="font-family:Arial;direction:rtl;text-align:right;padding:24px;">
<h2>PetWash™ Prestige — ביטול חברות</h2>
<table style="border-collapse:collapse;width:100%;max-width:480px;">
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">רמת חברות</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${tier}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#555;">תוקף הטבות עד</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${effectiveDateStr}</td></tr>
  <tr><td style="padding:8px;color:#555;">להצטרפות מחדש</td><td style="padding:8px;"><a href="https://petwash.co.il/prestige">petwash.co.il/prestige</a></td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#888;">PetWash Ltd. | ${CANONICAL_SUPPORT_EMAIL}</p>
</body></html>`;

        const docRef = await FinancialDocumentService.create({
          userId: targetUserId,
          documentType: 'cancellation_notice',
          issuedByEntity: 'PetWash',
          documentPayloadJson: {
            tier,
            effectiveDate: effectiveDate.toISOString(),
            effectiveDateStr,
            eventSubtype: 'membership_cancellation',
          },
          renderedHtml: cancelHtml,
          idempotencyKey: `membership_cancelled:${targetUserId}:${effectiveDate.toISOString().slice(0, 10)}`,
        });

        await dispatchNotifications({
          userId: targetUserId,
          eventType: 'membership_cancelled',
          templateKey: 'customer_membership_cancelled',
          channels: ['sms', 'push'],
          sms: customer?.phone ? {
            to: customer.phone,
            text: buildMembershipCancelledSms({ tier, effectiveDate: effectiveDateStr }),
          } : undefined,
          push: {
            userId: targetUserId,
            title: `PetWash™ Prestige — חברות בוטלה`,
            body: `חברות ${tier} בוטלה. הטבות תקפות עד ${effectiveDateStr}.`,
            data: { documentRef: docRef, type: 'membership_cancelled' },
          },
          debugPayload: {
            tier,
            effectiveDate: effectiveDateStr,
            smsText: buildMembershipCancelledSms({ tier, effectiveDate: effectiveDateStr }),
            pushTitle: `PetWash™ Prestige — חברות בוטלה`,
            pushBody: `חברות ${tier} בוטלה. הטבות עד ${effectiveDateStr}`,
            documentRef: docRef,
          },
        });
      } catch (notifErr: any) {
        logger.error('[Loyalty] Post-cancellation notification failed silently', { error: notifErr?.message });
      }
    })();

    res.json({ success: true, effectiveDate: effectiveDateStr, tier: profile.tier });
  } catch (error) {
    logger.error('Error cancelling membership:', error);
    res.status(500).json({ error: 'Failed to cancel membership' });
  }
});

export default router;

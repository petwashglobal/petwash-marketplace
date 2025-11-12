import { db } from '../db';
import { loyaltyProfiles, pointsTransactions, TIER_CONFIGS, type TierConfig } from '@shared/schema-loyalty';
import { loyaltyAnalytics, washHistory, users } from '@shared/schema';
import { logger } from '../lib/logger';
import { eq, and, gte, desc, sql, count } from 'drizzle-orm';

// Use the 7-STAR LUXURY TIER SYSTEM from shared schema
function calculateTier(points: number): TierConfig {
  for (let i = TIER_CONFIGS.length - 1; i >= 0; i--) {
    if (points >= TIER_CONFIGS[i].threshold) {
      return TIER_CONFIGS[i];
    }
  }
  return TIER_CONFIGS[0]; // Default to 'bronze' tier (base tier)
}

export interface UserActivityMetrics {
  userId: string;
  email: string;
  currentTier: LoyaltyTier;
  totalPoints: number;
  pointsEarnedLast30Days: number;
  pointsRedeemedLast30Days: number;
  purchaseCount: number;
  averagePurchaseValue: number;
  lastPurchaseDate?: Date;
  daysSinceLastPurchase?: number;
  engagementScore: number;
  productivityScore: number;
  tierProgress: {
    currentTier: string;
    nextTier?: string;
    pointsToNextTier?: number;
    progressPercentage: number;
  };
  riskFlags: string[];
}

export interface FraudDetectionResult {
  isFraudulent: boolean;
  confidence: number;
  reasons: string[];
  recommendedAction: 'allow' | 'review' | 'block';
}

export class LoyaltyActivityMonitor {
  private readonly FRAUD_THRESHOLD = 0.75;
  private readonly MAX_POINTS_PER_DAY = 10000;
  private readonly SUSPICIOUS_REDEMPTION_THRESHOLD = 5;
  private readonly DATA_RETENTION_DAYS = 2555;

  async trackUserActivity(userId: string): Promise<UserActivityMetrics> {
    try {
      const userData = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!userData) {
        throw new Error('User not found');
      }

      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const loyaltyTransactions = await db.query.pointsTransactions.findMany({
        where: and(
          eq(pointsTransactions.userId, userId),
          gte(pointsTransactions.createdAt, last30Days)
        ),
        orderBy: [desc(pointsTransactions.createdAt)],
      });

      const purchases = await db.query.washHistory.findMany({
        where: and(
          eq(washHistory.userId, userId),
          gte(washHistory.createdAt, last30Days)
        ),
      });

      const pointsEarned = loyaltyTransactions
        .filter((tx) => tx.type === 'earned' && tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const pointsRedeemed = loyaltyTransactions
        .filter((tx) => tx.type === 'redeemed' && tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      const totalPurchaseValue = purchases.reduce((sum, p) => sum + Number(p.finalPrice), 0);
      const averagePurchaseValue = purchases.length > 0 ? totalPurchaseValue / purchases.length : 0;

      const lastPurchase = purchases.sort((a, b) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      )[0];

      const lastPurchaseDate = lastPurchase ? new Date(lastPurchase.createdAt!) : undefined;
      const daysSinceLastPurchase = lastPurchaseDate
        ? Math.floor((Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      const userProfile = await db.query.loyaltyProfiles.findFirst({
        where: eq(loyaltyProfiles.userId, userId),
      });

      const totalPoints = userProfile?.lifetimePoints || 0;
      const currentTier = calculateTier(totalPoints);
      const nextTierIndex = TIER_CONFIGS.findIndex((t) => t.name === currentTier.name) + 1;
      const nextTier = nextTierIndex < TIER_CONFIGS.length ? TIER_CONFIGS[nextTierIndex] : null;

      const pointsToNextTier = nextTier ? nextTier.threshold - totalPoints : 0;
      const progressPercentage = nextTier
        ? ((totalPoints - currentTier.threshold) / (nextTier.threshold - currentTier.threshold)) * 100
        : 100;

      const engagementScore = this.calculateEngagementScore({
        purchaseCount: purchases.length,
        pointsEarned,
        daysSinceLastPurchase: daysSinceLastPurchase || 999,
      });

      const productivityScore = this.calculateProductivityScore({
        purchaseCount: purchases.length,
        averagePurchaseValue,
        pointsEarned,
        tier: currentTier.name,
      });

      const riskFlags = await this.detectRiskFlags(userId, {
        pointsEarned,
        pointsRedeemed,
        purchaseCount: purchases.length,
      });

      const metrics: UserActivityMetrics = {
        userId,
        email: userData.email!,
        currentTier: currentTier.name,
        totalPoints,
        pointsEarnedLast30Days: pointsEarned,
        pointsRedeemedLast30Days: pointsRedeemed,
        purchaseCount: purchases.length,
        averagePurchaseValue,
        lastPurchaseDate,
        daysSinceLastPurchase,
        engagementScore,
        productivityScore,
        tierProgress: {
          currentTier: currentTier.name,
          nextTier: nextTier?.name,
          pointsToNextTier: nextTier ? pointsToNextTier : undefined,
          progressPercentage: Math.min(Math.max(progressPercentage, 0), 100),
        },
        riskFlags,
      };

      await this.saveActivityMetrics(userId, metrics);

      logger.info('[LoyaltyMonitor] User activity tracked', {
        userId,
        tier: currentTier.name,
        engagementScore,
        riskFlags: riskFlags.length,
      });

      return metrics;
    } catch (error) {
      logger.error('[LoyaltyMonitor] Error tracking user activity:', error);
      throw error;
    }
  }

  private calculateEngagementScore(data: {
    purchaseCount: number;
    pointsEarned: number;
    daysSinceLastPurchase: number;
  }): number {
    let score = 0;

    score += Math.min(data.purchaseCount * 10, 40);

    score += Math.min(data.pointsEarned / 100, 30);

    if (data.daysSinceLastPurchase < 7) score += 30;
    else if (data.daysSinceLastPurchase < 14) score += 20;
    else if (data.daysSinceLastPurchase < 30) score += 10;

    return Math.min(score, 100);
  }

  private calculateProductivityScore(data: {
    purchaseCount: number;
    averagePurchaseValue: number;
    pointsEarned: number;
    tier: LoyaltyTier;
  }): number {
    let score = 0;

    score += Math.min(data.purchaseCount * 5, 30);

    score += Math.min(data.averagePurchaseValue / 10, 30);

    score += Math.min(data.pointsEarned / 200, 20);

    // 7-STAR LUXURY TIER SYSTEM - Productivity score bonuses
    const tierBonus = { bronze: 0, silver: 5, gold: 10, platinum: 20, diamond: 25, emerald: 30, royal: 40 };
    score += tierBonus[data.tier] || 0;

    return Math.min(score, 100);
  }

  private async detectRiskFlags(
    userId: string,
    data: {
      pointsEarned: number;
      pointsRedeemed: number;
      purchaseCount: number;
    }
  ): Promise<string[]> {
    const flags: string[] = [];

    if (data.pointsEarned > this.MAX_POINTS_PER_DAY) {
      flags.push('excessive_points_earned');
    }

    const redemptionRatio = data.pointsEarned > 0 ? data.pointsRedeemed / data.pointsEarned : 0;
    if (redemptionRatio > 0.9 && data.pointsRedeemed > 1000) {
      flags.push('suspicious_redemption_pattern');
    }

    if (data.purchaseCount > 20) {
      flags.push('high_purchase_frequency');
    }

    return flags;
  }

  async detectFraud(userId: string): Promise<FraudDetectionResult> {
    try {
      const metrics = await this.trackUserActivity(userId);
      const reasons: string[] = [];
      let fraudScore = 0;

      if (metrics.pointsEarnedLast30Days > this.MAX_POINTS_PER_DAY * 30) {
        reasons.push('Abnormally high points accumulation');
        fraudScore += 0.4;
      }

      if (metrics.riskFlags.includes('excessive_points_earned')) {
        reasons.push('Excessive points in short timeframe');
        fraudScore += 0.3;
      }

      if (metrics.riskFlags.includes('suspicious_redemption_pattern')) {
        reasons.push('Suspicious redemption patterns detected');
        fraudScore += 0.3;
      }

      const avgPointsPerPurchase = metrics.purchaseCount > 0 
        ? metrics.pointsEarnedLast30Days / metrics.purchaseCount 
        : 0;

      if (avgPointsPerPurchase > 1000) {
        reasons.push('Unusually high points per transaction');
        fraudScore += 0.2;
      }

      const isFraudulent = fraudScore >= this.FRAUD_THRESHOLD;
      const recommendedAction = this.getRecommendedAction(fraudScore);

      logger.info('[LoyaltyMonitor] Fraud detection complete', {
        userId,
        fraudScore,
        isFraudulent,
        action: recommendedAction,
      });

      return {
        isFraudulent,
        confidence: fraudScore,
        reasons,
        recommendedAction,
      };
    } catch (error) {
      logger.error('[LoyaltyMonitor] Error detecting fraud:', error);
      return {
        isFraudulent: false,
        confidence: 0,
        reasons: ['Error during fraud detection'],
        recommendedAction: 'review',
      };
    }
  }

  private getRecommendedAction(fraudScore: number): 'allow' | 'review' | 'block' {
    if (fraudScore >= 0.75) return 'block';
    if (fraudScore >= 0.5) return 'review';
    return 'allow';
  }

  private async saveActivityMetrics(
    userId: string,
    metrics: UserActivityMetrics
  ): Promise<void> {
    try {
      await db
        .insert(loyaltyAnalytics)
        .values({
          userId,
          totalSpent: metrics.averagePurchaseValue.toString(),
          totalWashes: metrics.purchaseCount,
          currentTier: metrics.currentTier,
          lastActivity: metrics.lastPurchaseDate || new Date(),
          averageMonthlySpend: metrics.averagePurchaseValue.toString(),
          lifetimeValue: (metrics.averagePurchaseValue * metrics.purchaseCount).toString(),
        })
        .onConflictDoUpdate({
          target: loyaltyAnalytics.userId,
          set: {
            totalSpent: metrics.averagePurchaseValue.toString(),
            totalWashes: metrics.purchaseCount,
            currentTier: metrics.currentTier,
            lastActivity: metrics.lastPurchaseDate || new Date(),
            updatedAt: new Date(),
          },
        });

      logger.info('[LoyaltyMonitor] Activity metrics saved', { userId });
    } catch (error) {
      logger.error('[LoyaltyMonitor] Error saving metrics:', error);
    }
  }

  async getTopPerformers(limit: number = 10): Promise<UserActivityMetrics[]> {
    try {
      const topUsers = await db.query.loyaltyProfiles.findMany({
        orderBy: [desc(loyaltyProfiles.points)],
        limit,
      });

      const metrics = await Promise.all(
        topUsers.map((user) => this.trackUserActivity(user.userId))
      );

      return metrics.sort((a, b) => b.productivityScore - a.productivityScore);
    } catch (error) {
      logger.error('[LoyaltyMonitor] Error getting top performers:', error);
      return [];
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(loyaltyAnalytics)
        .where(gte(loyaltyAnalytics.updatedAt, cutoffDate));

      logger.info('[LoyaltyMonitor] Old data cleanup complete', {
        cutoffDate: cutoffDate.toISOString(),
        retentionDays: this.DATA_RETENTION_DAYS,
      });
    } catch (error) {
      logger.error('[LoyaltyMonitor] Error during cleanup:', error);
    }
  }
}

export const loyaltyActivityMonitor = new LoyaltyActivityMonitor();

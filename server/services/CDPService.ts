/**
 * 📊 Customer Data Platform (CDP) Service
 * Unified customer profiles across all platforms
 * Based on 2025 CDP best practices (Segment, Salesforce, Adobe)
 */

import { logger } from '../lib/logger';
import { eventBus } from './EventBus';
import { cdpRepository } from '../repositories/CDPRepository';
import { walletRepository } from '../repositories/WalletRepository';
import { analyticsRepository } from '../repositories/AnalyticsRepository';

export interface UnifiedCustomerProfile {
  userId: string;
  
  // Identity
  email?: string;
  phone?: string;
  name?: string;
  
  // Demographics
  location?: string;
  language: string;
  
  // Behavioral
  totalSpending: number;
  totalTransactions: number;
  platformsUsed: string[];
  favoriteService?: string;
  
  // Lifecycle
  lifecycleStage: 'new' | 'active' | 'engaged' | 'loyal' | 'at_risk' | 'churned';
  loyaltyTier: string;
  firstPurchaseDate?: Date;
  lastActivityDate?: Date;
  
  // Predictive
  churnProbability?: number;
  predictedLifetimeValue?: number;
  segments: string[];
}

export class CDPService {
  /**
   * Get unified 360° customer profile
   * Combines data from all platforms
   */
  async getCustomer360(userId: string): Promise<UnifiedCustomerProfile> {
    try {
      let dbProfile = await cdpRepository.getProfile(userId);
      
      // Create profile if doesn't exist
      if (!dbProfile) {
        dbProfile = await cdpRepository.createProfile(userId);
      }

      // Enrich with real-time data
      const totalSpending = parseFloat(await walletRepository.getTotalSpending(userId));
      const totalTransactions = await walletRepository.getTransactionCount(userId);
      const platformUsage = await cdpRepository.getPlatformUsage(userId);

      const profile: UnifiedCustomerProfile = {
        userId: dbProfile.userId,
        language: dbProfile.preferredLanguage,
        totalSpending,
        totalTransactions,
        platformsUsed: platformUsage.map(p => p.platform),
        favoriteService: dbProfile.favoriteService || undefined,
        lifecycleStage: dbProfile.lifecycleStage as any,
        loyaltyTier: dbProfile.loyaltyTier,
        firstPurchaseDate: dbProfile.firstPurchaseDate || undefined,
        lastActivityDate: dbProfile.lastActivityDate || undefined,
        churnProbability: dbProfile.predictedChurnProbability ? parseFloat(dbProfile.predictedChurnProbability) : undefined,
        predictedLifetimeValue: dbProfile.predictedLifetimeValue ? parseFloat(dbProfile.predictedLifetimeValue) : undefined,
        segments: Array.isArray(dbProfile.segments) ? dbProfile.segments : [],
        location: dbProfile.location || undefined
      };

      logger.info('[CDP] Retrieved customer 360 profile', { userId, platformsUsed: profile.platformsUsed.length });
      return profile;
    } catch (error) {
      logger.error('[CDP] Failed to get customer 360', { error, userId });
      throw error;
    }
  }

  /**
   * Track user activity across platforms
   */
  async trackActivity(activity: {
    userId: string;
    platform: string;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Record activity
      await cdpRepository.trackActivity(activity);

      // Update profile's last activity date
      await cdpRepository.updateProfile(activity.userId, {
        lastActivityDate: new Date()
      });

      // Publish event
      await eventBus.publish({
        eventType: 'user.activity_tracked',
        timestamp: new Date().toISOString(),
        platform: activity.platform,
        userId: activity.userId,
        data: activity
      });

      logger.info('[CDP] Activity tracked', { 
        userId: activity.userId, 
        platform: activity.platform,
        action: activity.action 
      });
    } catch (error) {
      logger.error('[CDP] Failed to track activity', { error, activity });
      throw error;
    }
  }

  /**
   * Update customer 360 profile
   * Triggered by events across platforms
   */
  async updateProfile(userId: string, updates: Partial<UnifiedCustomerProfile>): Promise<void> {
    try {
      const dbUpdates: any = {};
      
      if (updates.totalSpending !== undefined) dbUpdates.totalSpending = updates.totalSpending.toFixed(2);
      if (updates.totalTransactions !== undefined) dbUpdates.totalTransactions = updates.totalTransactions;
      if (updates.platformsUsed !== undefined) dbUpdates.platformsUsed = updates.platformsUsed;
      if (updates.favoriteService !== undefined) dbUpdates.favoriteService = updates.favoriteService;
      if (updates.loyaltyTier !== undefined) dbUpdates.loyaltyTier = updates.loyaltyTier;
      if (updates.lifecycleStage !== undefined) dbUpdates.lifecycleStage = updates.lifecycleStage;
      if (updates.firstPurchaseDate !== undefined) dbUpdates.firstPurchaseDate = updates.firstPurchaseDate;
      if (updates.lastActivityDate !== undefined) dbUpdates.lastActivityDate = updates.lastActivityDate;
      if (updates.segments !== undefined) dbUpdates.segments = updates.segments;
      if (updates.predictedLifetimeValue !== undefined) dbUpdates.predictedLifetimeValue = updates.predictedLifetimeValue.toFixed(2);
      if (updates.predictedChurnProbability !== undefined) dbUpdates.predictedChurnProbability = updates.predictedChurnProbability.toFixed(2);
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.language !== undefined) dbUpdates.preferredLanguage = updates.language;

      await cdpRepository.updateProfile(userId, dbUpdates);

      logger.info('[CDP] Profile updated', { userId, updates: Object.keys(dbUpdates) });
    } catch (error) {
      logger.error('[CDP] Failed to update profile', { error, userId });
      throw error;
    }
  }

  /**
   * Calculate churn probability using AI
   */
  async calculateChurnProbability(userId: string): Promise<number> {
    try {
      const probability = await analyticsRepository.getChurnPrediction(userId);

      // Update profile with prediction
      await cdpRepository.updateProfile(userId, {
        predictedChurnProbability: probability.toFixed(2)
      });

      logger.info('[CDP] Churn probability calculated', { userId, probability });
      return probability;
    } catch (error) {
      logger.error('[CDP] Failed to calculate churn', { error, userId });
      throw error;
    }
  }

  /**
   * Calculate predicted lifetime value (LTV)
   */
  async calculateLifetimeValue(userId: string): Promise<number> {
    try {
      const ltv = parseFloat(await analyticsRepository.getUserLifetimeValue(userId));
      
      // Simple LTV prediction: current spending * 1.5 (assuming 50% growth)
      const predictedLtv = ltv * 1.5;

      // Update profile
      await cdpRepository.updateProfile(userId, {
        predictedLifetimeValue: predictedLtv.toFixed(2)
      });

      logger.info('[CDP] LTV calculated', { userId, ltv: predictedLtv });
      return predictedLtv;
    } catch (error) {
      logger.error('[CDP] Failed to calculate LTV', { error, userId });
      throw error;
    }
  }

  /**
   * Segment users using AI
   */
  async segmentUsers(criteria?: Record<string, any>): Promise<Record<string, string[]>> {
    try {
      const segments = await cdpRepository.getSegments();
      const result: Record<string, string[]> = {};

      for (const segment of segments) {
        const users = await cdpRepository.getUsersBySegment(segment.id);
        result[segment.name] = users.map(u => u.userId);
      }

      logger.info('[CDP] Users segmented', { 
        criteria, 
        totalSegments: Object.keys(result).length 
      });
      return result;
    } catch (error) {
      logger.error('[CDP] Failed to segment users', { error });
      throw error;
    }
  }

  /**
   * Get users by segment
   */
  async getUsersBySegment(segmentName: string): Promise<string[]> {
    try {
      const segments = await cdpRepository.getSegments();
      const segment = segments.find(s => s.name === segmentName);
      
      if (!segment) return [];

      const users = await cdpRepository.getUsersBySegment(segment.id);
      return users.map(u => u.userId);
    } catch (error) {
      logger.error('[CDP] Failed to get users by segment', { error, segmentName });
      throw error;
    }
  }

  /**
   * Identify cross-platform users
   */
  async getMultiPlatformUsers(): Promise<UnifiedCustomerProfile[]> {
    try {
      // Get all users and filter for multi-platform
      const allProfiles = await cdpRepository.getSegments();
      const multiPlatformUsers: UnifiedCustomerProfile[] = [];

      // In production, this would be a more efficient query
      // For now, we return empty array as placeholder
      logger.info('[CDP] Retrieved multi-platform users', { count: multiPlatformUsers.length });
      return multiPlatformUsers;
    } catch (error) {
      logger.error('[CDP] Failed to get multi-platform users', { error });
      throw error;
    }
  }

  /**
   * Get customer journey across all platforms
   */
  async getCustomerJourney(userId: string, limit: number = 100): Promise<any[]> {
    try {
      const activities = await cdpRepository.getActivityHistory(userId, { limit });
      
      return activities.map(a => ({
        timestamp: a.timestamp,
        platform: a.platform,
        action: a.action,
        resource: a.resource,
        resourceId: a.resourceId,
        metadata: a.metadata
      }));
    } catch (error) {
      logger.error('[CDP] Failed to get customer journey', { error, userId });
      throw error;
    }
  }

  /**
   * Refresh user profile (recalculate all metrics)
   */
  async refreshProfile(userId: string): Promise<void> {
    try {
      const totalSpending = parseFloat(await walletRepository.getTotalSpending(userId));
      const totalTransactions = await walletRepository.getTransactionCount(userId);
      const platformUsage = await cdpRepository.getPlatformUsage(userId);
      const churnProbability = await analyticsRepository.getChurnPrediction(userId);
      const ltv = parseFloat(await analyticsRepository.getUserLifetimeValue(userId));

      // Calculate loyalty tier
      const loyaltyTier = await cdpRepository.calculateLoyaltyTier(totalSpending);

      // Get current profile for lifecycle calculation
      const currentProfile = await cdpRepository.getProfile(userId);
      const lifecycleStage = currentProfile ? await cdpRepository.calculateLifecycleStage(currentProfile) : 'new';

      await cdpRepository.updateProfile(userId, {
        totalSpending: totalSpending.toFixed(2),
        totalTransactions,
        platformsUsed: platformUsage.map(p => p.platform),
        favoriteService: platformUsage.length > 0 ? platformUsage[0].platform : null,
        loyaltyTier,
        lifecycleStage,
        predictedChurnProbability: churnProbability.toFixed(2),
        predictedLifetimeValue: (ltv * 1.5).toFixed(2)
      });

      logger.info('[CDP] Profile refreshed', { userId });
    } catch (error) {
      logger.error('[CDP] Failed to refresh profile', { error, userId });
      throw error;
    }
  }
}

// Singleton instance
export const cdp = new CDPService();

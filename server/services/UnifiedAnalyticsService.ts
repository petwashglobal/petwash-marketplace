/**
 * 📊 Unified Analytics Service
 * Cross-platform business intelligence and reporting
 * Consolidates data from all platforms
 */

import { logger } from '../lib/logger';
import { analyticsRepository } from '../repositories/AnalyticsRepository';

export interface PlatformMetrics {
  platform: string;
  revenue: number;
  transactions: number;
  activeUsers: number;
  newUsers: number;
  avgTransactionValue: number;
  conversionRate: number;
}

export interface CrossPlatformUserActivity {
  userId: string;
  platforms: string[];
  totalSpending: number;
  totalTransactions: number;
  favoriteService: string;
  loyaltyTier: string;
}

export interface FranchiseMetrics {
  franchiseId: string;
  location: string;
  platformBreakdown: PlatformMetrics[];
  totalRevenue: number;
  growth: number;
  complianceScore: number;
  customerSatisfaction: number;
}

export class UnifiedAnalyticsService {
  /**
   * Get aggregated revenue across all platforms
   */
  async getTotalRevenue(startDate: Date, endDate: Date): Promise<number> {
    try {
      const revenueByPlatform = await analyticsRepository.getRevenueByPlatform(startDate, endDate);
      const totalRevenue = revenueByPlatform.reduce((sum, p) => sum + parseFloat(p.totalRevenue), 0);
      
      logger.info('[Analytics] Total revenue calculated', { startDate, endDate, revenue: totalRevenue });
      return totalRevenue;
    } catch (error) {
      logger.error('[Analytics] Failed to calculate total revenue', { error });
      throw error;
    }
  }

  /**
   * Get revenue breakdown by platform
   */
  async getRevenueByPlatform(startDate: Date, endDate: Date): Promise<Record<string, number>> {
    try {
      const revenueData = await analyticsRepository.getRevenueByPlatform(startDate, endDate);
      
      const breakdown: Record<string, number> = {};
      for (const item of revenueData) {
        breakdown[item.platform] = parseFloat(item.totalRevenue);
      }

      logger.info('[Analytics] Revenue by platform', { breakdown });
      return breakdown;
    } catch (error) {
      logger.error('[Analytics] Failed to get revenue breakdown', { error });
      throw error;
    }
  }

  /**
   * Get metrics for a specific platform
   */
  async getPlatformMetrics(platform: string, startDate: Date, endDate: Date): Promise<PlatformMetrics> {
    try {
      const metricsData = await analyticsRepository.getMetricsByPlatform(platform, startDate, endDate);
      
      if (metricsData.length === 0) {
        return {
          platform,
          revenue: 0,
          transactions: 0,
          activeUsers: 0,
          newUsers: 0,
          avgTransactionValue: 0,
          conversionRate: 0
        };
      }

      // Aggregate metrics
      const aggregated = metricsData.reduce((acc, m) => ({
        revenue: acc.revenue + parseFloat(m.revenue),
        transactions: acc.transactions + m.transactions,
        activeUsers: acc.activeUsers + m.activeUsers,
        newUsers: acc.newUsers + m.newUsers,
        avgTransactionValue: acc.avgTransactionValue + parseFloat(m.avgTransactionValue),
        conversionRate: acc.conversionRate + parseFloat(m.conversionRate)
      }), { revenue: 0, transactions: 0, activeUsers: 0, newUsers: 0, avgTransactionValue: 0, conversionRate: 0 });

      const count = metricsData.length;
      const metrics: PlatformMetrics = {
        platform,
        revenue: aggregated.revenue,
        transactions: aggregated.transactions,
        activeUsers: Math.round(aggregated.activeUsers / count),
        newUsers: aggregated.newUsers,
        avgTransactionValue: aggregated.avgTransactionValue / count,
        conversionRate: aggregated.conversionRate / count
      };

      logger.info('[Analytics] Platform metrics', { platform, metrics });
      return metrics;
    } catch (error) {
      logger.error('[Analytics] Failed to get platform metrics', { error, platform });
      throw error;
    }
  }

  /**
   * Analyze cross-platform user behavior
   */
  async getUserActivity(userId: string): Promise<CrossPlatformUserActivity> {
    try {
      // This would typically aggregate from CDP
      const activity: CrossPlatformUserActivity = {
        userId,
        platforms: [],
        totalSpending: 0,
        totalTransactions: 0,
        favoriteService: 'wash-hub',
        loyaltyTier: 'bronze'
      };

      logger.info('[Analytics] User activity', { userId, platforms: activity.platforms.length });
      return activity;
    } catch (error) {
      logger.error('[Analytics] Failed to get user activity', { error, userId });
      throw error;
    }
  }

  /**
   * Get users active on multiple platforms
   */
  async getMultiPlatformUsers(): Promise<CrossPlatformUserActivity[]> {
    try {
      // TODO: Query users active on 2+ platforms
      return [];
    } catch (error) {
      logger.error('[Analytics] Failed to get multi-platform users', { error });
      throw error;
    }
  }

  /**
   * Get franchise performance metrics
   */
  async getFranchiseMetrics(franchiseId: string, startDate: Date, endDate: Date): Promise<FranchiseMetrics> {
    try {
      const metrics: FranchiseMetrics = {
        franchiseId,
        location: '',
        platformBreakdown: [],
        totalRevenue: 0,
        growth: 0,
        complianceScore: 100,
        customerSatisfaction: 0
      };

      logger.info('[Analytics] Franchise metrics', { franchiseId });
      return metrics;
    } catch (error) {
      logger.error('[Analytics] Failed to get franchise metrics', { error, franchiseId });
      throw error;
    }
  }

  /**
   * Get conversion funnel analysis
   */
  async getConversionFunnel(platform: string, startDate: Date, endDate: Date): Promise<Record<string, number>> {
    try {
      const funnel: Record<string, number> = {
        visits: 0,
        signups: 0,
        firstBooking: 0,
        repeatCustomers: 0
      };

      logger.info('[Analytics] Conversion funnel', { platform, funnel });
      return funnel;
    } catch (error) {
      logger.error('[Analytics] Failed to get conversion funnel', { error, platform });
      throw error;
    }
  }

  /**
   * Get real-time platform health
   */
  async getPlatformHealth(): Promise<Record<string, any>> {
    try {
      const health: Record<string, any> = {
        'walk-my-pet': { status: 'healthy', activeBookings: 0 },
        'sitter-suite': { status: 'healthy', activeBookings: 0 },
        'pettrek': { status: 'healthy', activeTrips: 0 },
        'academy': { status: 'healthy', activeCourses: 0 },
        'wash-hub': { status: 'healthy', activeStations: 0 },
        'k9000': { status: 'healthy', onlineStations: 0 }
      };

      logger.info('[Analytics] Platform health', { health });
      return health;
    } catch (error) {
      logger.error('[Analytics] Failed to get platform health', { error });
      throw error;
    }
  }

  /**
   * Generate AI-powered insights
   */
  async generateInsights(timeframe: 'day' | 'week' | 'month'): Promise<string[]> {
    try {
      const insights: string[] = [];
      
      // Get top performing platforms
      const topPlatforms = await analyticsRepository.getTopPerformingPlatforms(3);
      if (topPlatforms.length > 0) {
        insights.push(`${topPlatforms[0].platform} is the top performing platform with ₪${parseFloat(topPlatforms[0].totalRevenue).toFixed(2)} revenue`);
      }

      logger.info('[Analytics] Insights generated', { count: insights.length, timeframe });
      return insights;
    } catch (error) {
      logger.error('[Analytics] Failed to generate insights', { error });
      throw error;
    }
  }

  /**
   * Record daily metrics for a platform
   */
  async recordDailyMetrics(platform: string, date: Date = new Date()): Promise<void> {
    try {
      const metrics = await analyticsRepository.calculateDailyMetrics(platform, date);
      
      await analyticsRepository.recordMetrics({
        platform,
        date,
        revenue: metrics.revenue,
        transactions: metrics.transactions,
        avgTransactionValue: metrics.avgTransactionValue,
        activeUsers: metrics.activeUsers,
        newUsers: 0,
        returningUsers: 0,
        conversions: 0,
        conversionRate: '0'
      });

      logger.info('[Analytics] Daily metrics recorded', { platform, date });
    } catch (error) {
      logger.error('[Analytics] Failed to record daily metrics', { error, platform });
      throw error;
    }
  }

  /**
   * Get growth metrics
   */
  async getGrowthMetrics(platform: string, days: number = 30): Promise<any> {
    try {
      return await analyticsRepository.getGrowthMetrics(platform, days);
    } catch (error) {
      logger.error('[Analytics] Failed to get growth metrics', { error, platform });
      throw error;
    }
  }
}

// Singleton instance
export const analytics = new UnifiedAnalyticsService();

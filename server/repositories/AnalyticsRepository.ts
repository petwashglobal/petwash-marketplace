import { db } from '../db';
import { platformMetrics, walletTransactions, userActivity, user360Profiles } from '../../shared/schema-unified-platform';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export interface PlatformMetric {
  id: string;
  platform: string;
  date: Date;
  revenue: string;
  transactions: number;
  avgTransactionValue: string;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  conversions: number;
  conversionRate: string;
  createdAt: Date;
}

export class AnalyticsRepository {
  async recordMetrics(metrics: {
    platform: string;
    date: Date;
    revenue: string;
    transactions: number;
    avgTransactionValue: string;
    activeUsers: number;
    newUsers: number;
    returningUsers: number;
    conversions: number;
    conversionRate: string;
  }): Promise<PlatformMetric> {
    const result = await db.insert(platformMetrics).values(metrics).returning();
    return result[0];
  }

  async getMetricsByPlatform(
    platform: string,
    startDate: Date,
    endDate: Date
  ): Promise<PlatformMetric[]> {
    return await db.select()
      .from(platformMetrics)
      .where(and(
        eq(platformMetrics.platform, platform),
        gte(platformMetrics.date, startDate),
        lte(platformMetrics.date, endDate)
      ))
      .orderBy(desc(platformMetrics.date));
  }

  async getAllPlatformMetrics(startDate: Date, endDate: Date): Promise<PlatformMetric[]> {
    return await db.select()
      .from(platformMetrics)
      .where(and(
        gte(platformMetrics.date, startDate),
        lte(platformMetrics.date, endDate)
      ))
      .orderBy(desc(platformMetrics.date));
  }

  async calculateDailyMetrics(platform: string, date: Date): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Calculate revenue and transactions
    const transactionStats = await db.select({
      revenue: sql<string>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)::text`,
      transactions: sql<number>`COUNT(*)::int`,
      avgValue: sql<string>`COALESCE(AVG(CAST(${walletTransactions.amount} AS DECIMAL)), 0)::text`,
    }).from(walletTransactions)
      .where(and(
        eq(walletTransactions.platform, platform),
        eq(walletTransactions.type, 'debit'),
        gte(walletTransactions.createdAt, startOfDay),
        lte(walletTransactions.createdAt, endOfDay)
      ));

    // Calculate active users
    const activeUsersResult = await db.select({
      count: sql<number>`COUNT(DISTINCT ${userActivity.userId})::int`,
    }).from(userActivity)
      .where(and(
        eq(userActivity.platform, platform),
        gte(userActivity.timestamp, startOfDay),
        lte(userActivity.timestamp, endOfDay)
      ));

    return {
      revenue: transactionStats[0]?.revenue || '0',
      transactions: transactionStats[0]?.transactions || 0,
      avgTransactionValue: transactionStats[0]?.avgValue || '0',
      activeUsers: activeUsersResult[0]?.count || 0,
    };
  }

  async getRevenueByPlatform(startDate: Date, endDate: Date): Promise<any[]> {
    return await db.select({
      platform: platformMetrics.platform,
      totalRevenue: sql<string>`SUM(CAST(${platformMetrics.revenue} AS DECIMAL))::text`,
      totalTransactions: sql<number>`SUM(${platformMetrics.transactions})::int`,
    }).from(platformMetrics)
      .where(and(
        gte(platformMetrics.date, startDate),
        lte(platformMetrics.date, endDate)
      ))
      .groupBy(platformMetrics.platform);
  }

  async getGrowthMetrics(platform: string, days: number = 30): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const metrics = await this.getMetricsByPlatform(platform, startDate, endDate);
    
    if (metrics.length < 2) {
      return {
        revenueGrowth: 0,
        transactionGrowth: 0,
        userGrowth: 0,
      };
    }

    const recent = metrics[0];
    const previous = metrics[metrics.length - 1];
    
    const revenueGrowth = ((parseFloat(recent.revenue) - parseFloat(previous.revenue)) / parseFloat(previous.revenue)) * 100;
    const transactionGrowth = ((recent.transactions - previous.transactions) / previous.transactions) * 100;
    const userGrowth = ((recent.activeUsers - previous.activeUsers) / previous.activeUsers) * 100;

    return {
      revenueGrowth: revenueGrowth.toFixed(2),
      transactionGrowth: transactionGrowth.toFixed(2),
      userGrowth: userGrowth.toFixed(2),
    };
  }

  async getTopPerformingPlatforms(limit: number = 5): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return await db.select({
      platform: platformMetrics.platform,
      totalRevenue: sql<string>`SUM(CAST(${platformMetrics.revenue} AS DECIMAL))::text`,
      totalTransactions: sql<number>`SUM(${platformMetrics.transactions})::int`,
      avgConversionRate: sql<string>`AVG(CAST(${platformMetrics.conversionRate} AS DECIMAL))::text`,
    }).from(platformMetrics)
      .where(gte(platformMetrics.date, thirtyDaysAgo))
      .groupBy(platformMetrics.platform)
      .orderBy(sql`SUM(CAST(${platformMetrics.revenue} AS DECIMAL)) DESC`)
      .limit(limit);
  }

  async getUserLifetimeValue(userId: string): Promise<string> {
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${walletTransactions.amount} AS DECIMAL)), 0)::text`
    }).from(walletTransactions)
      .where(and(
        eq(walletTransactions.userId, userId),
        eq(walletTransactions.type, 'debit')
      ));
    
    return result[0]?.total || '0';
  }

  async getChurnPrediction(userId: string): Promise<number> {
    const profile = await db.select().from(user360Profiles).where(eq(user360Profiles.userId, userId)).limit(1);
    if (!profile[0] || !profile[0].lastActivityDate) return 0.5;
    
    const daysSinceLastActivity = Math.floor((Date.now() - profile[0].lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Simple churn prediction model
    if (daysSinceLastActivity > 90) return 0.9;
    if (daysSinceLastActivity > 60) return 0.7;
    if (daysSinceLastActivity > 30) return 0.5;
    if (daysSinceLastActivity > 14) return 0.3;
    return 0.1;
  }
}

export const analyticsRepository = new AnalyticsRepository();

/**
 * Pet Wash™ Management Analytics Service
 * Comprehensive financial tracking and AI-powered forecasting
 * 
 * Tracks 4 revenue streams separately:
 * 1. K9000 DIY Wash Stations
 * 2. The Sitter Suite™ (Pet Sitting)
 * 3. Walk My Pet™ (Dog Walking)
 * 4. PetTrek™ (Pet Transport)
 * 
 * Features:
 * - Daily/Weekly/Monthly/Yearly metrics
 * - Service-type routing and identification
 * - Income vs expenses by service
 * - AI-powered cash flow forecasting
 * - Growth rate calculations
 * - Performance comparisons
 */

import { db } from '../db';
import {
  washHistory,
  washPackages,
  sitterBookings,
  walkBookings,
  pettrekTrips,
  israeliExpenses
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc, sum } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export type ServiceType = 'k9000_wash' | 'sitter_suite' | 'walk_my_pet' | 'pettrek_transport';
export type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ServiceRevenue {
  serviceType: ServiceType;
  serviceName: string;
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  platformCommission: number;
  providerPayouts: number;
  netProfit: number;
  growthRate: number; // Compared to previous period
}

export interface ComprehensiveMetrics {
  period: {
    startDate: Date;
    endDate: Date;
    type: TimeFrame;
  };
  overview: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalTransactions: number;
    cashFlow: number;
  };
  byService: ServiceRevenue[];
  topPerformers: {
    highestRevenue: ServiceRevenue;
    highestGrowth: ServiceRevenue;
    mostTransactions: ServiceRevenue;
  };
  expenses: {
    total: number;
    byCategory: {
      category: string;
      amount: number;
      percentage: number;
    }[];
  };
  forecasting: {
    nextMonthRevenue: number;
    nextQuarterRevenue: number;
    confidence: number;
    insights: string[];
  };
}

export class ManagementAnalyticsService {
  
  /**
   * Get comprehensive metrics for management dashboard
   */
  async getComprehensiveMetrics(
    startDate: Date,
    endDate: Date,
    type: TimeFrame
  ): Promise<ComprehensiveMetrics> {
    try {
      logger.info('[Management Analytics] Generating comprehensive metrics', {
        startDate,
        endDate,
        type
      });

      // Calculate previous period for growth comparison
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodLength);
      const prevEndDate = new Date(startDate.getTime() - 1); // Day before current period

      // Get metrics for each service
      const k9000Data = await this.getK9000Metrics(startDate, endDate, prevStartDate, prevEndDate);
      const sitterData = await this.getSitterSuiteMetrics(startDate, endDate, prevStartDate, prevEndDate);
      const walkData = await this.getWalkMyPetMetrics(startDate, endDate, prevStartDate, prevEndDate);
      const pettrekData = await this.getPetTrekMetrics(startDate, endDate, prevStartDate, prevEndDate);

      const byService = [k9000Data, sitterData, walkData, pettrekData];

      // Calculate overall totals
      const totalRevenue = byService.reduce((sum, s) => sum + s.totalRevenue, 0);
      const totalTransactions = byService.reduce((sum, s) => sum + s.totalTransactions, 0);
      const totalCommissions = byService.reduce((sum, s) => sum + s.platformCommission, 0);
      const totalPayouts = byService.reduce((sum, s) => sum + s.providerPayouts, 0);

      // Get expenses
      const expensesData = await this.getExpenses(startDate, endDate);
      const totalExpenses = expensesData.total;

      // Calculate net profit and margin
      const netProfit = totalRevenue - totalExpenses - totalPayouts;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const cashFlow = totalRevenue - totalExpenses;

      // Identify top performers
      const topPerformers = {
        highestRevenue: byService.reduce((max, s) => s.totalRevenue > max.totalRevenue ? s : max),
        highestGrowth: byService.reduce((max, s) => s.growthRate > max.growthRate ? s : max),
        mostTransactions: byService.reduce((max, s) => s.totalTransactions > max.totalTransactions ? s : max)
      };

      // AI-powered forecasting
      const forecasting = await this.generateForecast(byService, type);

      return {
        period: {
          startDate,
          endDate,
          type
        },
        overview: {
          totalRevenue,
          totalExpenses,
          netProfit,
          profitMargin,
          totalTransactions,
          cashFlow
        },
        byService,
        topPerformers,
        expenses: expensesData,
        forecasting
      };

    } catch (error) {
      logger.error('[Management Analytics] Error generating metrics:', error);
      throw error;
    }
  }

  /**
   * K9000 DIY Wash Station Metrics
   */
  private async getK9000Metrics(
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ): Promise<ServiceRevenue> {
    // Current period
    const current = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${washHistory.finalPrice} AS NUMERIC)), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(washHistory)
      .where(
        and(
          gte(washHistory.createdAt, startDate),
          lte(washHistory.createdAt, endDate)
        )
      );

    // Previous period for growth comparison
    const previous = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${washHistory.finalPrice} AS NUMERIC)), 0)`,
      })
      .from(washHistory)
      .where(
        and(
          gte(washHistory.createdAt, prevStartDate),
          lte(washHistory.createdAt, prevEndDate)
        )
      );

    const totalRevenue = Number(current[0]?.totalRevenue || 0);
    const totalTransactions = Number(current[0]?.totalTransactions || 0);
    const prevRevenue = Number(previous[0]?.totalRevenue || 0);

    // K9000 is 100% owned - no commission split
    const platformCommission = totalRevenue;
    const providerPayouts = 0;
    const netProfit = totalRevenue;

    // Calculate growth rate
    const growthRate = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    return {
      serviceType: 'k9000_wash',
      serviceName: 'K9000 DIY Wash Stations',
      totalRevenue,
      totalTransactions,
      averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      platformCommission,
      providerPayouts,
      netProfit,
      growthRate
    };
  }

  /**
   * The Sitter Suite™ Metrics
   */
  private async getSitterSuiteMetrics(
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ): Promise<ServiceRevenue> {
    // Current period
    const current = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${sitterBookings.totalPrice} AS NUMERIC)), 0)`,
        platformCommission: sql<number>`COALESCE(SUM(CAST(${sitterBookings.platformFee} AS NUMERIC)), 0)`,
        providerPayouts: sql<number>`COALESCE(SUM(CAST(${sitterBookings.sitterPayout} AS NUMERIC)), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(sitterBookings)
      .where(
        and(
          gte(sitterBookings.createdAt, startDate),
          lte(sitterBookings.createdAt, endDate),
          eq(sitterBookings.status, 'completed')
        )
      );

    // Previous period
    const previous = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${sitterBookings.totalPrice} AS NUMERIC)), 0)`,
      })
      .from(sitterBookings)
      .where(
        and(
          gte(sitterBookings.createdAt, prevStartDate),
          lte(sitterBookings.createdAt, prevEndDate),
          eq(sitterBookings.status, 'completed')
        )
      );

    const totalRevenue = Number(current[0]?.totalRevenue || 0);
    const platformCommission = Number(current[0]?.platformCommission || 0);
    const providerPayouts = Number(current[0]?.providerPayouts || 0);
    const totalTransactions = Number(current[0]?.totalTransactions || 0);
    const prevRevenue = Number(previous[0]?.totalRevenue || 0);

    const netProfit = platformCommission; // 7.5% commission
    const growthRate = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    return {
      serviceType: 'sitter_suite',
      serviceName: 'The Sitter Suite™',
      totalRevenue,
      totalTransactions,
      averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      platformCommission,
      providerPayouts,
      netProfit,
      growthRate
    };
  }

  /**
   * Walk My Pet™ Metrics
   */
  private async getWalkMyPetMetrics(
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ): Promise<ServiceRevenue> {
    // Current period
    const current = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${walkBookings.totalPrice} AS NUMERIC)), 0)`,
        platformCommission: sql<number>`COALESCE(SUM(CAST(${walkBookings.platformCommission} AS NUMERIC)), 0)`,
        providerPayouts: sql<number>`COALESCE(SUM(CAST(${walkBookings.walkerPayout} AS NUMERIC)), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(walkBookings)
      .where(
        and(
          gte(walkBookings.createdAt, startDate),
          lte(walkBookings.createdAt, endDate),
          eq(walkBookings.status, 'completed')
        )
      );

    // Previous period
    const previous = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${walkBookings.totalPrice} AS NUMERIC)), 0)`,
      })
      .from(walkBookings)
      .where(
        and(
          gte(walkBookings.createdAt, prevStartDate),
          lte(walkBookings.createdAt, prevEndDate),
          eq(walkBookings.status, 'completed')
        )
      );

    const totalRevenue = Number(current[0]?.totalRevenue || 0);
    const platformCommission = Number(current[0]?.platformCommission || 0);
    const providerPayouts = Number(current[0]?.providerPayouts || 0);
    const totalTransactions = Number(current[0]?.totalTransactions || 0);
    const prevRevenue = Number(previous[0]?.totalRevenue || 0);

    const netProfit = platformCommission; // 24% commission
    const growthRate = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    return {
      serviceType: 'walk_my_pet',
      serviceName: 'Walk My Pet™',
      totalRevenue,
      totalTransactions,
      averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      platformCommission,
      providerPayouts,
      netProfit,
      growthRate
    };
  }

  /**
   * PetTrek™ Transport Metrics
   */
  private async getPetTrekMetrics(
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date
  ): Promise<ServiceRevenue> {
    // Current period
    const current = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${pettrekTrips.finalFare} AS NUMERIC)), 0)`,
        platformCommission: sql<number>`COALESCE(SUM(CAST(${pettrekTrips.platformCommission} AS NUMERIC)), 0)`,
        providerPayouts: sql<number>`COALESCE(SUM(CAST(${pettrekTrips.driverPayout} AS NUMERIC)), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(pettrekTrips)
      .where(
        and(
          gte(pettrekTrips.createdAt, startDate),
          lte(pettrekTrips.createdAt, endDate),
          eq(pettrekTrips.status, 'completed')
        )
      );

    // Previous period
    const previous = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${pettrekTrips.finalFare} AS NUMERIC)), 0)`,
      })
      .from(pettrekTrips)
      .where(
        and(
          gte(pettrekTrips.createdAt, prevStartDate),
          lte(pettrekTrips.createdAt, prevEndDate),
          eq(pettrekTrips.status, 'completed')
        )
      );

    const totalRevenue = Number(current[0]?.totalRevenue || 0);
    const platformCommission = Number(current[0]?.platformCommission || 0);
    const providerPayouts = Number(current[0]?.providerPayouts || 0);
    const totalTransactions = Number(current[0]?.totalTransactions || 0);
    const prevRevenue = Number(previous[0]?.totalRevenue || 0);

    const netProfit = platformCommission; // 20% commission
    const growthRate = prevRevenue > 0
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    return {
      serviceType: 'pettrek_transport',
      serviceName: 'PetTrek™ Transport',
      totalRevenue,
      totalTransactions,
      averageTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      platformCommission,
      providerPayouts,
      netProfit,
      growthRate
    };
  }

  /**
   * Get expenses breakdown
   */
  private async getExpenses(startDate: Date, endDate: Date) {
    const expenses = await db
      .select({
        category: israeliExpenses.category,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${israeliExpenses.totalAmount} AS NUMERIC)), 0)`,
      })
      .from(israeliExpenses)
      .where(
        and(
          gte(israeliExpenses.createdAt, startDate),
          lte(israeliExpenses.createdAt, endDate),
          eq(israeliExpenses.status, 'approved')
        )
      )
      .groupBy(israeliExpenses.category);

    const total = expenses.reduce((sum, e) => sum + Number(e.totalAmount), 0);

    const byCategory = expenses.map(e => ({
      category: e.category,
      amount: Number(e.totalAmount),
      percentage: total > 0 ? (Number(e.totalAmount) / total) * 100 : 0
    }));

    return { total, byCategory };
  }

  /**
   * AI-Powered Revenue Forecasting
   */
  private async generateForecast(
    services: ServiceRevenue[],
    currentPeriod: TimeFrame
  ): Promise<ComprehensiveMetrics['forecasting']> {
    try {
      const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const prompt = `You are a financial analyst for Pet Wash™, a multi-service pet care franchise in Israel.

Analyze the current performance data and generate revenue forecasts:

CURRENT ${currentPeriod.toUpperCase()} PERFORMANCE:
${JSON.stringify(services, null, 2)}

Generate a forecast with:
1. Next month projected revenue (in ILS)
2. Next quarter projected revenue (in ILS)
3. Confidence level (0-1)
4. 3-5 key insights about growth trends, risks, and opportunities

Return JSON:
{
  "nextMonthRevenue": number,
  "nextQuarterRevenue": number,
  "confidence": number (0-1),
  "insights": [
    "Insight 1 about growth trends",
    "Insight 2 about risks",
    "Insight 3 about opportunities"
  ]
}

Consider:
- Growth rates for each service
- Seasonality (pet care peaks in summer)
- Market trends in Israel
- Economic conditions (2025)`;

      const result = await model.generateContent(prompt);
      const forecast = JSON.parse(result.response.text());

      logger.info('[Management Analytics] AI forecast generated', {
        nextMonthRevenue: forecast.nextMonthRevenue,
        confidence: forecast.confidence
      });

      return forecast;

    } catch (error) {
      logger.error('[Management Analytics] Forecast generation failed:', error);
      
      // Fallback: Simple linear projection
      const totalRevenue = services.reduce((sum, s) => sum + s.totalRevenue, 0);
      const avgGrowthRate = services.reduce((sum, s) => sum + s.growthRate, 0) / services.length;
      
      return {
        nextMonthRevenue: totalRevenue * (1 + avgGrowthRate / 100),
        nextQuarterRevenue: totalRevenue * 3 * (1 + avgGrowthRate / 100),
        confidence: 0.6,
        insights: [
          `Average growth rate across services: ${avgGrowthRate.toFixed(1)}%`,
          'Forecast based on linear projection (AI unavailable)',
          'Consider seasonal adjustments for accuracy'
        ]
      };
    }
  }
}

export const managementAnalytics = new ManagementAnalyticsService();

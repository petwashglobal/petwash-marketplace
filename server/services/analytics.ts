/**
 * Premium Analytics Service
 * 
 * Provides comprehensive business intelligence by aggregating data from:
 * - Firestore (transactions, customers, stations, loyalty)
 * - Real-time metrics calculation
 * - Time-series data for charting
 * - Station performance analytics
 */

// Reads REAL data from Postgres (Drizzle). Was reading Firestore collections
// (`nayax_transactions`, `users`, `stations`) that don't hold the live data —
// the money/transactions/stations live in Postgres — so the admin analytics
// dashboard showed all zeros. Rewritten 2026-07-12 to query Postgres, matching
// the control-tower endpoint (routes.ts /api/admin/control-tower).
import { db } from '../db';
import { nayaxTransactions, users } from '@shared/schema';
import { petWashStations } from '@shared/schema-enterprise';
import { sql, and, gte, lte, eq, ne } from 'drizzle-orm';
import { logger } from '../lib/logger';

// A settled Nayax sale = real revenue. The Postgres status flow is
// initiated→authorized→vend_pending→vend_success→settled|voided|failed.
const REVENUE_STATUS = 'settled';

/**
 * Analytics overview structure - FLATTENED for frontend compatibility
 */
export interface AnalyticsOverview {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    growthRate: number; // Month-over-month percentage
  };
  customers: {
    total: number;
    active: number; // Customers with transactions this month
    new: number; // New customers this month
    growthRate: number; // Month-over-month percentage
  };
  stations: {
    total: number;
    active: number;
    offline: number;
    utilizationRate: number; // Percentage of active stations
  };
  transactions: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    successRate: number; // Percentage
  };
  loyalty: {
    totalMembers: number;
    new: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
  };
}

/**
 * Revenue time series for charts
 */
export interface RevenueTimeSeries {
  date: string; // YYYY-MM-DD format
  revenue: number;
  transactions: number;
}

/**
 * Station performance data for leaderboard
 */
export interface StationPerformance {
  stationId: string;
  stationName: string;
  totalRevenue: number; // This month's revenue
  totalTransactions: number; // This month's transactions
  averageTransaction: number;
  utilizationRate: number;
}

/**
 * Get date boundaries for analytics queries
 */
function getDateBoundaries() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  
  return {
    now,
    today,
    thisWeekStart,
    thisMonthStart,
    lastMonthStart,
    lastMonthEnd,
    thisYearStart,
  };
}

/**
 * Calculate revenue from approved transactions in a date range
 * FIXED: Now accepts optional stationId filter
 */
async function getRevenueForRange(
  startDate: Date,
  endDate: Date,
  stationId?: string
): Promise<number> {
  try {
    const conds = [
      eq(nayaxTransactions.status, REVENUE_STATUS),
      gte(nayaxTransactions.createdAt, startDate),
      lte(nayaxTransactions.createdAt, endDate),
    ];
    if (stationId) conds.push(eq(nayaxTransactions.stationId, stationId));
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(${nayaxTransactions.amount} AS DECIMAL)), 0)` })
      .from(nayaxTransactions)
      .where(and(...conds));
    return Number(row?.total ?? 0);
  } catch (error) {
    logger.error('[Analytics] Error calculating revenue', error, { stationId });
    return 0;
  }
}

/**
 * Count transactions in a date range
 * FIXED: Now accepts optional stationId filter
 */
async function getTransactionCountForRange(
  startDate: Date,
  endDate: Date,
  status?: string,
  stationId?: string
): Promise<number> {
  try {
    const conds = [
      gte(nayaxTransactions.createdAt, startDate),
      lte(nayaxTransactions.createdAt, endDate),
    ];
    if (status) conds.push(eq(nayaxTransactions.status, status));
    if (stationId) conds.push(eq(nayaxTransactions.stationId, stationId));
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(nayaxTransactions)
      .where(and(...conds));
    return Number(row?.c ?? 0);
  } catch (error) {
    logger.error('[Analytics] Error counting transactions', error, { status, stationId });
    return 0;
  }
}

/**
 * Get unique active customers (customers with approved transactions in period)
 */
async function getActiveCustomersForRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const [row] = await db
      .select({ c: sql<number>`COUNT(DISTINCT ${nayaxTransactions.customerUid})` })
      .from(nayaxTransactions)
      .where(and(
        eq(nayaxTransactions.status, REVENUE_STATUS),
        gte(nayaxTransactions.createdAt, startDate),
        lte(nayaxTransactions.createdAt, endDate),
      ));
    return Number(row?.c ?? 0);
  } catch (error) {
    logger.error('[Analytics] Error counting active customers', error);
    return 0;
  }
}

/**
 * Get new customer count for date range
 */
async function getNewCustomersForRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(and(gte(users.createdAt, startDate), lte(users.createdAt, endDate)));
    return Number(row?.c ?? 0);
  } catch (error) {
    logger.error('[Analytics] Error counting new customers', error);
    return 0;
  }
}

/**
 * Get comprehensive analytics overview with FLATTENED schema
 */
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const dates = getDateBoundaries();
  
  try {
    logger.info('[Analytics] Generating overview...');
    
    // Parallel Postgres queries (was Firestore — see file header).
    const [
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      revenueLastMonth,
      revenueThisYear,
      totalCustomers,
      activeCustomersThisMonth,
      newCustomersThisMonth,
      newCustomersLastMonth,
      txnTotals,
      stationTotals,
      loyaltyTierRows,
    ] = await Promise.all([
      getRevenueForRange(dates.today, dates.now),
      getRevenueForRange(dates.thisWeekStart, dates.now),
      getRevenueForRange(dates.thisMonthStart, dates.now),
      getRevenueForRange(dates.lastMonthStart, dates.lastMonthEnd),
      getRevenueForRange(dates.thisYearStart, dates.now),
      // total customers
      db.select({ c: sql<number>`count(*)` }).from(users).then((r) => Number(r[0]?.c ?? 0)),
      getActiveCustomersForRange(dates.thisMonthStart, dates.now),
      getNewCustomersForRange(dates.thisMonthStart, dates.now),
      getNewCustomersForRange(dates.lastMonthStart, dates.lastMonthEnd),
      // transactions bucketed by status (all-time)
      db.select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${nayaxTransactions.status} = ${REVENUE_STATUS})`,
        pending: sql<number>`count(*) filter (where ${nayaxTransactions.status} in ('initiated','authorized','vend_pending','pending'))`,
        failed: sql<number>`count(*) filter (where ${nayaxTransactions.status} in ('failed','voided'))`,
      }).from(nayaxTransactions).then((r) => r[0]),
      // stations by operational status (exclude decommissioned)
      db.select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${petWashStations.operationalStatus} = 'active')`,
        offline: sql<number>`count(*) filter (where ${petWashStations.operationalStatus} = 'offline')`,
      }).from(petWashStations).where(ne(petWashStations.operationalStatus, 'decommissioned')).then((r) => r[0]),
      // loyalty membership by tier (users.loyaltyTier)
      db.select({ tier: users.loyaltyTier, c: sql<number>`count(*)` }).from(users).groupBy(users.loyaltyTier),
    ]);

    const totalTxns = Number(txnTotals?.total ?? 0);
    const completedTxns = Number(txnTotals?.completed ?? 0);
    const successRate = totalTxns > 0 ? (completedTxns / totalTxns) * 100 : 0;

    const activeStations = Number(stationTotals?.active ?? 0);
    const offlineStations = Number(stationTotals?.offline ?? 0);
    const totalStations = Number(stationTotals?.total ?? 0);
    const utilizationRate = totalStations > 0 ? (activeStations / totalStations) * 100 : 0;

    // Tally loyalty tiers (7-tier system). Members without an explicit tier
    // default to 'bronze'.
    const tiers: Record<string, number> = {};
    let totalMembers = 0;
    for (const row of loyaltyTierRows) {
      const tier = (row.tier || 'bronze').toLowerCase();
      const n = Number(row.c ?? 0);
      tiers[tier] = (tiers[tier] || 0) + n;
      totalMembers += n;
    }

    const revenueGrowthRate = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : 0;
    const customerGrowthRate = newCustomersLastMonth > 0
      ? ((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100
      : 0;

    const overview = {
      revenue: {
        today: revenueToday,
        thisWeek: revenueThisWeek,
        thisMonth: revenueThisMonth,
        thisYear: revenueThisYear,
        growthRate: revenueGrowthRate,
      },
      customers: {
        total: totalCustomers,
        active: activeCustomersThisMonth,
        new: newCustomersThisMonth,
        growthRate: customerGrowthRate,
      },
      stations: {
        total: totalStations,
        active: activeStations,
        offline: offlineStations,
        utilizationRate,
      },
      transactions: {
        total: totalTxns,
        completed: completedTxns,
        pending: Number(txnTotals?.pending ?? 0),
        failed: Number(txnTotals?.failed ?? 0),
        successRate,
      },
      loyalty: {
        totalMembers,
        new: tiers['bronze'] ?? 0,
        silver: tiers['silver'] ?? 0,
        gold: tiers['gold'] ?? 0,
        platinum: tiers['platinum'] ?? 0,
        diamond: tiers['diamond'] ?? 0,
      },
    };
    
    logger.info('[Analytics] Overview generated successfully', {
      revenue: overview.revenue.thisMonth,
      customers: overview.customers.total,
      stations: overview.stations.total,
    });
    
    return overview;
  } catch (error) {
    logger.error('[Analytics] Error generating overview', error);
    throw error;
  }
}

/**
 * Get revenue time series for charts (30 days default)
 */
export async function getRevenueTimeSeries(days: number = 30): Promise<RevenueTimeSeries[]> {
  const result: RevenueTimeSeries[] = [];
  const now = new Date();
  
  try {
    logger.info('[Analytics] Generating revenue time series', { days });
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const [revenue, transactions] = await Promise.all([
        getRevenueForRange(date, nextDate),
        getTransactionCountForRange(date, nextDate, REVENUE_STATUS),
      ]);

      result.push({
        date: date.toISOString().split('T')[0], // YYYY-MM-DD format
        revenue,
        transactions,
      });
    }
    
    logger.info('[Analytics] Revenue time series generated', { dataPoints: result.length });
    return result;
  } catch (error) {
    logger.error('[Analytics] Error generating revenue time series', error);
    return [];
  }
}

/**
 * Get detailed station performance analytics
 * FIXED: Now correctly filters transactions by stationId
 */
export async function getStationPerformanceAnalytics(): Promise<StationPerformance[]> {
  const dates = getDateBoundaries();
  
  try {
    logger.info('[Analytics] Generating station performance...');
    
    const stationRows = await db
      .select({ stationCode: petWashStations.stationCode, stationName: petWashStations.stationName })
      .from(petWashStations)
      .where(ne(petWashStations.operationalStatus, 'decommissioned'));

    // Process each station with proper filtering. Transactions are matched by
    // nayaxTransactions.stationId == the station's code.
    const performanceData = await Promise.all(
      stationRows.map(async (station) => {
        const stationId = station.stationCode;

        const [revenue, transactions] = await Promise.all([
          getRevenueForRange(dates.thisMonthStart, dates.now, stationId),
          getTransactionCountForRange(dates.thisMonthStart, dates.now, REVENUE_STATUS, stationId),
        ]);

        const averageTransaction = transactions > 0 ? revenue / transactions : 0;

        // Simple utilization metric: transactions per day this month.
        const utilizationRate = transactions > 0
          ? Math.min(100, (transactions / 30) * 100)
          : 0;

        return {
          stationId,
          stationName: station.stationName || stationId,
          totalRevenue: revenue,
          totalTransactions: transactions,
          averageTransaction,
          utilizationRate,
        };
      })
    );
    
    // Sort by revenue (descending) for leaderboard
    const sorted = performanceData.sort((a, b) => b.totalRevenue - a.totalRevenue);
    
    logger.info('[Analytics] Station performance generated', { 
      stationCount: sorted.length,
      topStation: sorted[0]?.stationName,
      topRevenue: sorted[0]?.totalRevenue,
    });
    
    return sorted;
  } catch (error) {
    logger.error('[Analytics] Error generating station performance', error);
    return [];
  }
}

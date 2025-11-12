/**
 * Premium Analytics Service
 * 
 * Provides comprehensive business intelligence by aggregating data from:
 * - Firestore (transactions, customers, stations, loyalty)
 * - Real-time metrics calculation
 * - Time-series data for charting
 * - Station performance analytics
 */

import { db } from '../lib/firebase-admin';
import { logger } from '../lib/logger';

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
    let query: any = db.collection('nayax_transactions')
      .where('status', '==', 'approved')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate);
    
    // CRITICAL FIX: Filter by stationId if provided
    if (stationId) {
      query = query.where('stationId', '==', stationId);
    }
    
    const snapshot = await query.get();
    
    let total = 0;
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      total += data.amount || 0;
    });
    
    return total;
  } catch (error) {
    logger.error('[Analytics] Error calculating revenue', { error, stationId });
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
    let query: any = db.collection('nayax_transactions')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // CRITICAL FIX: Filter by stationId if provided
    if (stationId) {
      query = query.where('stationId', '==', stationId);
    }
    
    const snapshot = await query.get();
    return snapshot.size;
  } catch (error) {
    logger.error('[Analytics] Error counting transactions', { error, status, stationId });
    return 0;
  }
}

/**
 * Get unique active customers (customers with approved transactions in period)
 */
async function getActiveCustomersForRange(startDate: Date, endDate: Date): Promise<number> {
  try {
    const snapshot = await db.collection('nayax_transactions')
      .where('status', '==', 'approved')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();
    
    const uniqueCustomers = new Set();
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.userId) {
        uniqueCustomers.add(data.userId);
      }
    });
    
    return uniqueCustomers.size;
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
    const snapshot = await db.collection('users')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();
    
    return snapshot.size;
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
    
    // Parallel queries for optimal performance
    const [
      // Revenue metrics
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      revenueLastMonth,
      revenueThisYear,
      
      // Customer metrics
      totalCustomersSnapshot,
      activeCustomersThisMonth,
      newCustomersThisMonth,
      newCustomersLastMonth,
      
      // Transaction metrics
      totalTransactionsSnapshot,
      completedTransactionsSnapshot,
      pendingTransactionsSnapshot,
      failedTransactionsSnapshot,
      
      // Station metrics
      allStationsSnapshot,
      
      // Loyalty metrics
      loyaltySnapshot,
    ] = await Promise.all([
      // Revenue
      getRevenueForRange(dates.today, dates.now),
      getRevenueForRange(dates.thisWeekStart, dates.now),
      getRevenueForRange(dates.thisMonthStart, dates.now),
      getRevenueForRange(dates.lastMonthStart, dates.lastMonthEnd),
      getRevenueForRange(dates.thisYearStart, dates.now),
      
      // Customers
      db.collection('users').count().get(),
      getActiveCustomersForRange(dates.thisMonthStart, dates.now),
      getNewCustomersForRange(dates.thisMonthStart, dates.now),
      getNewCustomersForRange(dates.lastMonthStart, dates.lastMonthEnd),
      
      // Transactions
      db.collection('nayax_transactions').count().get(),
      db.collection('nayax_transactions').where('status', '==', 'approved').count().get(),
      db.collection('nayax_transactions').where('status', '==', 'pending').count().get(),
      db.collection('nayax_transactions').where('status', '==', 'failed').count().get(),
      
      // Stations
      db.collection('stations').get(),
      
      // Loyalty
      db.collection('users').where('loyalty', '!=', null).get(),
    ]);
    
    // Process stations
    const stations = allStationsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    const activeStations = stations.filter((s: any) => s.status === 'active').length;
    const offlineStations = stations.filter((s: any) => s.status === 'offline').length;
    const utilizationRate = stations.length > 0 ? (activeStations / stations.length) * 100 : 0;
    
    // Process loyalty tiers (NEW 5-TIER SYSTEM)
    const loyaltyTiers = {
      new: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0,
    };
    
    loyaltySnapshot.forEach((doc: any) => {
      const user = doc.data();
      const tier = user.loyalty?.tier?.toLowerCase();
      if (tier && loyaltyTiers.hasOwnProperty(tier)) {
        loyaltyTiers[tier as keyof typeof loyaltyTiers]++;
      }
    });
    
    // Calculate growth rates
    const revenueGrowthRate = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : 0;
    
    const customerGrowthRate = newCustomersLastMonth > 0
      ? ((newCustomersThisMonth - newCustomersLastMonth) / newCustomersLastMonth) * 100
      : 0;
    
    // Calculate success rate
    const totalTxns = totalTransactionsSnapshot.data().count;
    const completedTxns = completedTransactionsSnapshot.data().count;
    const successRate = totalTxns > 0 ? (completedTxns / totalTxns) * 100 : 0;
    
    const overview = {
      revenue: {
        today: revenueToday,
        thisWeek: revenueThisWeek,
        thisMonth: revenueThisMonth,
        thisYear: revenueThisYear,
        growthRate: revenueGrowthRate,
      },
      customers: {
        total: totalCustomersSnapshot.data().count,
        active: activeCustomersThisMonth,
        new: newCustomersThisMonth,
        growthRate: customerGrowthRate,
      },
      stations: {
        total: stations.length,
        active: activeStations,
        offline: offlineStations,
        utilizationRate,
      },
      transactions: {
        total: totalTxns,
        completed: completedTxns,
        pending: pendingTransactionsSnapshot.data().count,
        failed: failedTransactionsSnapshot.data().count,
        successRate,
      },
      loyalty: {
        totalMembers: loyaltySnapshot.size,
        new: loyaltyTiers.new,
        silver: loyaltyTiers.silver,
        gold: loyaltyTiers.gold,
        platinum: loyaltyTiers.platinum,
        diamond: loyaltyTiers.diamond,
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
        getTransactionCountForRange(date, nextDate, 'approved'),
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
    
    const stationsSnapshot = await db.collection('stations').get();
    
    // Process each station with proper filtering
    const performanceData = await Promise.all(
      stationsSnapshot.docs.map(async (doc: any) => {
        const station = doc.data();
        const stationId = doc.id;
        
        // CRITICAL FIX: Pass stationId to filter queries
        const [revenue, transactions] = await Promise.all([
          getRevenueForRange(dates.thisMonthStart, dates.now, stationId),
          getTransactionCountForRange(dates.thisMonthStart, dates.now, 'approved', stationId),
        ]);
        
        const averageTransaction = transactions > 0 ? revenue / transactions : 0;
        
        // Calculate utilization based on actual usage vs expected
        const utilizationRate = transactions > 0 ? 
          Math.min(100, (transactions / 30) * 100) : // Simple metric: transactions per day
          0;
        
        return {
          stationId,
          stationName: station.name || stationId,
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

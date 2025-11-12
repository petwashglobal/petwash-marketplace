/**
 * ADMIN DASHBOARD REAL-TIME METRICS API
 * PostgreSQL + Firestore Unified Data Feed
 * 
 * Features:
 * - Real-time revenue tracking
 * - Active K9000 station count
 * - Loyalty tier distribution
 * - Franchise performance metrics
 */

import express from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import admin from 'firebase-admin';
import { logger } from '../lib/logger';

const router = express.Router();

/**
 * GET /api/admin/metrics
 * Get real-time dashboard metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    logger.info('[AdminDashboard] Fetching metrics');
    
    // STEP 1: Get revenue data from PostgreSQL
    const revenueResult = await db.execute(sql`
      SELECT 
        SUM(amount_cents) / 100 as total_revenue,
        COUNT(*) as transaction_count,
        AVG(amount_cents) / 100 as avg_transaction
      FROM payment_intents
      WHERE status IN ('succeeded', 'captured')
      AND created_at > NOW() - INTERVAL '30 days'
    `);
    
    const revenueData = revenueResult.rows[0] as any;
    
    // STEP 2: Get K9000 station metrics
    const stationsResult = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE active = true AND status = 'online') as active_count,
        COUNT(*) FILTER (WHERE active = true) as total_count,
        COUNT(*) FILTER (WHERE status = 'error') as error_count,
        SUM(transaction_count) as total_washes
      FROM k9000_stations
    `);
    
    const stationsData = stationsResult.rows[0] as any;
    
    // STEP 3: Get loyalty tier distribution from Firestore
    const firestore = admin.firestore();
    
    const loyaltySnapshot = await firestore
      .collection('users')
      .select('loyaltyTier')
      .get();
    
    const tierCounts = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
      DIAMOND: 0,
    };
    
    loyaltySnapshot.forEach((doc) => {
      const tier = doc.data().loyaltyTier || 'BRONZE';
      if (tier in tierCounts) {
        tierCounts[tier as keyof typeof tierCounts]++;
      }
    });
    
    // STEP 4: Get franchise metrics (if franchises exist)
    let franchiseData = null;
    try {
      const franchiseResult = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_franchises,
          COUNT(*) as total_franchises,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 as activation_rate
        FROM franchise_entities
      `);
      
      franchiseData = franchiseResult.rows[0];
    } catch (error) {
      // franchise_entities table might not exist yet
      logger.warn('[AdminDashboard] Franchise metrics not available');
    }
    
    // STEP 5: Get today's stats
    const todayResult = await db.execute(sql`
      SELECT 
        SUM(amount_cents) / 100 as today_revenue,
        COUNT(*) as today_transactions
      FROM payment_intents
      WHERE status IN ('succeeded', 'captured')
      AND created_at::date = CURRENT_DATE
    `);
    
    const todayData = todayResult.rows[0] as any;
    
    // STEP 6: Compile metrics
    const metrics = {
      revenue: {
        total: parseFloat(revenueData.total_revenue || 0).toFixed(2),
        today: parseFloat(todayData.today_revenue || 0).toFixed(2),
        avgTransaction: parseFloat(revenueData.avg_transaction || 0).toFixed(2),
        transactionCount: parseInt(revenueData.transaction_count || 0),
        todayTransactionCount: parseInt(todayData.today_transactions || 0),
      },
      stations: {
        active: parseInt(stationsData.active_count || 0),
        total: parseInt(stationsData.total_count || 0),
        errors: parseInt(stationsData.error_count || 0),
        totalWashes: parseInt(stationsData.total_washes || 0),
        healthRate: stationsData.total_count > 0
          ? ((stationsData.active_count / stationsData.total_count) * 100).toFixed(1)
          : '0.0',
      },
      loyalty: {
        totalUsers: loyaltySnapshot.size,
        tiers: tierCounts,
        platinumRate: loyaltySnapshot.size > 0
          ? ((tierCounts.PLATINUM / loyaltySnapshot.size) * 100).toFixed(1)
          : '0.0',
      },
      franchises: franchiseData || {
        active_franchises: 0,
        total_franchises: 0,
        activation_rate: 0,
      },
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Jerusalem',
    };
    
    logger.info('[AdminDashboard] Metrics compiled successfully', {
      revenue: metrics.revenue.total,
      activeStations: metrics.stations.active,
      totalUsers: metrics.loyalty.totalUsers,
    });
    
    res.json({
      success: true,
      metrics,
    });
    
  } catch (error: any) {
    logger.error('[AdminDashboard] Failed to fetch metrics', {
      error: error.message,
      stack: error.stack,
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard metrics',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/revenue-chart
 * Get revenue chart data (last 30 days)
 */
router.get('/revenue-chart', async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        created_at::date as date,
        SUM(amount_cents) / 100 as revenue,
        COUNT(*) as transactions
      FROM payment_intents
      WHERE status IN ('succeeded', 'captured')
      AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY date ASC
    `);
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    logger.error('[AdminDashboard] Revenue chart error', {
      error: error.message,
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue chart data',
    });
  }
});

/**
 * GET /api/admin/platform-health
 * Get overall platform health score
 */
router.get('/platform-health', async (req, res) => {
  try {
    // Check multiple health indicators
    const indicators = {
      database: false,
      firestore: false,
      stations: false,
      payments: false,
    };
    
    // Test PostgreSQL
    try {
      await db.execute(sql`SELECT 1`);
      indicators.database = true;
    } catch (e) {
      logger.error('[AdminDashboard] PostgreSQL health check failed');
    }
    
    // Test Firestore
    try {
      const firestore = admin.firestore();
      await firestore.collection('_health_check').doc('test').get();
      indicators.firestore = true;
    } catch (e) {
      logger.error('[AdminDashboard] Firestore health check failed');
    }
    
    // Check stations (at least 50% should be online)
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'online') as online,
          COUNT(*) as total
        FROM k9000_stations
        WHERE active = true
      `);
      const data = result.rows[0] as any;
      indicators.stations = data.total > 0 && (data.online / data.total) >= 0.5;
    } catch (e) {
      logger.warn('[AdminDashboard] Stations health check skipped');
      indicators.stations = true; // Don't fail if table doesn't exist
    }
    
    // Check payment success rate (should be > 90%)
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'succeeded') as succeeded,
          COUNT(*) as total
        FROM payment_intents
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      const data = result.rows[0] as any;
      indicators.payments = data.total === 0 || (data.succeeded / data.total) >= 0.9;
    } catch (e) {
      logger.error('[AdminDashboard] Payment health check failed');
    }
    
    // Calculate overall health score
    const healthyCount = Object.values(indicators).filter(Boolean).length;
    const totalChecks = Object.keys(indicators).length;
    const healthScore = (healthyCount / totalChecks) * 100;
    
    let status: 'healthy' | 'degraded' | 'critical';
    if (healthScore === 100) status = 'healthy';
    else if (healthScore >= 75) status = 'degraded';
    else status = 'critical';
    
    res.json({
      success: true,
      health: {
        status,
        score: healthScore.toFixed(1),
        indicators,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('[AdminDashboard] Platform health check failed', {
      error: error.message,
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check platform health',
    });
  }
});

export default router;

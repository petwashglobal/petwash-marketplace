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
import admin from '../lib/firebase-admin';
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
        COUNT(*) FILTER (WHERE is_active = true AND iot_status = 'online') AS active_count,
        COUNT(*) FILTER (WHERE is_active = true) AS total_count,
        COUNT(*) FILTER (WHERE iot_status = 'error') AS error_count,
        COALESCE(SUM(total_washes), 0) AS total_washes
      FROM stations
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
      EMERALD: 0,
      ROYAL: 0,
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
        totalMembers: loyaltySnapshot.size,
        bronze: tierCounts.BRONZE,
        silver: tierCounts.SILVER,
        gold: tierCounts.GOLD,
        platinum: tierCounts.PLATINUM,
        diamond: tierCounts.DIAMOND,
        emerald: tierCounts.EMERALD,
        royal: tierCounts.ROYAL,
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
          COUNT(*) FILTER (WHERE iot_status = 'online') AS online,
          COUNT(*) AS total
        FROM stations
        WHERE is_active = true
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

/**
 * GET /api/admin/bookings
 * Recent bookings across all platforms — sitters + walks (last 50 combined, newest first).
 */
router.get('/bookings', async (req, res) => {
  try {
    // Pull last 25 sitter bookings
    const sitterRows = await db.execute(sql`
      SELECT
        sb.booking_id                          AS id,
        'pet_sitter'                           AS platform_id,
        u.first_name || ' ' || u.last_name     AS guest_name,
        pp.pet_name,
        'Overnight Stay'                       AS service_type,
        sb.start_date                          AS check_in,
        sb.end_date                            AS check_out,
        sb.status,
        COALESCE(sb.total_charge_cents, 0) / 100.0 AS amount_nis,
        COALESCE(sp.city, '')                  AS city
      FROM sitter_bookings sb
      LEFT JOIN users u ON u.id = sb.owner_id
      LEFT JOIN pet_profiles_for_sitting pp ON pp.id = sb.pet_id
      LEFT JOIN sitter_profiles sp ON sp.id = sb.sitter_id
      ORDER BY sb.created_at DESC
      LIMIT 25
    `);

    // Pull last 25 walk bookings
    const walkRows = await db.execute(sql`
      SELECT
        wb.booking_id                          AS id,
        'walk_my_pet'                          AS platform_id,
        u.first_name || ' ' || u.last_name     AS guest_name,
        wb.pet_name,
        COALESCE(wb.service_type, 'Walk')      AS service_type,
        wb.scheduled_date                      AS check_in,
        wb.scheduled_date                      AS check_out,
        wb.status,
        COALESCE(wb.total_amount, 0)           AS amount_nis,
        COALESCE(wb.city, '')                  AS city
      FROM walk_bookings wb
      LEFT JOIN users u ON u.id = wb.owner_id
      ORDER BY wb.created_at DESC
      LIMIT 25
    `);

    const sitter = sitterRows.rows ?? (sitterRows as any[]);
    const walks = walkRows.rows ?? (walkRows as any[]);

    // Merge, filter out records with no date, and sort newest first (cap at 50)
    const all = [...sitter, ...walks]
      .filter((r: any) => r.check_in != null)
      .sort((a: any, b: any) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
      .slice(0, 50);

    res.json({ success: true, bookings: all });
  } catch (error: any) {
    logger.error('[AdminDashboard] /bookings error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

/**
 * GET /api/admin/talent
 * Approved talent profiles across all platforms (walkers, sitters, trainers).
 */
router.get('/talent', async (req, res) => {
  try {
    const walkerRows = await db.execute(sql`
      SELECT
        wp.walker_id                              AS id,
        'walker'                                  AS role,
        wp.first_name || ' ' || wp.last_name      AS full_name,
        wp.profile_photo_url                      AS avatar_url,
        COALESCE(wp.average_rating, 4.50)::float  AS rating,
        COALESCE(wp.total_walks, 0)               AS total_jobs,
        COALESCE(wp.city, '')                     AS city,
        COALESCE(wp.bio, '')                      AS bio_short,
        wp.hourly_rate::float                     AS hourly_from_nis,
        COALESCE(wp.kyc_completed, false)         AS verified_background
      FROM walker_profiles wp
      WHERE wp.verification_status = 'approved' AND wp.is_active = true
      ORDER BY wp.average_rating DESC NULLS LAST
      LIMIT 20
    `);

    const sitterRows = await db.execute(sql`
      SELECT
        sp.sitter_id                              AS id,
        'sitter'                                  AS role,
        sp.first_name || ' ' || sp.last_name      AS full_name,
        sp.profile_photo_url                      AS avatar_url,
        COALESCE(sp.average_rating, 4.50)::float  AS rating,
        COALESCE(sp.total_bookings, 0)            AS total_jobs,
        COALESCE(sp.city, '')                     AS city,
        COALESCE(sp.bio, '')                      AS bio_short,
        COALESCE(sp.base_rate, 0)::float          AS hourly_from_nis,
        COALESCE(sp.kyc_verified, false)          AS verified_background
      FROM sitter_profiles sp
      WHERE sp.verification_status = 'approved' AND sp.is_active = true
      ORDER BY sp.average_rating DESC NULLS LAST
      LIMIT 20
    `);

    const trainerRows = await db.execute(sql`
      SELECT
        t.trainer_id                              AS id,
        'trainer'                                 AS role,
        t.first_name || ' ' || t.last_name        AS full_name,
        t.profile_photo_url                       AS avatar_url,
        COALESCE(t.average_rating, 4.50)::float   AS rating,
        COALESCE(t.total_sessions, 0)             AS total_jobs,
        COALESCE(t.service_area, '')              AS city,
        COALESCE(t.bio, '')                       AS bio_short,
        t.hourly_rate::float                      AS hourly_from_nis,
        t.is_certified                            AS verified_background
      FROM trainers t
      WHERE t.verification_status = 'approved' AND t.is_active = true
      ORDER BY t.average_rating DESC NULLS LAST
      LIMIT 20
    `);

    const walkers = walkerRows.rows ?? (walkerRows as any[]);
    const sitters = sitterRows.rows ?? (sitterRows as any[]);
    const trainers = trainerRows.rows ?? (trainerRows as any[]);

    res.json({ success: true, talent: [...walkers, ...sitters, ...trainers] });
  } catch (error: any) {
    logger.error('[AdminDashboard] /talent error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch talent' });
  }
});

/**
 * GET /api/admin/invoices
 * Latest 50 payment intents (invoices / payouts) — newest first.
 */
router.get('/invoices', async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        pi.id,
        'customer'                                          AS type,
        COALESCE(pi.platform_id, 'unknown')                AS label,
        pi.created_at                                       AS date,
        COALESCE(pi.amount_cents, 0) / 100.0               AS amount_nis,
        pi.status,
        COALESCE(u.first_name || ' ' || u.last_name, 'Customer') AS counterparty
      FROM payment_intents pi
      LEFT JOIN users u ON u.id = pi.user_id
      ORDER BY pi.created_at DESC
      LIMIT 50
    `);

    const invoices = rows.rows ?? (rows as any[]);

    res.json({ success: true, invoices });
  } catch (error: any) {
    logger.error('[AdminDashboard] /invoices error', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
  }
});

export default router;

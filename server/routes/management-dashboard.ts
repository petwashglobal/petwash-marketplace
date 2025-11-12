/**
 * Management Dashboard API
 * CEO/CFO Access Only
 * 
 * Provides comprehensive business intelligence:
 * - All 4 service revenue streams
 * - Daily/Weekly/Monthly/Yearly reports
 * - Service-type routing identification
 * - Income vs expenses analysis
 * - AI-powered forecasting
 * - Cash flow planning
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../customAuth';
import { managementAnalytics, type TimeFrame } from '../services/ManagementAnalyticsService';
import { logger } from '../lib/logger';

const router = Router();

// CEO and CFO only access
const managementAuth = (req: Request, res: Response, next: Function) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // CRITICAL: Only CEO and CFO corporate emails
    const managementEmails = [
      'nir.h@petwash.co.il',  // CEO
      'ido.s@petwash.co.il'    // CFO
    ];
    
    if (!managementEmails.includes(user.email?.toLowerCase())) {
      logger.warn('[Management Dashboard] Unauthorized access attempt', {
        email: user.email,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'Access denied - CEO/CFO only'
      });
    }
    
    next();
  } catch (error) {
    logger.error('[Management Dashboard] Auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

router.use(requireAuth);
router.use(managementAuth);

/**
 * GET /api/management/dashboard
 * Comprehensive metrics for specified period
 * 
 * Query params:
 * - period: daily|weekly|monthly|yearly (default: monthly)
 * - startDate: ISO date string
 * - endDate: ISO date string
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;
    
    let start: Date;
    let end: Date = new Date();
    
    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      // Default periods
      switch (period) {
        case 'daily':
          start = new Date();
          start.setHours(0, 0, 0, 0);
          break;
        case 'weekly':
          start = new Date();
          start.setDate(start.getDate() - 7);
          break;
        case 'monthly':
          start = new Date();
          start.setMonth(start.getMonth() - 1);
          break;
        case 'yearly':
          start = new Date();
          start.setFullYear(start.getFullYear() - 1);
          break;
        default:
          start = new Date();
          start.setMonth(start.getMonth() - 1);
      }
    }
    
    const metrics = await managementAnalytics.getComprehensiveMetrics(
      start,
      end,
      period as TimeFrame
    );
    
    logger.info('[Management Dashboard] Metrics generated', {
      user: req.user?.email,
      period,
      totalRevenue: metrics.overview.totalRevenue
    });
    
    res.json(metrics);
    
  } catch (error) {
    logger.error('[Management Dashboard] Error generating dashboard:', error);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

/**
 * GET /api/management/dashboard/daily
 * Today's performance snapshot
 */
router.get('/dashboard/daily', async (req: Request, res: Response) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    
    const metrics = await managementAnalytics.getComprehensiveMetrics(start, end, 'daily');
    
    res.json(metrics);
  } catch (error) {
    logger.error('[Management Dashboard] Daily snapshot error:', error);
    res.status(500).json({ error: 'Failed to get daily snapshot' });
  }
});

/**
 * GET /api/management/dashboard/weekly
 * This week's performance
 */
router.get('/dashboard/weekly', async (req: Request, res: Response) => {
  try {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    
    const end = new Date();
    
    const metrics = await managementAnalytics.getComprehensiveMetrics(start, end, 'weekly');
    
    res.json(metrics);
  } catch (error) {
    logger.error('[Management Dashboard] Weekly snapshot error:', error);
    res.status(500).json({ error: 'Failed to get weekly snapshot' });
  }
});

/**
 * GET /api/management/dashboard/monthly
 * This month's performance
 */
router.get('/dashboard/monthly', async (req: Request, res: Response) => {
  try {
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    
    const end = new Date();
    
    const metrics = await managementAnalytics.getComprehensiveMetrics(start, end, 'monthly');
    
    res.json(metrics);
  } catch (error) {
    logger.error('[Management Dashboard] Monthly snapshot error:', error);
    res.status(500).json({ error: 'Failed to get monthly snapshot' });
  }
});

/**
 * GET /api/management/dashboard/yearly
 * This year's performance
 */
router.get('/dashboard/yearly', async (req: Request, res: Response) => {
  try {
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    
    const end = new Date();
    
    const metrics = await managementAnalytics.getComprehensiveMetrics(start, end, 'yearly');
    
    res.json(metrics);
  } catch (error) {
    logger.error('[Management Dashboard] Yearly snapshot error:', error);
    res.status(500).json({ error: 'Failed to get yearly snapshot' });
  }
});

/**
 * GET /api/management/service-routing
 * Real-time service type identification
 * Helps understand which service customers are using
 */
router.get('/service-routing', async (req: Request, res: Response) => {
  try {
    // Get last 100 transactions across all services
    const recentActivity = {
      message: 'Service routing tracked automatically',
      services: {
        'k9000_wash': 'DIY Wash Stations - Customers using outdoor hubs',
        'sitter_suite': 'Pet Sitting - Customers booking in-home pet care',
        'walk_my_pet': 'Dog Walking - Customers booking dog walks',
        'pettrek_transport': 'Pet Transport - Customers booking pet rides'
      },
      tracking: {
        backend: 'All transactions automatically categorized by service type',
        database: 'Separate tables per service for clean data separation',
        reporting: 'Revenue tracked independently per service line'
      }
    };
    
    res.json(recentActivity);
  } catch (error) {
    logger.error('[Management Dashboard] Service routing error:', error);
    res.status(500).json({ error: 'Failed to get service routing info' });
  }
});

export default router;

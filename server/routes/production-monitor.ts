/**
 * Production Website Monitoring Routes
 * API endpoints for petwash.co.il health monitoring
 */

import { Router, Request, Response } from 'express';
import { productionMonitor } from '../services/ProductionWebsiteMonitorService';
import { logger } from '../lib/logger';

const router = Router();

/**
 * GET /api/production-monitor/status
 * Get current monitoring status and last results
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = productionMonitor.getStatus();
    res.json({
      success: true,
      ...status,
      productionUrl: 'https://petwash.co.il',
      checkInterval: '5 minutes'
    });
  } catch (error) {
    logger.error('[ProductionMonitor] Status endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

/**
 * POST /api/production-monitor/check
 * Trigger a manual health check
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    logger.info('[ProductionMonitor] Manual health check triggered');
    const results = await productionMonitor.manualCheck();
    
    const summary = {
      healthy: results.filter(r => r.status === 'healthy').length,
      degraded: results.filter(r => r.status === 'degraded').length,
      down: results.filter(r => r.status === 'down').length
    };

    res.json({
      success: true,
      summary,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[ProductionMonitor] Manual check error:', error);
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
});

/**
 * POST /api/production-monitor/start
 * Start the monitoring service
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    await productionMonitor.start();
    res.json({ success: true, message: 'Monitoring started' });
  } catch (error) {
    logger.error('[ProductionMonitor] Start error:', error);
    res.status(500).json({ success: false, error: 'Failed to start monitoring' });
  }
});

/**
 * POST /api/production-monitor/stop
 * Stop the monitoring service
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    productionMonitor.stop();
    res.json({ success: true, message: 'Monitoring stopped' });
  } catch (error) {
    logger.error('[ProductionMonitor] Stop error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop monitoring' });
  }
});

export default router;

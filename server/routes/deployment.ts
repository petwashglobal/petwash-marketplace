import { Router, Request, Response } from 'express';
import { runCanaryChecks, monitorCanaryDeployment, resetCanaryCounters } from '../lib/canary';
import { createSentryRelease, getCurrentCommit } from '../lib/sentry-releases';
import { logger } from '../lib/observability';

const router = Router();

/**
 * Get current deployment info
 */
router.get('/deployment/info', (req: Request, res: Response) => {
  const commit = getCurrentCommit();
  
  res.json({
    version: `${commit.substring(0, 7)}-${Date.now()}`,
    commit,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Run canary deployment checks
 */
router.post('/deployment/canary/check', async (req: Request, res: Response) => {
  try {
    const health = await runCanaryChecks();
    
    logger.info('[Canary] Health check complete', {
      canaryPassed: health.canaryPassed,
      shouldRollback: health.shouldRollback,
    });
    
    res.json(health);
  } catch (error) {
    logger.error('[Canary] Health check failed', { error });
    res.status(500).json({ error: 'Failed to run canary checks' });
  }
});

/**
 * Monitor canary deployment for duration
 */
router.post('/deployment/canary/monitor', async (req: Request, res: Response) => {
  try {
    const { durationMs = 300000 } = req.body; // Default 5 minutes
    
    logger.info('[Canary] Starting monitoring', { durationMs });
    
    const success = await monitorCanaryDeployment(durationMs);
    
    res.json({
      success,
      message: success 
        ? 'Canary deployment healthy' 
        : 'Canary deployment failed - rollback recommended',
      durationMs,
    });
  } catch (error) {
    logger.error('[Canary] Monitoring failed', { error });
    res.status(500).json({ error: 'Failed to monitor canary deployment' });
  }
});

/**
 * Reset canary counters after rollback
 */
router.post('/deployment/canary/reset', (req: Request, res: Response) => {
  resetCanaryCounters();
  logger.info('[Canary] Counters reset');
  
  res.json({ success: true, message: 'Canary counters reset' });
});

/**
 * Create Sentry release
 */
router.post('/deployment/release', async (req: Request, res: Response) => {
  try {
    const release = await createSentryRelease();
    
    if (!release) {
      res.status(400).json({ error: 'Sentry not configured or release creation failed' });
      return;
    }
    
    logger.info('[Sentry] Release created', { release });
    
    res.json(release);
  } catch (error) {
    logger.error('[Sentry] Release creation failed', { error });
    res.status(500).json({ error: 'Failed to create Sentry release' });
  }
});

/**
 * Trigger manual rollback
 */
router.post('/deployment/rollback', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    
    logger.error('[Deployment] Manual rollback triggered', { reason });
    
    // In Replit, we would need to revert to a previous deployment
    // This is a placeholder for the rollback logic
    
    res.json({
      success: true,
      message: 'Rollback initiated',
      reason,
      instructions: 'Use Replit deployment history to rollback to previous version',
    });
  } catch (error) {
    logger.error('[Deployment] Rollback failed', { error });
    res.status(500).json({ error: 'Failed to trigger rollback' });
  }
});

export default router;

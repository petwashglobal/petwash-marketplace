import { Router, Request, Response } from 'express';
import { getAuthFunnelMetrics, trackAuthFunnel, trackCustomEvent } from '../lib/ga4';
import { logger } from '../lib/observability';

const router = Router();

/**
 * Get auth funnel metrics from BigQuery
 */
router.get('/analytics/funnel', async (req: Request, res: Response) => {
  try {
    const metrics = await getAuthFunnelMetrics();
    
    if (!metrics) {
      res.status(503).json({ error: 'BigQuery not configured or query failed' });
      return;
    }
    
    res.json(metrics);
  } catch (error) {
    logger.error('[Analytics] Failed to get funnel metrics', { error });
    res.status(500).json({ error: 'Failed to get funnel metrics' });
  }
});

/**
 * Track auth funnel event from client
 */
router.post('/analytics/funnel/track', async (req: Request, res: Response) => {
  try {
    const { step, method, errorCode, latencyMs, userId } = req.body;
    
    await trackAuthFunnel({ step, method, errorCode, latencyMs, userId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Analytics] Failed to track funnel event', { error });
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * Track custom event
 */
router.post('/analytics/event', async (req: Request, res: Response) => {
  try {
    const { eventName, params, userId } = req.body;
    
    if (!eventName) {
      res.status(400).json({ error: 'Event name required' });
      return;
    }
    
    await trackCustomEvent(eventName, params || {}, userId);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('[Analytics] Failed to track custom event', { error });
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * Get GA4 configuration status
 */
router.get('/analytics/status', (req: Request, res: Response) => {
  const ga4Configured = !!(process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET);
  const bigqueryConfigured = !!(process.env.BIGQUERY_PROJECT_ID && process.env.BIGQUERY_DATASET_ID);
  
  res.json({
    ga4: {
      configured: ga4Configured,
      measurementId: ga4Configured ? process.env.GA4_MEASUREMENT_ID : null,
    },
    bigquery: {
      configured: bigqueryConfigured,
      projectId: bigqueryConfigured ? process.env.BIGQUERY_PROJECT_ID : null,
      datasetId: bigqueryConfigured ? process.env.BIGQUERY_DATASET_ID : null,
    },
  });
});

export default router;

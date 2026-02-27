import { Router, Request, Response } from 'express';
import { getAuthFunnelMetrics, trackAuthFunnel, trackCustomEvent } from '../lib/ga4';
import { logger } from '../lib/observability';
import { requireAdmin } from '../adminAuth';
import rateLimit from 'express-rate-limit';

const router = Router();

const analyticsTrackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many tracking requests' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false, default: false },
});

const ALLOWED_EVENT_NAMES = /^[a-zA-Z0-9_]{1,100}$/;

router.get('/analytics/funnel', requireAdmin, async (req: Request, res: Response) => {
  try {
    const metrics = await getAuthFunnelMetrics();
    if (!metrics) {
      res.status(503).json({ error: 'BigQuery not configured or query failed' });
      return;
    }
    res.json(metrics);
  } catch (error) {
    logger.error('[Analytics] Failed to get funnel metrics', error);
    res.status(500).json({ error: 'Failed to get funnel metrics' });
  }
});

router.post('/analytics/funnel/track', analyticsTrackLimiter, async (req: Request, res: Response) => {
  try {
    const { step, method, errorCode, latencyMs, userId } = req.body;
    if (!step || typeof step !== 'string' || step.length > 100) {
      res.status(400).json({ error: 'Invalid step' });
      return;
    }
    await trackAuthFunnel({ step, method, errorCode, latencyMs, userId });
    res.json({ success: true });
  } catch (error) {
    logger.error('[Analytics] Failed to track funnel event', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

router.post('/analytics/event', analyticsTrackLimiter, async (req: Request, res: Response) => {
  try {
    const { eventName, params, userId } = req.body;
    if (!eventName || !ALLOWED_EVENT_NAMES.test(eventName)) {
      res.status(400).json({ error: 'Invalid event name' });
      return;
    }
    const safeParams: Record<string, string | number | boolean> = {};
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        if (ALLOWED_EVENT_NAMES.test(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
          safeParams[k] = v;
        }
      }
    }
    await trackCustomEvent(eventName, safeParams, userId);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Analytics] Failed to track custom event', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

router.get('/analytics/status', requireAdmin, (req: Request, res: Response) => {
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

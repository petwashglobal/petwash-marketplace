/**
 * Wallet Telemetry Routes
 * 
 * Endpoints for AI-assisted wallet pass success monitoring:
 * - /api/wallet/telemetry/beacon (client beacon tracking)
 * - /api/wallet/telemetry/stats (admin dashboard)
 * - /api/wallet/telemetry/session/:token (session details)
 */

import express from 'express';
import { WalletTelemetryService } from '../services/WalletTelemetryService';
import { logger } from '../lib/logger';

const router = express.Router();

/**
 * POST /api/wallet/telemetry/beacon
 * Record client-side telemetry beacon
 * 🔓 Public (uses token auth)
 * Supports both JSON and text/plain (for navigator.sendBeacon)
 */
router.post('/beacon', 
  express.raw({ type: '*/*', limit: '10kb' }),
  async (req, res) => {
    try {
      // Parse body - handle both JSON and text/plain (sendBeacon sends text/plain by default)
      let body: any = {};
      
      if (Buffer.isBuffer(req.body)) {
        const bodyStr = req.body.toString('utf8');
        body = JSON.parse(bodyStr);
      } else if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body || {};
      }

      const { type, token, extra, ts } = body;

      if (!type || !token) {
        // Still return 204 to not break client tracking
        return res.status(204).end();
      }

      // Record beacon with IP and UA
      await WalletTelemetryService.recordBeacon({
        type,
        token,
        timestamp: ts ? new Date(ts) : new Date(),
        extra,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Return 204 No Content (fastest response for beacons)
      res.status(204).end();

    } catch (error) {
      logger.error('[WalletTelemetry] Beacon error:', error);
      // Still return 204 to not break client tracking
      res.status(204).end();
    }
  }
);

/**
 * GET /api/wallet/telemetry/stats
 * Get telemetry statistics for admin dashboard
 * 🔒 Requires admin authentication
 */
router.get('/stats', async (req, res) => {
  try {
    // TODO: Add admin auth middleware
    const session = req.session as any;
    if (!session?.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const timeRange = (req.query.range as 'today' | 'week' | 'month') || 'today';
    const stats = await WalletTelemetryService.getStats(timeRange);

    res.json({
      success: true,
      timeRange,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[WalletTelemetry] Stats error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve telemetry stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/wallet/telemetry/cleanup
 * Cleanup old telemetry data (90 day retention)
 * 🔒 Requires admin authentication
 */
router.post('/cleanup', async (req, res) => {
  try {
    const session = req.session as any;
    if (!session?.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const deleted = await WalletTelemetryService.cleanup();

    res.json({
      success: true,
      deleted,
      message: `Deleted ${deleted} old telemetry records`
    });

    logger.info('[WalletTelemetry] Manual cleanup completed', { deleted });

  } catch (error) {
    logger.error('[WalletTelemetry] Cleanup error:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup telemetry data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

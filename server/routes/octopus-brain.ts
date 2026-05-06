/**
 * 🐙 OCTOPUS BRAIN API ROUTES
 * 
 * Central platform orchestration and monitoring endpoints
 * Provides real-time status, health checks, and AI-powered insights
 */

import { Router, Request, Response } from 'express';
import { octopusBrain } from '../services/OctopusBrainService';
import { requireAdmin } from '../adminAuth';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';

const router = Router();

/**
 * GET /api/octopus-brain/status
 * Get overall platform ecosystem status
 * Public endpoint for dashboard widgets
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = octopusBrain.getOverallStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Octopus Brain status'
    });
  }
});

/**
 * GET /api/octopus-brain/platforms
 * Get all platform definitions
 */
router.get('/platforms', async (req: Request, res: Response) => {
  try {
    const platforms = octopusBrain.getPlatformDefinitions();
    res.json({
      success: true,
      data: platforms,
      count: platforms.length
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching platforms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platforms'
    });
  }
});

/**
 * GET /api/octopus-brain/platforms/:platformId/health
 * Get health status for a specific platform
 */
router.get('/platforms/:platformId/health', async (req: Request, res: Response) => {
  try {
    const { platformId } = req.params;
    const health = octopusBrain.getPlatformHealth(platformId);
    
    if (!health) {
      return res.status(404).json({
        success: false,
        error: `Platform ${platformId} not found`
      });
    }
    
    res.json({
      success: true,
      data: health
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching platform health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform health'
    });
  }
});

/**
 * GET /api/octopus-brain/platforms/:platformId/stamp
 * Get certification stamp for a platform
 */
router.get('/platforms/:platformId/stamp', async (req: Request, res: Response) => {
  try {
    const { platformId } = req.params;
    const stamp = octopusBrain.getCertificationStamp(platformId);
    
    if (!stamp) {
      return res.status(404).json({
        success: false,
        error: `Platform ${platformId} not found`
      });
    }
    
    res.json({
      success: true,
      platformId,
      certificationStamp: stamp,
      isValid: true,
      verifiedAt: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching certification stamp:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch certification stamp'
    });
  }
});

/**
 * GET /api/octopus-brain/health
 * Get all platforms health summary
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const allHealth = octopusBrain.getAllPlatformHealth();
    res.json({
      success: true,
      data: allHealth,
      count: allHealth.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching all health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform health data'
    });
  }
});

/**
 * GET /api/octopus-brain/alerts
 * Get platform alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { platformId, severity, limit } = req.query;
    
    const alerts = octopusBrain.getAlerts({
      platformId: platformId as string,
      severity: severity as string,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * POST /api/octopus-brain/alerts/:alertId/resolve
 * Resolve an alert (Admin only)
 */
router.post('/alerts/:alertId/resolve', requireAdmin, async (req: any, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = octopusBrain.resolveAlert(alertId);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        error: `Alert ${alertId} not found`
      });
    }

    setImmediate(() => {
      logAuditEvent({
        actorUserId: req.firebaseUser?.uid || req.adminUser?.id,
        actorRole: 'admin',
        actionType: 'OCTOPUS_ALERT_RESOLVE',
        targetType: 'octopus_alert',
        targetId: alertId,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
    });

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * POST /api/octopus-brain/analyze
 * Trigger manual Gemini AI analysis (Admin only)
 */
router.post('/analyze', requireAdmin, async (req: any, res: Response) => {
  try {
    const result = await octopusBrain.triggerManualAnalysis();

    setImmediate(() => {
      logAuditEvent({
        actorUserId: req.firebaseUser?.uid || req.adminUser?.id,
        actorRole: 'admin',
        actionType: 'OCTOPUS_MANUAL_ANALYZE',
        targetType: 'octopus_analysis',
        targetId: 'manual',
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
    });

    res.json({
      success: true,
      message: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error triggering analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger Gemini analysis'
    });
  }
});

/**
 * POST /api/octopus-brain/platforms/:platformId/certify
 * Renew platform certification (Admin only)
 */
router.post('/platforms/:platformId/certify', requireAdmin, async (req: any, res: Response) => {
  try {
    const { platformId } = req.params;
    const newStamp = await octopusBrain.renewCertification(platformId);

    setImmediate(() => {
      logAuditEvent({
        actorUserId: req.firebaseUser?.uid || req.adminUser?.id,
        actorRole: 'admin',
        actionType: 'OCTOPUS_PLATFORM_CERTIFY',
        targetType: 'octopus_platform',
        targetId: platformId,
        ip: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        // never log full stamp; first 8 chars suffice
        metadata: { stampPrefix: typeof newStamp === 'string' ? newStamp.slice(0, 8) : null },
      }).catch(() => {});
    });

    res.json({
      success: true,
      platformId,
      newCertificationStamp: newStamp,
      certifiedAt: new Date().toISOString(),
      certifiedBy: req.adminUser?.email || 'admin'
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error renewing certification:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to renew certification'
    });
  }
});

/**
 * GET /api/octopus-brain/dashboard
 * Get comprehensive dashboard data (Admin only)
 */
router.get('/dashboard', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = octopusBrain.getOverallStatus();
    const platforms = octopusBrain.getPlatformDefinitions();
    const allHealth = octopusBrain.getAllPlatformHealth();
    const alerts = octopusBrain.getAlerts({ limit: 20 });
    
    res.json({
      success: true,
      data: {
        overview: {
          overallHealth: status.overallHealth,
          platformsOnline: status.platformsOnline,
          platformsTotal: status.platformsTotal,
          geminiEnabled: status.geminiEnabled,
          lastScan: status.lastScan
        },
        platforms: platforms.map(p => ({
          ...p,
          health: allHealth.find(h => h.platformId === p.id)
        })),
        recentAlerts: alerts,
        metrics: {
          averageResponseTime: allHealth.reduce((acc, h) => acc + (h.responseTimeMs > 0 ? h.responseTimeMs : 0), 0) / allHealth.filter(h => h.responseTimeMs > 0).length || 0,
          averageUptime: allHealth.reduce((acc, h) => acc + h.uptime24h, 0) / allHealth.length,
          totalActiveUsers: allHealth.reduce((acc, h) => acc + h.activeUsers, 0)
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('[🐙 API] Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';
import { petWashStations, stationTelemetry, stationAlerts } from '@shared/schema-enterprise';
import { sql, desc, and, gte } from 'drizzle-orm';

const router = Router();

// Service uptime and health summary endpoint
router.get('/uptime', async (_req, res) => {
  try {
    const startTime = process.hrtime();
    
    // Database health check
    let dbHealth = 'healthy';
    let dbLatency = 0;
    try {
      const dbStart = process.hrtime();
      await db.execute(sql`SELECT 1`);
      const dbEnd = process.hrtime(dbStart);
      dbLatency = Math.round((dbEnd[0] * 1000 + dbEnd[1] / 1000000) * 100) / 100;
    } catch (error) {
      dbHealth = 'unhealthy';
    }

    // Get station count and health summary
    const stationStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        healthy: sql<number>`count(case when ${petWashStations.healthStatus} = 'healthy' then 1 end)::int`,
        warning: sql<number>`count(case when ${petWashStations.healthStatus} = 'warning' then 1 end)::int`,
        critical: sql<number>`count(case when ${petWashStations.healthStatus} = 'critical' then 1 end)::int`,
        offline: sql<number>`count(case when ${petWashStations.healthStatus} = 'offline' then 1 end)::int`,
        operational: sql<number>`count(case when ${petWashStations.operationalStatus} = 'active' then 1 end)::int`,
      })
      .from(petWashStations);

    const stats = stationStats[0] || {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
      operational: 0
    };

    // Get critical alerts count (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const criticalAlerts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stationAlerts)
      .where(
        and(
          sql`${stationAlerts.severity} = 'critical'`,
          sql`${stationAlerts.acknowledgedAt} IS NULL`,
          gte(stationAlerts.createdAt, twentyFourHoursAgo)
        )
      );

    const endTime = process.hrtime(startTime);
    const responseTime = Math.round((endTime[0] * 1000 + endTime[1] / 1000000) * 100) / 100;

    const isProd = process.env.REPLIT_DEPLOYMENT === '1';

    res.status(200).json({
      ok: true,
      service: 'PetWash™ Enterprise Platform',
      environment: isProd ? 'production' : 'development',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: formatUptime(process.uptime())
      },
      health: {
        database: dbHealth,
        dbLatencyMs: dbLatency,
        responseTimeMs: responseTime
      },
      stations: {
        total: stats.total,
        operational: stats.operational,
        health: {
          healthy: stats.healthy,
          warning: stats.warning,
          critical: stats.critical,
          offline: stats.offline
        },
        healthPercentage: stats.total > 0 
          ? Math.round((stats.healthy / stats.total) * 100) 
          : 100
      },
      alerts: {
        criticalUnacknowledged: criticalAlerts[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('[STATUS] Uptime check failed:', error);
    res.status(503).json({
      ok: false,
      error: 'Service health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Station health monitoring endpoint
router.get('/stations', async (_req, res) => {
  try {
    // Get all stations with their latest telemetry and health status
    const stations = await db
      .select({
        id: petWashStations.id,
        stationCode: petWashStations.stationCode,
        stationName: petWashStations.stationName,
        city: petWashStations.city,
        countryId: petWashStations.countryId,
        operationalStatus: petWashStations.operationalStatus,
        healthStatus: petWashStations.healthStatus,
        lastHeartbeat: petWashStations.lastHeartbeat,
        lastMaintenanceDate: petWashStations.lastMaintenanceDate,
        nextMaintenanceDate: petWashStations.nextMaintenanceDate,
        totalWashesCompleted: petWashStations.totalWashesCompleted,
        latitude: petWashStations.latitude,
        longitude: petWashStations.longitude,
      })
      .from(petWashStations)
      .orderBy(petWashStations.stationCode);

    // Enrich with last transaction time and offline detection
    const now = new Date();
    const enrichedStations = stations.map(station => {
      const lastHeartbeatTime = station.lastHeartbeat ? new Date(station.lastHeartbeat) : null;
      const minutesSinceHeartbeat = lastHeartbeatTime 
        ? Math.floor((now.getTime() - lastHeartbeatTime.getTime()) / 60000)
        : null;

      // Offline = no heartbeat for 30+ minutes
      const isOfflineByHeartbeat = minutesSinceHeartbeat !== null && minutesSinceHeartbeat > 30;

      return {
        ...station,
        lastHeartbeatAt: station.lastHeartbeat,
        minutesSinceHeartbeat,
        isOnline: !isOfflineByHeartbeat && station.operationalStatus === 'active',
        maintenanceStatus: getMaintenanceStatus(
          station.lastMaintenanceDate ? new Date(station.lastMaintenanceDate) : null,
          station.nextMaintenanceDate ? new Date(station.nextMaintenanceDate) : null
        )
      };
    });

    // Summary statistics
    const summary = {
      total: enrichedStations.length,
      online: enrichedStations.filter(s => s.isOnline).length,
      offline: enrichedStations.filter(s => !s.isOnline).length,
      healthBreakdown: {
        healthy: enrichedStations.filter(s => s.healthStatus === 'healthy').length,
        warning: enrichedStations.filter(s => s.healthStatus === 'warning').length,
        critical: enrichedStations.filter(s => s.healthStatus === 'critical').length,
        offline: enrichedStations.filter(s => s.healthStatus === 'offline').length,
      },
      maintenanceDue: enrichedStations.filter(
        s => s.maintenanceStatus === 'due' || s.maintenanceStatus === 'overdue'
      ).length
    };

    res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary,
      stations: enrichedStations
    });
  } catch (error) {
    console.error('[STATUS] Station health check failed:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve station health',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

// Helper function to determine maintenance status
function getMaintenanceStatus(
  lastMaintenance: Date | null,
  nextMaintenance: Date | null
): 'ok' | 'due' | 'overdue' | 'unknown' {
  if (!nextMaintenance) return 'unknown';
  
  const now = new Date();
  const daysUntilMaintenance = Math.floor(
    (new Date(nextMaintenance).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilMaintenance < 0) return 'overdue';
  if (daysUntilMaintenance <= 7) return 'due';
  return 'ok';
}

export default router;

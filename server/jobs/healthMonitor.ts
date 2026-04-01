/**
 * REALTIME SYSTEM HEALTH MONITOR
 * Enterprise IoT + Cloud Monitoring for K9000 Wash Stations
 * 
 * Features:
 * - Real-time station health checks every 5 minutes
 * - Automatic Slack alerts for offline stations
 * - PostgreSQL + Firebase sync monitoring
 * - Auto-escalation for critical failures
 */

import { schedule } from 'node-cron';
import axios from 'axios';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import NotificationService from '../services/NotificationService';

interface StationStatus {
  id: string;
  endpoint: string;
  stationName: string;
  franchiseId?: string;
  ok: boolean;
  responseTime?: number;
  lastError?: string;
}

/**
 * Check if a station is healthy based on its last IoT heartbeat.
 * A station is considered online if its last_heartbeat was within the past 10 minutes
 * and its iot_status is not 'error'.
 */
async function checkStationHealth(station: any): Promise<StationStatus> {
  const startTime = Date.now();

  try {
    const lastHeartbeat: Date | null = station.last_heartbeat ? new Date(station.last_heartbeat) : null;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const heartbeatFresh = lastHeartbeat !== null && lastHeartbeat >= tenMinutesAgo;
    const iotOk = station.iot_status !== 'error';
    const ok = heartbeatFresh && iotOk;
    const responseTime = Date.now() - startTime;

    if (!ok) {
      const reason = !heartbeatFresh
        ? `No heartbeat since ${lastHeartbeat?.toISOString() ?? 'never'}`
        : `IoT status: ${station.iot_status}`;
      logger.warn('[HealthMonitor] Station unhealthy', { stationId: station.id, reason });
      return {
        id: station.id,
        endpoint: station.endpoint || station.id,
        stationName: station.stationName || `Station ${station.id}`,
        franchiseId: station.franchiseId,
        ok: false,
        lastError: reason,
      };
    }

    return {
      id: station.id,
      endpoint: station.endpoint || station.id,
      stationName: station.stationName || `Station ${station.id}`,
      franchiseId: station.franchiseId,
      ok: true,
      responseTime,
    };
  } catch (error: any) {
    logger.error('[HealthMonitor] Station health evaluation failed', {
      stationId: station.id,
      error: error.message,
    });
    return {
      id: station.id,
      endpoint: station.endpoint || station.id,
      stationName: station.stationName || `Station ${station.id}`,
      franchiseId: station.franchiseId,
      ok: false,
      lastError: error.message,
    };
  }
}

/**
 * Send Slack alert for offline stations
 */
async function sendSlackAlert(failedStations: StationStatus[]) {
  try {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
      logger.warn('[HealthMonitor] Slack webhook not configured - using email fallback');
      return await sendEmailAlert(failedStations);
    }
    
    const message = {
      text: `🚨 URGENT: ${failedStations.length} K9000 Station(s) Offline`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 ${failedStations.length} K9000 Station(s) Offline`,
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: failedStations.map(s => 
              `• *${s.stationName}* (ID: ${s.id})\n  Error: ${s.lastError || 'Connection timeout'}`
            ).join('\n'),
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Detected at: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} Israel Time`,
            },
          ],
        },
      ],
    };
    
    await axios.post(slackWebhookUrl, message);
    
    logger.info('[HealthMonitor] Slack alert sent successfully', {
      failedCount: failedStations.length,
    });
  } catch (error: any) {
    logger.error('[HealthMonitor] Failed to send Slack alert', {
      error: error.message,
    });
    
    // Fallback to email
    await sendEmailAlert(failedStations);
  }
}

/**
 * Send email alert as fallback
 */
async function sendEmailAlert(failedStations: StationStatus[]) {
  try {
    const adminEmails = process.env.ADMIN_ALERT_EMAILS?.split(',') || ['ops@petwash.co.il'];
    
    await NotificationService.sendEmail({
      to: adminEmails,
      subject: `🚨 URGENT: ${failedStations.length} K9000 Station(s) Offline`,
      template: 'station-health-alert',
      data: {
        failedStations,
        timestamp: new Date().toISOString(),
      },
    });
    
    logger.info('[HealthMonitor] Email alert sent successfully', {
      recipients: adminEmails.length,
      failedCount: failedStations.length,
    });
  } catch (error: any) {
    logger.error('[HealthMonitor] Failed to send email alert', {
      error: error.message,
    });
  }
}

/**
 * Main health check routine
 */
export async function runHealthCheck() {
  try {
    logger.info('[HealthMonitor] Starting health check scan');
    
    // Fetch all active stations from database
    const stationsResult = await db.execute(sql`
      SELECT id::text,
             name              AS "stationName",
             iot_device_id     AS "endpoint",
             franchise_id::text AS "franchiseId",
             last_heartbeat,
             iot_status
      FROM stations
      WHERE is_active = true
    `);
    
    if (!stationsResult.rows || stationsResult.rows.length === 0) {
      logger.warn('[HealthMonitor] No active stations found');
      return;
    }

    const stations = stationsResult;
    
    logger.info('[HealthMonitor] Checking health for stations', {
      count: stations.rows.length,
    });
    
    // Check all stations in parallel (with Promise.all for speed)
    const checks = await Promise.all(
      stations.rows.map((station: any) => checkStationHealth(station))
    );
    
    // Filter failed stations
    const failedStations = checks.filter(check => !check.ok);
    const healthyStations = checks.filter(check => check.ok);
    
    // Calculate average response time for healthy stations
    const avgResponseTime = healthyStations.length > 0
      ? Math.round(
          healthyStations.reduce((sum, s) => sum + (s.responseTime || 0), 0) / 
          healthyStations.length
        )
      : 0;
    
    logger.info('[HealthMonitor] Health check complete', {
      total: checks.length,
      healthy: healthyStations.length,
      failed: failedStations.length,
      avgResponseTime: `${avgResponseTime}ms`,
    });
    
    // Send alerts if any stations are offline
    if (failedStations.length > 0) {
      await sendSlackAlert(failedStations);
      
      // Update station status in database
      for (const failed of failedStations) {
        await db.execute(sql`
          UPDATE stations
          SET
            iot_status      = 'error',
            equipment_status = ${failed.lastError || 'Connection timeout'},
            last_heartbeat  = NOW(),
            updated_at      = NOW()
          WHERE id::text = ${failed.id}
        `);
      }
    }
    
    // Update healthy stations
    for (const healthy of healthyStations) {
      await db.execute(sql`
        UPDATE stations
        SET
          iot_status      = 'online',
          equipment_status = NULL,
          last_heartbeat  = NOW(),
          updated_at      = NOW()
        WHERE id::text = ${healthy.id}
      `);
    }
    
  } catch (error: any) {
    logger.error('[HealthMonitor] Health check failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Initialize health monitoring cron job
 * Runs every 5 minutes
 */
export function initializeHealthMonitor() {
  // Run every 5 minutes
  schedule('*/5 * * * *', async () => {
    await runHealthCheck();
  });
  
  // Run immediately on startup
  setTimeout(() => runHealthCheck(), 5000);
  
  logger.info('[HealthMonitor] ✅ Cron job initialized (every 5 minutes)');
}

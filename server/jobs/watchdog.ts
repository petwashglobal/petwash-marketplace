/**
 * SELF-HEALING BACKEND WATCHDOG
 * Auto-Restart & Health Recovery System
 * 
 * Features:
 * - Health checks every 10 minutes
 * - Auto-restart on failure
 * - Escalation to ops team
 * - Self-recovery logging
 */

import { exec } from 'child_process';
import { schedule } from 'node-cron';
import axios from 'axios';
import { logger } from '../lib/logger';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HealthStatus {
  ok: boolean;
  responseTime?: number;
  error?: string;
}

/**
 * Check if server is healthy
 */
async function checkHealth(): Promise<HealthStatus> {
  try {
    const startTime = Date.now();
    const endpoint = process.env.HEALTH_CHECK_URL || 'http://localhost:5000/api/health';
    
    const response = await axios.get(endpoint, {
      timeout: 10000,
      headers: {
        'User-Agent': 'PetWash-Watchdog/1.0',
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.status === 200 && response.data?.status === 'healthy') {
      return {
        ok: true,
        responseTime,
      };
    } else {
      return {
        ok: false,
        error: `Unhealthy status: ${JSON.stringify(response.data)}`,
      };
    }
  } catch (error: any) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

/**
 * Attempt to restart the application
 */
async function restartApplication() {
  try {
    logger.warn('[Watchdog] Attempting application restart');
    
    const pm2Restart = process.env.PM2_RESTART_CMD || 'pm2 restart petwash-api';
    
    const { stdout, stderr } = await execAsync(pm2Restart);
    
    logger.info('[Watchdog] Restart command executed', {
      stdout,
      stderr,
    });
    
    // Wait 15 seconds for restart to complete
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Verify restart was successful
    const healthCheck = await checkHealth();
    
    if (healthCheck.ok) {
      logger.info('[Watchdog] ✅ Restart successful - application healthy');
      return true;
    } else {
      logger.error('[Watchdog] ❌ Restart failed - application still unhealthy', {
        error: healthCheck.error,
      });
      return false;
    }
  } catch (error: any) {
    logger.error('[Watchdog] Restart failed with exception', {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

/**
 * Escalate to ops team (critical failure)
 */
async function escalateToOps(consecutiveFailures: number, lastError: string) {
  try {
    logger.error('[Watchdog] 🚨 ESCALATING TO OPS TEAM', {
      consecutiveFailures,
      lastError,
    });
    
    // Send email alert
    const axios = require('axios');
    const opsEmail = process.env.OPS_ALERT_EMAIL || 'ops@petwash.co.il';
    
    await axios.post('http://localhost:5000/api/enterprise/alerts/send', {
      to: [opsEmail],
      subject: '🚨 CRITICAL: Pet Wash Application Down After Auto-Restart Failed',
      body: `
        The Pet Wash application has been down for ${consecutiveFailures * 10} minutes.
        
        Auto-restart attempts: FAILED
        Last error: ${lastError}
        Time: ${new Date().toISOString()}
        
        ACTION REQUIRED: Manual intervention needed immediately.
        
        Server: ${process.env.SERVER_NAME || 'production'}
        Environment: ${process.env.NODE_ENV}
      `,
    });
    
    logger.info('[Watchdog] Ops team notified');
  } catch (error: any) {
    logger.error('[Watchdog] Failed to escalate to ops', {
      error: error.message,
    });
  }
}

/**
 * Main watchdog routine
 */
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_ESCALATION = 3; // 30 minutes

export async function runWatchdog() {
  try {
    logger.info('[Watchdog] Running health check');
    
    const health = await checkHealth();
    
    if (health.ok) {
      logger.info('[Watchdog] ✅ Application healthy', {
        responseTime: `${health.responseTime}ms`,
      });
      
      // Reset failure counter
      if (consecutiveFailures > 0) {
        logger.info('[Watchdog] Application recovered - resetting failure counter', {
          previousFailures: consecutiveFailures,
        });
        consecutiveFailures = 0;
      }
    } else {
      consecutiveFailures++;
      
      logger.error('[Watchdog] ❌ Application unhealthy', {
        error: health.error,
        consecutiveFailures,
      });
      
      // Attempt auto-restart
      const restartSuccess = await restartApplication();
      
      if (!restartSuccess) {
        // Check if we need to escalate
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_ESCALATION) {
          await escalateToOps(consecutiveFailures, health.error || 'Unknown error');
        }
      } else {
        // Restart succeeded, reset counter
        consecutiveFailures = 0;
      }
    }
  } catch (error: any) {
    logger.error('[Watchdog] Watchdog check failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Initialize watchdog cron job
 * Runs every 10 minutes
 */
export function initializeWatchdog() {
  // Run every 10 minutes
  schedule('*/10 * * * *', async () => {
    await runWatchdog();
  });
  
  logger.info('[Watchdog] ✅ Cron job initialized (every 10 minutes)');
}

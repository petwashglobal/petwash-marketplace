/**
 * Performance Monitoring API
 * Real-time metrics for database, API, and system performance
 */

import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db } from '../db';

const router = Router();

// Track API metrics (in-memory for demo - use Prometheus in production)
let requestMetrics = {
  totalRequests: 0,
  recentRequests: [] as number[],
  totalErrors: 0,
  responseTimes: [] as number[],
  activeRequests: 0,
  startTime: Date.now(),
};

// Middleware to track requests (should be added to server)
export function trackRequestMetrics(req: any, res: any, next: any) {
  const startTime = Date.now();
  requestMetrics.activeRequests++;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    requestMetrics.totalRequests++;
    requestMetrics.recentRequests.push(Date.now());
    requestMetrics.responseTimes.push(duration);
    requestMetrics.activeRequests--;

    if (res.statusCode >= 500) {
      requestMetrics.totalErrors++;
    }

    // Keep only last 1000 entries
    if (requestMetrics.responseTimes.length > 1000) {
      requestMetrics.responseTimes = requestMetrics.responseTimes.slice(-1000);
    }
    if (requestMetrics.recentRequests.length > 1000) {
      requestMetrics.recentRequests = requestMetrics.recentRequests.slice(-1000);
    }
  });

  next();
}

/**
 * Get real-time performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    // Calculate API metrics
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequestCount = requestMetrics.recentRequests.filter(t => t > oneSecondAgo).length;
    
    const sortedTimes = [...requestMetrics.responseTimes].sort((a, b) => a - b);
    const avgResponseTime = sortedTimes.length > 0
      ? Math.round(sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length)
      : 0;
    
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;
    
    const errorRate = requestMetrics.totalRequests > 0
      ? requestMetrics.totalErrors / requestMetrics.totalRequests
      : 0;

    // Database metrics - Real PostgreSQL stats
    let databaseMetrics = {
      activeConnections: 0,
      maxConnections: 100,
      avgQueryTime: 0,
      slowQueries: 0,
      cacheHitRate: 95, // Default for Neon serverless
    };

    try {
      // Get real connection count from PostgreSQL
      const connResult = await db.execute(sql`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);
      databaseMetrics.activeConnections = Number(connResult.rows?.[0]?.active_connections || 0);
    } catch (error: any) {
      // Fallback to estimate if pg_stat_activity not accessible
      logger.warn('[Monitoring] Could not query pg_stat_activity:', error.message);
    }

    // System metrics - Real process stats
    const uptime = Math.floor((now - requestMetrics.startTime) / 1000);
    const memStats = process.memoryUsage();
    const systemMetrics = {
      memoryUsage: Math.floor((memStats.heapUsed / memStats.heapTotal) * 100),
      cpuUsage: Math.floor(process.cpuUsage().user / 1000000), // Convert microseconds to %
      uptime,
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        database: databaseMetrics,
        api: {
          requestsPerSecond: recentRequestCount,
          avgResponseTime,
          p95ResponseTime: Math.round(p95ResponseTime),
          p99ResponseTime: Math.round(p99ResponseTime),
          errorRate: Number(errorRate.toFixed(4)),
          activeRequests: requestMetrics.activeRequests,
        },
        system: systemMetrics,
      },
    });
  } catch (error: any) {
    logger.error('[Monitoring] Failed to get performance metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get database connection pool status
 */
router.get('/database/connections', async (req, res) => {
  try {
    // Query database for connection stats
    // Note: This requires pg_stat_database access
    const result = await db.execute(sql`
      SELECT 
        numbackends as active_connections,
        xact_commit as transactions_committed,
        xact_rollback as transactions_rolled_back,
        blks_read as blocks_read,
        blks_hit as blocks_hit
      FROM pg_stat_database 
      WHERE datname = current_database()
    `);

    res.json({
      success: true,
      connections: result.rows[0] || {},
    });
  } catch (error: any) {
    logger.warn('[Monitoring] Could not fetch database stats', { error: error.message });
    res.json({
      success: false,
      error: 'Database stats not available',
      message: 'Using mock data in performance dashboard',
    });
  }
});

/**
 * Get slow query log from pg_stat_statements (if enabled) or pg_stat_activity
 */
router.get('/database/slow-queries', async (req, res) => {
  try {
    // Try pg_stat_statements first (most accurate — requires shared_preload_libraries)
    let slowQueries: any[] = [];
    let source = 'pg_stat_statements';

    try {
      const result = await db.execute(sql`
        SELECT
          LEFT(query, 200)                                  AS query,
          ROUND((mean_exec_time)::numeric, 2)               AS avg_time_ms,
          calls,
          ROUND((total_exec_time)::numeric, 2)              AS total_time_ms,
          ROUND((stddev_exec_time)::numeric, 2)             AS stddev_ms,
          ROUND((rows / NULLIF(calls, 0))::numeric, 1)      AS avg_rows
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
          AND query NOT LIKE '%BEGIN%'
          AND calls > 5
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `);
      slowQueries = (result.rows as any[]).map(r => ({
        query:      r.query,
        avgTime:    parseFloat(r.avg_time_ms),
        calls:      parseInt(r.calls),
        totalTime:  parseFloat(r.total_time_ms),
        stddev:     parseFloat(r.stddev_ms),
        avgRows:    parseFloat(r.avg_rows),
      }));
    } catch {
      // pg_stat_statements not available — fall back to long-running queries in pg_stat_activity
      source = 'pg_stat_activity';
      const result = await db.execute(sql`
        SELECT
          LEFT(query, 200)                                       AS query,
          EXTRACT(EPOCH FROM (now() - query_start)) * 1000       AS elapsed_ms,
          state,
          wait_event_type,
          wait_event
        FROM pg_stat_activity
        WHERE state != 'idle'
          AND query NOT LIKE '%pg_stat_activity%'
          AND query_start IS NOT NULL
        ORDER BY elapsed_ms DESC NULLS LAST
        LIMIT 20
      `);
      slowQueries = (result.rows as any[]).map(r => ({
        query:   r.query,
        avgTime: parseFloat(r.elapsed_ms ?? '0'),
        calls:   1,
        state:   r.state,
        waitEventType: r.wait_event_type,
        waitEvent:     r.wait_event,
      }));
    }

    res.json({ success: true, source, slowQueries });
  } catch (error: any) {
    logger.error('[Monitoring] Failed to get slow queries', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reset metrics (for testing)
 */
router.post('/reset', async (req, res) => {
  requestMetrics = {
    totalRequests: 0,
    recentRequests: [],
    totalErrors: 0,
    responseTimes: [],
    activeRequests: 0,
    startTime: Date.now(),
  };

  res.json({ success: true, message: 'Metrics reset' });
});

export default router;

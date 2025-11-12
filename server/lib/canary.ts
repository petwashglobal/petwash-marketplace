import { alertManager } from './alerts';
import { metricsRegistry } from './metrics';
import { logger } from './logger';

export interface HealthCheckResult {
  name: string;
  passed: boolean;
  latency?: number;
  error?: string;
}

export interface DeploymentHealth {
  timestamp: string;
  healthz: boolean;
  readiness: boolean;
  authSuccessRate: number;
  errorRate: number;
  p95Latency: number;
  checks: HealthCheckResult[];
  canaryPassed: boolean;
  shouldRollback: boolean;
  reason?: string;
}

const HEALTH_CHECK_CONFIG = {
  authSuccessRateThreshold: 0.98, // 98%
  errorRateThreshold: 0.01, // 1%
  p95LatencyThreshold: 2000, // 2 seconds
  consecutiveFailuresThreshold: 2,
};

let consecutiveHealthFailures = 0;
let consecutiveReadinessFailures = 0;

/**
 * Check /healthz endpoint
 */
async function checkHealthz(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const response = await fetch('http://localhost:5000/healthz');
    const passed = response.ok;
    
    if (!passed) {
      consecutiveHealthFailures++;
    } else {
      consecutiveHealthFailures = 0;
    }

    return {
      name: 'healthz',
      passed,
      latency: Date.now() - start,
      error: passed ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    consecutiveHealthFailures++;
    return {
      name: 'healthz',
      passed: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check /readiness endpoint
 */
async function checkReadiness(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const response = await fetch('http://localhost:5000/readiness');
    const passed = response.ok;
    
    if (!passed) {
      consecutiveReadinessFailures++;
    } else {
      consecutiveReadinessFailures = 0;
    }

    return {
      name: 'readiness',
      passed,
      latency: Date.now() - start,
      error: passed ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    consecutiveReadinessFailures++;
    return {
      name: 'readiness',
      passed: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get auth success rate from metrics
 */
async function getAuthSuccessRate(): Promise<number> {
  try {
    const metrics = await metricsRegistry.getMetricsAsJSON();
    
    const successMetric = metrics.find(m => m.name === 'auth_success_total');
    const errorMetric = metrics.find(m => m.name === 'auth_errors_total');
    
    const totalSuccess = successMetric?.values?.reduce((sum, v) => sum + (v.value || 0), 0) || 0;
    const totalErrors = errorMetric?.values?.reduce((sum, v) => sum + (v.value || 0), 0) || 0;
    const total = totalSuccess + totalErrors;
    
    if (total === 0) return 1.0; // No data = assume healthy
    
    return totalSuccess / total;
  } catch (error) {
    logger.error('[Canary] Failed to get auth success rate', error);
    return 1.0; // Assume healthy on error
  }
}

/**
 * Get overall error rate from metrics
 */
async function getErrorRate(): Promise<number> {
  try {
    const metrics = await metricsRegistry.getMetricsAsJSON();
    
    const requestsMetric = metrics.find(m => m.name === 'http_requests_total');
    
    if (!requestsMetric?.values) return 0;
    
    let totalRequests = 0;
    let errorRequests = 0;
    
    requestsMetric.values.forEach((v: any) => {
      const statusCode = parseInt(v.labels?.status_code || '200');
      const value = v.value || 0;
      
      totalRequests += value;
      if (statusCode >= 500) {
        errorRequests += value;
      }
    });
    
    if (totalRequests === 0) return 0;
    
    return errorRequests / totalRequests;
  } catch (error) {
    logger.error('[Canary] Failed to get error rate', error);
    return 0;
  }
}

/**
 * Get p95 latency from metrics
 */
async function getP95Latency(): Promise<number> {
  try {
    const metrics = await metricsRegistry.getMetricsAsJSON();
    
    const latencyMetric = metrics.find(m => m.name === 'http_request_duration_ms');
    
    if (!latencyMetric?.values) return 0;
    
    // Extract latency values
    const latencies: number[] = [];
    latencyMetric.values.forEach((v: any) => {
      if (v.value) latencies.push(v.value);
    });
    
    if (latencies.length === 0) return 0;
    
    // Calculate p95
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    
    return latencies[p95Index] || 0;
  } catch (error) {
    logger.error('[Canary] Failed to get p95 latency', error);
    return 0;
  }
}

/**
 * Run canary deployment checks
 */
export async function runCanaryChecks(): Promise<DeploymentHealth> {
  const checks: HealthCheckResult[] = [];
  
  // Run health checks
  const healthzResult = await checkHealthz();
  const readinessResult = await checkReadiness();
  
  checks.push(healthzResult, readinessResult);
  
  // Get metrics
  const authSuccessRate = await getAuthSuccessRate();
  const errorRate = await getErrorRate();
  const p95Latency = await getP95Latency();
  
  // Determine if canary passed
  const canaryPassed = 
    healthzResult.passed &&
    readinessResult.passed &&
    authSuccessRate >= HEALTH_CHECK_CONFIG.authSuccessRateThreshold &&
    errorRate <= HEALTH_CHECK_CONFIG.errorRateThreshold &&
    p95Latency <= HEALTH_CHECK_CONFIG.p95LatencyThreshold;
  
  // Determine if should rollback
  const shouldRollback =
    consecutiveHealthFailures >= HEALTH_CHECK_CONFIG.consecutiveFailuresThreshold ||
    consecutiveReadinessFailures >= HEALTH_CHECK_CONFIG.consecutiveFailuresThreshold ||
    authSuccessRate < HEALTH_CHECK_CONFIG.authSuccessRateThreshold ||
    errorRate > HEALTH_CHECK_CONFIG.errorRateThreshold ||
    p95Latency > HEALTH_CHECK_CONFIG.p95LatencyThreshold;
  
  let reason: string | undefined;
  if (shouldRollback) {
    if (consecutiveHealthFailures >= 2) {
      reason = `Health check failed ${consecutiveHealthFailures} times consecutively`;
    } else if (consecutiveReadinessFailures >= 2) {
      reason = `Readiness check failed ${consecutiveReadinessFailures} times consecutively`;
    } else if (authSuccessRate < HEALTH_CHECK_CONFIG.authSuccessRateThreshold) {
      reason = `Auth success rate ${(authSuccessRate * 100).toFixed(1)}% below threshold ${HEALTH_CHECK_CONFIG.authSuccessRateThreshold * 100}%`;
    } else if (errorRate > HEALTH_CHECK_CONFIG.errorRateThreshold) {
      reason = `Error rate ${(errorRate * 100).toFixed(1)}% above threshold ${HEALTH_CHECK_CONFIG.errorRateThreshold * 100}%`;
    } else if (p95Latency > HEALTH_CHECK_CONFIG.p95LatencyThreshold) {
      reason = `P95 latency ${p95Latency}ms above threshold ${HEALTH_CHECK_CONFIG.p95LatencyThreshold}ms`;
    }
  }
  
  const health: DeploymentHealth = {
    timestamp: new Date().toISOString(),
    healthz: healthzResult.passed,
    readiness: readinessResult.passed,
    authSuccessRate,
    errorRate,
    p95Latency,
    checks,
    canaryPassed,
    shouldRollback,
    reason,
  };
  
  // Send alert if rollback needed
  if (shouldRollback && reason) {
    await alertManager.triggerAlert({
      name: 'canary_deployment_failed',
      message: `🚨 CANARY DEPLOYMENT FAILED - ROLLBACK REQUIRED: ${reason}`,
      severity: 'critical',
      timestamp: new Date(),
      metadata: {
        type: 'deployment',
        action: 'rollback_required',
        auth_success_rate: authSuccessRate.toString(),
        error_rate: errorRate.toString(),
        p95_latency: p95Latency.toString(),
      },
    });
  }
  
  return health;
}

/**
 * Monitor canary deployment over time window
 */
export async function monitorCanaryDeployment(durationMs: number = 300000): Promise<boolean> {
  logger.info('[Canary] Starting canary monitoring', { durationSeconds: durationMs / 1000 });
  
  const startTime = Date.now();
  const checkInterval = 30000; // 30 seconds
  
  while (Date.now() - startTime < durationMs) {
    const health = await runCanaryChecks();
    
    logger.info('[Canary] Health check', {
      canaryPassed: health.canaryPassed,
      shouldRollback: health.shouldRollback,
      authSuccessRate: `${(health.authSuccessRate * 100).toFixed(1)}%`,
      errorRate: `${(health.errorRate * 100).toFixed(1)}%`,
      p95Latency: `${health.p95Latency}ms`,
    });
    
    if (health.shouldRollback) {
      logger.error('[Canary] ROLLBACK TRIGGERED', { reason: health.reason });
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  logger.info('[Canary] Monitoring complete - deployment healthy');
  return true;
}

/**
 * Reset failure counters (call after successful rollback)
 */
export function resetCanaryCounters(): void {
  consecutiveHealthFailures = 0;
  consecutiveReadinessFailures = 0;
  logger.info('[Canary] Counters reset');
}

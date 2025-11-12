import { Router } from 'express';
import { metricsRegistry } from '../lib/metrics';
import type { Request, Response } from 'express';

const router = Router();

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    const metrics = await metricsRegistry.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

router.get('/health/metrics-summary', async (req: Request, res: Response) => {
  try {
    const metrics = await metricsRegistry.getMetricsAsJSON();
    
    const summary = {
      timestamp: new Date().toISOString(),
      service: 'Pet Wash API',
      environment: process.env.NODE_ENV || 'development',
      metrics: {
        auth: {
          total_success: getMetricValue(metrics, 'auth_success_total'),
          total_errors: getMetricValue(metrics, 'auth_errors_total'),
          avg_latency_ms: getMetricValue(metrics, 'auth_latency_ms', 'avg')
        },
        http: {
          total_requests: getMetricValue(metrics, 'http_requests_total'),
          avg_duration_ms: getMetricValue(metrics, 'http_request_duration_ms', 'avg'),
        },
        firestore: {
          total_operations: getMetricValue(metrics, 'firestore_operations_total'),
          avg_latency_ms: getMetricValue(metrics, 'firestore_latency_ms', 'avg')
        },
        nayax: {
          total_transactions: getMetricValue(metrics, 'nayax_transactions_total'),
          total_webhooks: getMetricValue(metrics, 'nayax_webhooks_total')
        },
        stations: {
          current_statuses: getStationStatuses(metrics)
        },
        cron: {
          total_errors: getMetricValue(metrics, 'cron_job_errors_total')
        }
      }
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate metrics summary' });
  }
});

function getMetricValue(metrics: any[], metricName: string, aggregation: 'sum' | 'avg' = 'sum'): number {
  const metric = metrics.find(m => m.name === metricName);
  if (!metric || !metric.values) return 0;
  
  if (aggregation === 'sum') {
    return metric.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
  }
  
  if (aggregation === 'avg' && metric.type === 'histogram') {
    const sum = metric.values.find((v: any) => v.metricName === `${metricName}_sum`)?.value || 0;
    const count = metric.values.find((v: any) => v.metricName === `${metricName}_count`)?.value || 1;
    return sum / count;
  }
  
  return 0;
}

function getStationStatuses(metrics: any[]): Record<string, any> {
  const stationMetric = metrics.find(m => m.name === 'station_status');
  if (!stationMetric || !stationMetric.values) return {};
  
  const statuses: Record<string, any> = {};
  const statusMap: Record<number, string> = {
    0: 'offline',
    1: 'idle', 
    2: 'warning_low_activity',
    3: 'fault',
    4: 'maintenance',
    5: 'online'
  };
  
  stationMetric.values.forEach((v: any) => {
    if (v.labels && v.labels.station_id) {
      statuses[v.labels.station_id] = {
        status: statusMap[v.value] || 'unknown',
        location: v.labels.location || 'unknown'
      };
    }
  });
  
  return statuses;
}

export default router;

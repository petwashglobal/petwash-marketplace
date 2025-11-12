import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
  app: 'petwash',
  environment: process.env.NODE_ENV || 'development'
});

export const authErrorCounter = new Counter({
  name: 'auth_errors_total',
  help: 'Total number of authentication errors',
  labelNames: ['error_code', 'provider', 'method'],
  registers: [metricsRegistry]
});

export const authSuccessCounter = new Counter({
  name: 'auth_success_total',
  help: 'Total number of successful authentications',
  labelNames: ['provider', 'method'],
  registers: [metricsRegistry]
});

export const authLatencyHistogram = new Histogram({
  name: 'auth_latency_ms',
  help: 'Authentication request latency in milliseconds',
  labelNames: ['provider', 'method'],
  buckets: [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000],
  registers: [metricsRegistry]
});

export const firestoreOperationCounter = new Counter({
  name: 'firestore_operations_total',
  help: 'Total number of Firestore operations',
  labelNames: ['operation', 'collection', 'status'],
  registers: [metricsRegistry]
});

export const firestoreLatencyHistogram = new Histogram({
  name: 'firestore_latency_ms',
  help: 'Firestore operation latency in milliseconds',
  labelNames: ['operation', 'collection'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000],
  registers: [metricsRegistry]
});

export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry]
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  registers: [metricsRegistry]
});

export const activeConnectionsGauge = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [metricsRegistry]
});

export const nayaxTransactionCounter = new Counter({
  name: 'nayax_transactions_total',
  help: 'Total number of Nayax transactions',
  labelNames: ['status', 'station_id'],
  registers: [metricsRegistry]
});

export const nayaxWebhookCounter = new Counter({
  name: 'nayax_webhooks_total',
  help: 'Total number of Nayax webhook events',
  labelNames: ['event_type', 'status'],
  registers: [metricsRegistry]
});

export const voucherRedemptionCounter = new Counter({
  name: 'voucher_redemptions_total',
  help: 'Total number of voucher redemptions',
  labelNames: ['voucher_type', 'status'],
  registers: [metricsRegistry]
});

export const emailSentCounter = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['template', 'status'],
  registers: [metricsRegistry]
});

export const cronJobDuration = new Histogram({
  name: 'cron_job_duration_ms',
  help: 'Cron job execution duration in milliseconds',
  labelNames: ['job_name'],
  buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
  registers: [metricsRegistry]
});

export const cronJobErrorCounter = new Counter({
  name: 'cron_job_errors_total',
  help: 'Total number of cron job errors',
  labelNames: ['job_name'],
  registers: [metricsRegistry]
});

export const stationStatusGauge = new Gauge({
  name: 'station_status',
  help: 'Current status of K9000 stations (0=offline, 1=idle, 2=warning, 3=fault, 4=maintenance, 5=online)',
  labelNames: ['station_id', 'location'],
  registers: [metricsRegistry]
});

export const stationUptimeGauge = new Gauge({
  name: 'station_uptime_percent',
  help: 'Station uptime percentage over last 24 hours',
  labelNames: ['station_id'],
  registers: [metricsRegistry]
});

export function trackAuthError(errorCode: string, provider: string = 'email', method: string = 'password') {
  authErrorCounter.inc({ error_code: errorCode, provider, method });
}

export function trackAuthSuccess(provider: string = 'email', method: string = 'password') {
  authSuccessCounter.inc({ provider, method });
}

export function trackAuthLatency(latencyMs: number, provider: string = 'email', method: string = 'password') {
  authLatencyHistogram.observe({ provider, method }, latencyMs);
}

export function trackFirestoreOperation(
  operation: 'read' | 'write' | 'delete' | 'query',
  collection: string,
  status: 'success' | 'error',
  latencyMs?: number
) {
  firestoreOperationCounter.inc({ operation, collection, status });
  if (latencyMs !== undefined) {
    firestoreLatencyHistogram.observe({ operation, collection }, latencyMs);
  }
}

export function trackHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
) {
  httpRequestCounter.inc({ method, route, status_code: statusCode.toString() });
  httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, durationMs);
}

export function setActiveConnections(count: number) {
  activeConnectionsGauge.set(count);
}

export function trackNayaxTransaction(status: string, stationId: string) {
  nayaxTransactionCounter.inc({ status, station_id: stationId });
}

export function trackNayaxWebhook(eventType: string, status: 'success' | 'error') {
  nayaxWebhookCounter.inc({ event_type: eventType, status });
}

export function trackVoucherRedemption(voucherType: string, status: 'success' | 'error') {
  voucherRedemptionCounter.inc({ voucher_type: voucherType, status });
}

export function trackEmailSent(template: string, status: 'success' | 'error') {
  emailSentCounter.inc({ template, status });
}

export function trackCronJob(jobName: string, durationMs: number, error?: Error) {
  cronJobDuration.observe({ job_name: jobName }, durationMs);
  if (error) {
    cronJobErrorCounter.inc({ job_name: jobName });
  }
}

export function setStationStatus(
  stationId: string,
  location: string,
  status: 'offline' | 'idle' | 'warning_low_activity' | 'fault' | 'maintenance' | 'online'
) {
  const statusMap = {
    offline: 0,
    idle: 1,
    warning_low_activity: 2,
    fault: 3,
    maintenance: 4,
    online: 5
  };
  stationStatusGauge.set({ station_id: stationId, location }, statusMap[status]);
}

export function setStationUptime(stationId: string, uptimePercent: number) {
  stationUptimeGauge.set({ station_id: stationId }, uptimePercent);
}

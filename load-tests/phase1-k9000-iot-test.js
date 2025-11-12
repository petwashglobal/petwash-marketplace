/**
 * Phase 1 Load Test: K9000 IoT Monitoring
 * Tests K9000 station monitoring, telemetry, and control endpoints
 * Target: 50 requests/second (IoT polling)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Test 1: Get all K9000 stations status
  const statusRes = http.get(`${BASE_URL}/api/k9000/stations/status`);
  check(statusRes, {
    'K9000 status endpoint responds': (r) => r.status < 500,
    'Response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 2: Get station telemetry
  const telemetryRes = http.get(`${BASE_URL}/api/k9000/telemetry`);
  check(telemetryRes, {
    'Telemetry endpoint responds': (r) => r.status < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 3: Get supply reports
  const supplyRes = http.get(`${BASE_URL}/api/k9000/supplies`);
  check(supplyRes, {
    'Supply reports endpoint responds': (r) => r.status < 500,
  }) || errorRate.add(1);

  sleep(1.5);
}

export function handleSummary(data) {
  return {
    'results/phase1-k9000-results.json': JSON.stringify(data, null, 2),
  };
}

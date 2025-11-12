/**
 * Phase 1 Load Test: Payment Processing
 * Tests Nayax integration and payment endpoints
 * Target: 50 requests/second (payments are more resource-intensive)
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
    http_req_duration: ['p(95)<1000'], // Payments can take up to 1s
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Test 1: Get payment configuration
  const configRes = http.get(`${BASE_URL}/api/nayax-payments/config`);
  check(configRes, {
    'Payment config endpoint responds': (r) => r.status < 500,
    'Response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Verify loyalty points endpoint
  const loyaltyRes = http.get(`${BASE_URL}/api/loyalty/tiers`);
  check(loyaltyRes, {
    'Loyalty tiers endpoint responds': (r) => r.status < 500,
  }) || errorRate.add(1);

  sleep(1.5);
}

export function handleSummary(data) {
  return {
    'results/phase1-payments-results.json': JSON.stringify(data, null, 2),
  };
}

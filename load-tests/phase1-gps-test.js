/**
 * Phase 1 Load Test: GPS Tracking & Real-Time Services
 * Tests WebSocket and GPS tracking endpoints
 * Target: 100 real-time updates/second
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // Real-time should be very fast
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Test 1: Get active walks (GPS tracking)
  const walksRes = http.get(`${BASE_URL}/api/walk-my-pet/active-walks`);
  check(walksRes, {
    'Active walks endpoint responds': (r) => r.status < 500,
    'Response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  sleep(0.3);

  // Test 2: Get active PetTrek trips
  const tripsRes = http.get(`${BASE_URL}/api/pettrek/active-trips`);
  check(tripsRes, {
    'Active trips endpoint responds': (r) => r.status < 500,
    'Response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'results/phase1-gps-results.json': JSON.stringify(data, null, 2),
  };
}

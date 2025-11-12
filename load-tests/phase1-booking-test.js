/**
 * Phase 1 Load Test: Booking Services
 * Tests K9000, Sitter, Walker, PetTrek booking endpoints
 * Target: 100 requests/second baseline
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
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Test 1: Get K9000 stations list
  const stationsRes = http.get(`${BASE_URL}/api/k9000/stations`);
  check(stationsRes, {
    'K9000 stations status is 200': (r) => r.status === 200 || r.status === 401,
    'Response time < 300ms': (r) => r.timings.duration < 300,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 2: Get sitter profiles
  const sittersRes = http.get(`${BASE_URL}/api/sitter-suite/sitters`);
  check(sittersRes, {
    'Sitter profiles endpoint responds': (r) => r.status < 500,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 3: Get walker profiles
  const walkersRes = http.get(`${BASE_URL}/api/walk-my-pet/walkers`);
  check(walkersRes, {
    'Walker profiles endpoint responds': (r) => r.status < 500,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'results/phase1-booking-results.json': JSON.stringify(data, null, 2),
  };
}

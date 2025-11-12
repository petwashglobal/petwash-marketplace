/**
 * Phase 1 Load Test: Authentication Service
 * Tests Firebase Auth configuration and session endpoints
 * Target: 100 requests/second baseline
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },  // Ramp up to 20 users
    { duration: '3m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    // Note: We use custom 'errors' metric instead of http_req_failed
    // because admin endpoint correctly returns 401 (not a real error)
    errors: ['rate<0.05'], // Real errors (check failures) should be under 5%
    checks: ['rate>0.95'], // 95% of checks should pass
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Test 1: Get Firebase configuration
  const configRes = http.get(`${BASE_URL}/api/config/firebase`, {
    tags: { name: 'get_firebase_config' },
  });
  
  const configChecks = check(configRes, {
    'Firebase config status is 200': (r) => r.status === 200,
    'Firebase config has apiKey': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.apiKey !== undefined;
      } catch (e) {
        return false;
      }
    },
    'Response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  // Track error: add 1 if checks failed, add 0 if checks passed
  errorRate.add(!configChecks);

  sleep(0.5);

  // Test 2: Check admin test endpoint (should require auth)
  // Mark this as expectedStatus:401 so it's not counted as a failure
  const adminRes = http.get(`${BASE_URL}/api/auth/firebase-admin-test`, {
    tags: { name: 'admin_auth_check', expectedStatus: '401' },
  });
  const adminCheckPassed = check(adminRes, {
    'Admin test returns 401 without auth': (r) => r.status === 401,
  });
  // Track error: add 1 if checks failed, add 0 if checks passed
  errorRate.add(!adminCheckPassed);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'results/phase1-auth-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n' + indent + '=== Phase 1: Auth Service Load Test Results ===\n\n';
  
  if (data.metrics.http_req_duration) {
    summary += indent + `HTTP Request Duration:\n`;
    summary += indent + `  avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
    summary += indent + `  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += indent + `  max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;
  }
  
  if (data.metrics.http_reqs) {
    summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
    summary += indent + `Requests/sec: ${data.metrics.http_reqs.values.rate.toFixed(2)}\n\n`;
  }
  
  if (data.metrics.http_req_failed) {
    const failRate = (data.metrics.http_req_failed.values.rate * 100).toFixed(2);
    summary += indent + `HTTP Failures: ${failRate}% (includes expected 401 responses)\n\n`;
  }
  
  // Use custom 'errors' metric for pass/fail (only tracks real check failures)
  const realErrorRate = data.metrics.errors ? data.metrics.errors.values.rate : 1;
  const checksPassRate = data.metrics.checks ? data.metrics.checks.values.rate : 0;
  const testPassed = realErrorRate < 0.05 && checksPassRate > 0.95;
  
  summary += indent + `Real Error Rate: ${(realErrorRate * 100).toFixed(2)}%\n`;
  summary += indent + `Checks Pass Rate: ${(checksPassRate * 100).toFixed(2)}%\n\n`;
  summary += indent + '=== Test ' + (testPassed ? 'PASSED ✅' : 'FAILED ❌') + ' ===\n';
  
  return summary;
}

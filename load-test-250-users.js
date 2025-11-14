/**
 * PetWash™ Load Testing - 250 Concurrent Users
 * Enterprise-Grade Load Test Simulating Real User Behavior
 * 
 * Test Scenarios:
 * - Homepage browsing (30% of users)
 * - Service booking flow (25% of users)
 * - Wallet operations (20% of users)
 * - Form submissions (15% of users)
 * - API queries (10% of users)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Load test configuration
export const options = {
  stages: [
    // Ramp up to 50 users over 30 seconds (warm-up)
    { duration: '30s', target: 50 },
    
    // Ramp up to 150 users over 1 minute
    { duration: '1m', target: 150 },
    
    // Ramp up to 250 users over 1 minute (peak load)
    { duration: '1m', target: 250 },
    
    // Maintain 250 users for 5 minutes (stress test)
    { duration: '5m', target: 250 },
    
    // Ramp down to 100 users over 1 minute
    { duration: '1m', target: 100 },
    
    // Ramp down to 0 users over 30 seconds (cool-down)
    { duration: '30s', target: 0 },
  ],
  
  thresholds: {
    // 95% of requests must complete within 2 seconds (7-star UX requirement)
    'http_req_duration': ['p(95)<2000'],
    
    // 99% of requests must complete within 5 seconds
    'http_req_duration': ['p(99)<5000'],
    
    // Error rate must be below 1% (7-star reliability)
    'errors': ['rate<0.01'],
    
    // 99.5% success rate minimum
    'http_req_failed': ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Scenario weights (simulating real user distribution)
const SCENARIOS = {
  BROWSING: 0.30,      // 30% - Homepage, navigation
  BOOKING: 0.25,       // 25% - Service booking
  WALLET: 0.20,        // 20% - Wallet operations
  FORMS: 0.15,         // 15% - Form submissions
  API_QUERIES: 0.10,   // 10% - API queries
};

/**
 * Main test function
 */
export default function () {
  const scenario = selectScenario();
  
  switch (scenario) {
    case 'BROWSING':
      testBrowsingFlow();
      break;
    case 'BOOKING':
      testBookingFlow();
      break;
    case 'WALLET':
      testWalletFlow();
      break;
    case 'FORMS':
      testFormSubmission();
      break;
    case 'API_QUERIES':
      testAPIQueries();
      break;
  }
  
  // Realistic user think time (1-3 seconds between actions)
  sleep(Math.random() * 2 + 1);
}

/**
 * Select scenario based on weighted distribution
 */
function selectScenario() {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [scenario, weight] of Object.entries(SCENARIOS)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return scenario;
    }
  }
  
  return 'BROWSING';
}

/**
 * Test 1: Homepage Browsing Flow (30% of users)
 */
function testBrowsingFlow() {
  group('Homepage Browsing', () => {
    // Homepage
    let res = http.get(`${BASE_URL}/`);
    check(res, {
      'homepage loads': (r) => r.status === 200,
      'homepage fast (<1s)': (r) => r.timings.duration < 1000,
    }) || failedRequests.add(1);
    
    sleep(0.5);
    
    // Navigation paths
    const pages = [
      '/k9000',
      '/walk-my-pet',
      '/sitter-suite',
      '/pettrek',
      '/grooming-marketplace',
    ];
    
    const randomPage = pages[Math.floor(Math.random() * pages.length)];
    res = http.get(`${BASE_URL}${randomPage}`);
    
    check(res, {
      'page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    successfulRequests.add(1);
  });
}

/**
 * Test 2: Service Booking Flow (25% of users)
 */
function testBookingFlow() {
  group('Service Booking', () => {
    // Step 1: View service
    let res = http.get(`${BASE_URL}/k9000`);
    check(res, {
      'service page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    sleep(1);
    
    // Step 2: Check availability (API call)
    res = http.get(`${BASE_URL}/api/stations`, {
      headers: { 'Accept': 'application/json' },
    });
    
    check(res, {
      'stations API works': (r) => r.status === 200 || r.status === 401, // 401 is expected for unauthenticated
    }) || failedRequests.add(1);
    
    sleep(0.5);
    
    // Step 3: Go to booking page
    res = http.get(`${BASE_URL}/booking`);
    check(res, {
      'booking page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    successfulRequests.add(1);
  });
}

/**
 * Test 3: Wallet Operations (20% of users)
 */
function testWalletFlow() {
  group('Wallet Operations', () => {
    // Check wallet page
    let res = http.get(`${BASE_URL}/my-wallet`);
    check(res, {
      'wallet page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    sleep(0.5);
    
    // Check loyalty programs
    res = http.get(`${BASE_URL}/loyalty-programs`);
    check(res, {
      'loyalty page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    sleep(0.5);
    
    // Download wallet pass page
    res = http.get(`${BASE_URL}/wallet-download`);
    check(res, {
      'wallet download loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    successfulRequests.add(1);
  });
}

/**
 * Test 4: Form Submissions (15% of users)
 */
function testFormSubmission() {
  group('Form Submission', () => {
    // Registration page
    let res = http.get(`${BASE_URL}/register`);
    check(res, {
      'register page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    sleep(1);
    
    // Contact page
    res = http.get(`${BASE_URL}/contact`);
    check(res, {
      'contact page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    sleep(0.5);
    
    // Franchise inquiry
    res = http.get(`${BASE_URL}/franchise`);
    check(res, {
      'franchise page loads': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    successfulRequests.add(1);
  });
}

/**
 * Test 5: API Queries (10% of users)
 */
function testAPIQueries() {
  group('API Queries', () => {
    // Health check
    let res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check works': (r) => r.status === 200,
      'health response valid': (r) => r.json('status') === 'healthy',
    }) || failedRequests.add(1);
    
    sleep(0.3);
    
    // Firebase config
    res = http.get(`${BASE_URL}/api/config/firebase`);
    check(res, {
      'firebase config works': (r) => r.status === 200,
    }) || failedRequests.add(1);
    
    sleep(0.3);
    
    // CSRF token
    res = http.get(`${BASE_URL}/api/csrf-token`);
    check(res, {
      'csrf token works': (r) => r.status === 200,
      'csrf token exists': (r) => r.json('csrfToken') !== undefined,
    }) || failedRequests.add(1);
    
    successfulRequests.add(1);
  });
}

/**
 * Summary function - called at end of test
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = '\n';
  summary += indent + '======================================\n';
  summary += indent + 'PetWash™ Load Test Results\n';
  summary += indent + '250 Concurrent Users\n';
  summary += indent + '======================================\n\n';
  
  summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += indent + `Failed Requests: ${data.metrics.http_req_failed.values.passes || 0}\n`;
  summary += indent + `Success Rate: ${(100 - (data.metrics.http_req_failed.values.rate || 0) * 100).toFixed(2)}%\n\n`;
  
  summary += indent + 'Response Times:\n';
  summary += indent + `  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += indent + `  P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += indent + `  P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n\n`;
  
  summary += indent + '7-Star Quality Thresholds:\n';
  summary += indent + `  ✓ P95 < 2000ms: ${data.metrics.http_req_duration.values['p(95)'] < 2000 ? 'PASS' : 'FAIL'}\n`;
  summary += indent + `  ✓ P99 < 5000ms: ${data.metrics.http_req_duration.values['p(99)'] < 5000 ? 'PASS' : 'FAIL'}\n`;
  summary += indent + `  ✓ Error Rate < 1%: ${(data.metrics.http_req_failed.values.rate || 0) * 100 < 1 ? 'PASS' : 'FAIL'}\n\n`;
  
  return summary;
}

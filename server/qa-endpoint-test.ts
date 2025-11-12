/**
 * Deep QA Endpoint Testing Suite
 * Comprehensive testing of all Pet Wash™ API endpoints
 */

import { logger } from './lib/logger';

interface EndpointTest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  category: string;
  requiresAuth: boolean;
  payload?: any;
  expectedStatus?: number[];
}

interface TestResult {
  endpoint: string;
  method: string;
  category: string;
  status: number;
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: string;
}

const CRITICAL_ENDPOINTS: EndpointTest[] = [
  // Authentication & Config
  { method: 'GET', path: '/api/config/firebase', category: 'Config', requiresAuth: false, expectedStatus: [200] },
  { method: 'GET', path: '/api/simple-auth/me', category: 'Auth', requiresAuth: false, expectedStatus: [401, 200] },
  
  // Core Business
  { method: 'GET', path: '/api/packages', category: 'Packages', requiresAuth: false, expectedStatus: [200, 304] },
  { method: 'GET', path: '/api/consent', category: 'Compliance', requiresAuth: false, expectedStatus: [200, 304] },
  { method: 'GET', path: '/api/loyalty/tiers', category: 'Loyalty', requiresAuth: false, expectedStatus: [200] },
  
  // Luxury Documents (NEW)
  { method: 'GET', path: '/api/luxury-documents/backup-report', category: 'Luxury Docs', requiresAuth: false, expectedStatus: [200] },
  
  // K9000 IoT Stations
  { method: 'GET', path: '/api/admin/stations/list', category: 'Stations', requiresAuth: true, expectedStatus: [200, 401] },
  { method: 'GET', path: '/api/admin/health/system', category: 'Health', requiresAuth: true, expectedStatus: [200, 401] },
  
  // Services
  { method: 'GET', path: '/api/sitter-suite/bookings', category: 'Sitter Suite', requiresAuth: true, expectedStatus: [200, 401] },
  { method: 'GET', path: '/api/walk-my-pet/bookings', category: 'Walk My Pet', requiresAuth: true, expectedStatus: [200, 401] },
  { method: 'GET', path: '/api/pettrek/rides', category: 'PetTrek', requiresAuth: true, expectedStatus: [200, 401] },
  
  // AI & Analytics
  { method: 'GET', path: '/api/recaptcha/verify', category: 'Security', requiresAuth: false, expectedStatus: [400, 200] },
  { method: 'GET', path: '/api/status', category: 'Status', requiresAuth: false, expectedStatus: [200] },
  
  // Messaging
  { method: 'GET', path: '/api/messaging/whatsapp/status', category: 'WhatsApp', requiresAuth: true, expectedStatus: [200, 401] },
  
  // Enterprise
  { method: 'GET', path: '/api/enterprise/compliance/status', category: 'Enterprise', requiresAuth: true, expectedStatus: [200, 401] },
  
  // Google Services
  { method: 'GET', path: '/api/google/maps/status', category: 'Google Maps', requiresAuth: false, expectedStatus: [200] },
  
  // ITA Integration
  { method: 'GET', path: '/api/ita/status', category: 'Israeli Tax', requiresAuth: true, expectedStatus: [200, 401] },
];

class EndpointQATester {
  private results: TestResult[] = [];
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:5000') {
    this.baseURL = baseURL;
  }

  /**
   * Test a single endpoint
   */
  private async testEndpoint(test: EndpointTest): Promise<TestResult> {
    const startTime = Date.now();
    const url = `${this.baseURL}${test.path}`;

    try {
      const response = await fetch(url, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: test.payload ? JSON.stringify(test.payload) : undefined,
      });

      const responseTime = Date.now() - startTime;
      const expectedStatuses = test.expectedStatus || [200, 201, 204];
      const success = expectedStatuses.includes(response.status);

      return {
        endpoint: test.path,
        method: test.method,
        category: test.category,
        status: response.status,
        success,
        responseTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        endpoint: test.path,
        method: test.method,
        category: test.category,
        status: 0,
        success: false,
        responseTime,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run all endpoint tests
   */
  async runAllTests(): Promise<{
    totalTests: number;
    passed: number;
    failed: number;
    results: TestResult[];
    summary: any;
  }> {
    logger.info('[QA] Starting comprehensive endpoint testing...');

    for (const test of CRITICAL_ENDPOINTS) {
      const result = await this.testEndpoint(test);
      this.results.push(result);
      
      if (result.success) {
        logger.info(`[QA] ✅ ${test.method} ${test.path} - ${result.status} (${result.responseTime}ms)`);
      } else {
        logger.warn(`[QA] ❌ ${test.method} ${test.path} - ${result.status} (${result.error || 'Failed'})`);
      }
    }

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    // Group by category
    const byCategory = this.results.reduce((acc, result) => {
      if (!acc[result.category]) {
        acc[result.category] = { total: 0, passed: 0, failed: 0 };
      }
      acc[result.category].total++;
      if (result.success) {
        acc[result.category].passed++;
      } else {
        acc[result.category].failed++;
      }
      return acc;
    }, {} as Record<string, { total: number; passed: number; failed: number }>);

    // Calculate average response time
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;

    const summary = {
      totalTests: this.results.length,
      passed,
      failed,
      passRate: ((passed / this.results.length) * 100).toFixed(2) + '%',
      avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
      byCategory,
      fastestEndpoint: this.results.reduce((min, r) => r.responseTime < min.responseTime ? r : min),
      slowestEndpoint: this.results.reduce((max, r) => r.responseTime > max.responseTime ? r : max),
    };

    logger.info('[QA] Testing complete', summary);

    return {
      totalTests: this.results.length,
      passed,
      failed,
      results: this.results,
      summary,
    };
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(testResults: any): string {
    const { totalTests, passed, failed, results, summary } = testResults;
    const passRate = (passed / totalTests * 100).toFixed(1);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pet Wash™ - Endpoint QA Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f7fa;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .stat-label {
      color: #6c757d;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .passed { color: #28a745; }
    .failed { color: #dc3545; }
    .results-section {
      padding: 30px;
    }
    .results-section h2 {
      margin-bottom: 20px;
      color: #2d3748;
    }
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    .results-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
    }
    .results-table td {
      padding: 12px;
      border-bottom: 1px solid #e9ecef;
    }
    .results-table tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    .method-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      font-family: monospace;
    }
    .method-get { background: #d1ecf1; color: #0c5460; }
    .method-post { background: #d4edda; color: #155724; }
    .method-put { background: #fff3cd; color: #856404; }
    .method-delete { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 Endpoint QA Report</h1>
      <p>Pet Wash™ API - Deep Quality Assurance Testing</p>
      <p style="margin-top: 10px; font-size: 14px;">${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${totalTests}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value passed">${passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value failed">${failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${passRate}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.avgResponseTime}</div>
        <div class="stat-label">Avg Response</div>
      </div>
    </div>
    
    <div class="results-section">
      <h2>Test Results by Endpoint</h2>
      <table class="results-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Category</th>
            <th>Status</th>
            <th>Response Time</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${results.map((r: TestResult) => `
            <tr>
              <td><span class="method-badge method-${r.method.toLowerCase()}">${r.method}</span></td>
              <td><code>${r.endpoint}</code></td>
              <td>${r.category}</td>
              <td>${r.status || 'N/A'}</td>
              <td>${r.responseTime}ms</td>
              <td>
                <span class="badge ${r.success ? 'badge-success' : 'badge-danger'}">
                  ${r.success ? '✅ PASS' : '❌ FAIL'}
                </span>
                ${r.error ? `<br><small style="color: #dc3545;">${r.error}</small>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="results-section" style="background: #f8f9fa;">
      <h2>Performance Summary</h2>
      <p><strong>Fastest Endpoint:</strong> ${summary.fastestEndpoint.method} ${summary.fastestEndpoint.endpoint} (${summary.fastestEndpoint.responseTime}ms)</p>
      <p><strong>Slowest Endpoint:</strong> ${summary.slowestEndpoint.method} ${summary.slowestEndpoint.endpoint} (${summary.slowestEndpoint.responseTime}ms)</p>
      
      <h3 style="margin-top: 20px;">Results by Category</h3>
      <table class="results-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Total</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Pass Rate</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(summary.byCategory).map(([category, stats]: any) => `
            <tr>
              <td><strong>${category}</strong></td>
              <td>${stats.total}</td>
              <td class="passed">${stats.passed}</td>
              <td class="failed">${stats.failed}</td>
              <td>${((stats.passed / stats.total) * 100).toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export async function runEndpointQA() {
  const tester = new EndpointQATester();
  const results = await tester.runAllTests();
  const htmlReport = tester.generateHTMLReport(results);
  
  return {
    results,
    htmlReport
  };
}

export default EndpointQATester;

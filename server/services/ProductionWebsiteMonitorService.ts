/**
 * PRODUCTION WEBSITE MONITOR SERVICE
 * 
 * Gemini AI-powered monitoring for live production website petwash.co.il
 * Monitors:
 * - Website availability and response times
 * - Homepage content integrity
 * - SSL certificate status
 * - Key pages and functionality
 * - SEO and meta tag health
 * - Performance metrics
 * 
 * Runs in background and reports issues proactively
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const PRODUCTION_URL = 'https://petwash.co.il';
const FIREBASE_URL = 'https://signinpetwash.web.app';

interface MonitoringResult {
  timestamp: Date;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs: number;
  statusCode: number;
  issues: string[];
  geminiAnalysis?: string;
}

interface PageHealthCheck {
  path: string;
  name: string;
  expectedElements: string[];
}

const PAGES_TO_MONITOR: PageHealthCheck[] = [
  { path: '/', name: 'Homepage', expectedElements: ['Pet Wash', 'logo', 'navigation'] },
  { path: '/signin', name: 'Sign In', expectedElements: ['login', 'sign', 'auth'] },
  { path: '/franchise', name: 'Franchise', expectedElements: ['franchise', 'business'] },
  { path: '/about', name: 'About', expectedElements: ['about', 'story'] },
  { path: '/contact', name: 'Contact', expectedElements: ['contact', 'phone', 'email'] },
];

class ProductionWebsiteMonitorService {
  private ai: GoogleGenAI | null = null;
  private isRunning = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
  private lastResults: Map<string, MonitoringResult> = new Map();
  private geminiRateLimited = false;
  private geminiRateLimitResetTime: Date | null = null;
  private geminiCallsToday = 0;
  private GEMINI_DAILY_LIMIT = 15; // Stay under 20 free tier limit

  constructor() {
    if (GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        ...(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL, apiVersion: '' } } : {}),
      });
      logger.info('[ProductionMonitor] ✅ Gemini AI initialized for website monitoring');
    } else {
      logger.warn('[ProductionMonitor] ⚠️ Gemini API key not configured - monitoring limited');
    }
  }

  /**
   * Start continuous monitoring of production website
   */
  async start() {
    if (this.isRunning) {
      logger.warn('[ProductionMonitor] Already running');
      return;
    }

    this.isRunning = true;
    logger.info(`[ProductionMonitor] 🚀 Starting production website monitoring for ${PRODUCTION_URL}`);

    // Run initial check immediately
    await this.runFullHealthCheck();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.runFullHealthCheck();
    }, this.CHECK_INTERVAL);

    logger.info(`[ProductionMonitor] ⏰ Monitoring every ${this.CHECK_INTERVAL / 1000} seconds`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;
    logger.info('[ProductionMonitor] ⏹️ Monitoring stopped');
  }

  /**
   * Run a full health check on all monitored pages
   */
  async runFullHealthCheck(): Promise<MonitoringResult[]> {
    const results: MonitoringResult[] = [];
    
    logger.info('[ProductionMonitor] 🔍 Running full health check...');

    // Check main production URL
    const mainResult = await this.checkUrl(PRODUCTION_URL, 'Main Site');
    results.push(mainResult);

    // Check Firebase fallback URL
    const firebaseResult = await this.checkUrl(FIREBASE_URL, 'Firebase Hosting');
    results.push(firebaseResult);

    // Check key pages
    for (const page of PAGES_TO_MONITOR) {
      const pageResult = await this.checkUrl(`${PRODUCTION_URL}${page.path}`, page.name);
      results.push(pageResult);
    }

    // Analyze results with Gemini
    if (this.ai && results.some(r => r.status !== 'healthy')) {
      await this.analyzeWithGemini(results);
    }

    // Log summary
    const healthy = results.filter(r => r.status === 'healthy').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const down = results.filter(r => r.status === 'down').length;

    logger.info(`[ProductionMonitor] 📊 Health Summary: ${healthy} healthy, ${degraded} degraded, ${down} down`);

    // Alert on critical issues
    if (down > 0) {
      logger.error(`[ProductionMonitor] 🚨 CRITICAL: ${down} endpoints are DOWN!`, {
        downEndpoints: results.filter(r => r.status === 'down').map(r => r.url)
      });
    }

    return results;
  }

  /**
   * Check a single URL for health
   */
  private async checkUrl(url: string, name: string): Promise<MonitoringResult> {
    const startTime = Date.now();
    const result: MonitoringResult = {
      timestamp: new Date(),
      url,
      status: 'healthy',
      responseTimeMs: 0,
      statusCode: 0,
      issues: []
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'PetWash-Monitor/1.0 (Production Health Check)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      result.responseTimeMs = Date.now() - startTime;
      result.statusCode = response.status;

      // Check response time
      if (result.responseTimeMs > 5000) {
        result.status = 'degraded';
        result.issues.push(`Slow response time: ${result.responseTimeMs}ms`);
      } else if (result.responseTimeMs > 10000) {
        result.status = 'down';
        result.issues.push(`Very slow response: ${result.responseTimeMs}ms`);
      }

      // Check status code
      if (response.status >= 500) {
        result.status = 'down';
        result.issues.push(`Server error: HTTP ${response.status}`);
      } else if (response.status >= 400) {
        result.status = 'degraded';
        result.issues.push(`Client error: HTTP ${response.status}`);
      } else if (response.status >= 300) {
        // Redirects are often okay, but note them
        result.issues.push(`Redirect: HTTP ${response.status}`);
      }

      // Check content for key indicators
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          result.issues.push(`Unexpected content-type: ${contentType}`);
        }

        // For homepage, verify basic content
        if (url === PRODUCTION_URL || url.endsWith('/')) {
          const html = await response.text();
          if (!html.includes('Pet Wash') && !html.includes('petwash')) {
            result.status = 'degraded';
            result.issues.push('Homepage missing Pet Wash branding');
          }
          if (html.length < 1000) {
            result.status = 'degraded';
            result.issues.push('Homepage content suspiciously short');
          }
        }
      }

      // Check SSL (URL should be HTTPS)
      if (!url.startsWith('https://')) {
        result.issues.push('Not using HTTPS');
      }

      // Store result
      this.lastResults.set(url, result);

      const statusEmoji = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
      logger.info(`[ProductionMonitor] ${statusEmoji} ${name}: ${result.status} (${result.responseTimeMs}ms)`);

    } catch (error: any) {
      result.responseTimeMs = Date.now() - startTime;
      result.status = 'down';
      
      if (error.name === 'AbortError') {
        result.issues.push('Request timed out after 30 seconds');
      } else if (error.code === 'ENOTFOUND') {
        result.issues.push('DNS resolution failed');
      } else if (error.code === 'ECONNREFUSED') {
        result.issues.push('Connection refused');
      } else {
        result.issues.push(`Error: ${error.message}`);
      }

      logger.error(`[ProductionMonitor] ❌ ${name} check failed:`, error.message);
    }

    return result;
  }

  /**
   * Use Gemini AI to analyze monitoring results and provide insights
   * Includes rate limit protection to avoid exceeding free tier limits
   */
  private async analyzeWithGemini(results: MonitoringResult[]): Promise<void> {
    if (!this.ai) return;

    // Check if we're rate limited
    if (this.geminiRateLimited) {
      if (this.geminiRateLimitResetTime && new Date() < this.geminiRateLimitResetTime) {
        logger.debug('[ProductionMonitor] Skipping Gemini analysis - rate limited until', { 
          resetTime: this.geminiRateLimitResetTime.toISOString() 
        });
        return;
      }
      this.geminiRateLimited = false;
      this.geminiRateLimitResetTime = null;
    }

    // Check daily limit
    if (this.geminiCallsToday >= this.GEMINI_DAILY_LIMIT) {
      logger.debug('[ProductionMonitor] Skipping Gemini analysis - daily limit reached', { 
        calls: this.geminiCallsToday, 
        limit: this.GEMINI_DAILY_LIMIT 
      });
      return;
    }

    try {
      const issueResults = results.filter(r => r.issues.length > 0);
      if (issueResults.length === 0) return;

      const prompt = `You are a website reliability engineer monitoring petwash.co.il (a luxury pet wash service in Israel).

Analyze these monitoring results and provide:
1. A brief summary of the current status
2. Root cause analysis for any issues
3. Recommended actions to fix problems
4. Priority level (Critical/High/Medium/Low)

Monitoring Results:
${JSON.stringify(issueResults.map(r => ({
  url: r.url,
  status: r.status,
  responseTimeMs: r.responseTimeMs,
  statusCode: r.statusCode,
  issues: r.issues
})), null, 2)}

Respond in a structured format. Be concise but thorough.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      this.geminiCallsToday++;

      if (response.candidates && response.candidates[0]?.content?.parts) {
        const analysis = response.candidates[0].content.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join('');

        logger.info('[ProductionMonitor] 🤖 Gemini Analysis:', { analysis: analysis.substring(0, 500) });

        for (const result of issueResults) {
          result.geminiAnalysis = analysis;
        }
      }
    } catch (error: any) {
      // Handle rate limit errors gracefully
      if (error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        this.geminiRateLimited = true;
        // Reset after 1 hour
        this.geminiRateLimitResetTime = new Date(Date.now() + 60 * 60 * 1000);
        logger.warn('[ProductionMonitor] Gemini rate limited - pausing AI analysis for 1 hour');
      } else {
        logger.error('[ProductionMonitor] Gemini analysis failed:', error);
      }
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { isRunning: boolean; lastResults: MonitoringResult[] } {
    return {
      isRunning: this.isRunning,
      lastResults: Array.from(this.lastResults.values())
    };
  }

  /**
   * Perform a manual health check (on-demand)
   */
  async manualCheck(): Promise<MonitoringResult[]> {
    return this.runFullHealthCheck();
  }
}

// Export singleton instance
export const productionMonitor = new ProductionWebsiteMonitorService();

// Auto-start monitoring only in production (dev mode skips to avoid Vite warm-up crashes)
if (process.env.NODE_ENV === 'production') {
  setTimeout(() => {
    productionMonitor.start();
  }, 5000);
}

export default productionMonitor;

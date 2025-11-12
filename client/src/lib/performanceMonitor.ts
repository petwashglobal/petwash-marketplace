/**
 * Performance Monitoring System 2025
 * 
 * Tracks real-time performance metrics for Pet Wash™ platform:
 * - Page load times (FCP, TTI, LCP)
 * - Resource loading metrics
 * - Core Web Vitals (Google's quality signals)
 * - User interaction latency
 * - Bundle size warnings
 * 
 * Metrics sent to backend for aggregation and alerting
 */

import { logger } from './logger';

// ============================================================================
// PERFORMANCE METRICS TYPES
// ============================================================================

export interface PerformanceMetrics {
  // Navigation Timing
  timeToInteractive: number;          // When page becomes interactive
  timeToFirstPaint: number;           // First visual change
  domContentLoaded: number;           // DOM ready
  fullPageLoad: number;               // All resources loaded
  
  // Resource Timing
  dnsLookup: number;                  // DNS resolution time
  tcpConnection: number;              // TCP handshake time
  tlsNegotiation: number;             // SSL/TLS negotiation
  serverResponse: number;             // Time to first byte (TTFB)
  resourceDownload: number;           // Download time
  
  // Core Web Vitals (Google ranking factors)
  fcp?: number;                       // First Contentful Paint
  lcp?: number;                       // Largest Contentful Paint
  fid?: number;                       // First Input Delay
  cls?: number;                       // Cumulative Layout Shift
  
  // Context
  url: string;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  timestamp: string;
}

export interface BundleInfo {
  src: string;
  size?: number;
  isLarge: boolean;
  loadTime: number;
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics | null = null;
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  /**
   * Initialize all performance monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Wait for page load to collect metrics
    if (document.readyState === 'complete') {
      this.collectMetrics();
    } else {
      window.addEventListener('load', () => this.collectMetrics());
    }

    // Monitor Core Web Vitals
    this.monitorWebVitals();

    // Monitor long tasks (blocking main thread)
    this.monitorLongTasks();
  }

  /**
   * Collect comprehensive performance metrics
   */
  private collectMetrics(): void {
    if (!window.performance || !window.performance.timing) {
      logger.warn('[Performance] Performance API not available');
      return;
    }

    const perf = window.performance;
    const timing = perf.timing;
    const nav = timing.navigationStart;

    // Calculate navigation timing metrics
    this.metrics = {
      // Key user-facing metrics
      timeToInteractive: timing.domInteractive - nav,
      timeToFirstPaint: timing.responseStart - nav,
      domContentLoaded: timing.domContentLoadedEventEnd - nav,
      fullPageLoad: timing.loadEventEnd - nav,

      // Network timing breakdown
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      tlsNegotiation: timing.secureConnectionStart ? timing.connectEnd - timing.secureConnectionStart : 0,
      serverResponse: timing.responseStart - timing.requestStart,
      resourceDownload: timing.responseEnd - timing.responseStart,

      // Context
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType,
      deviceMemory: (navigator as any).deviceMemory,
      timestamp: new Date().toISOString(),
    };

    // Log metrics to console
    this.logMetrics();

    // Send to backend for aggregation
    this.sendMetricsToBackend();

    // Check for large bundles
    this.checkBundleSizes();
  }

  /**
   * Monitor Core Web Vitals (Google's quality signals)
   */
  private monitorWebVitals(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      // Largest Contentful Paint (LCP) - loading performance
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        if (this.metrics) {
          this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
          logger.debug(`[Web Vitals] LCP: ${this.metrics.lcp.toFixed(0)}ms`);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObserver);

      // First Input Delay (FID) - interactivity
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (this.metrics) {
            this.metrics.fid = entry.processingStart - entry.startTime;
            logger.debug(`[Web Vitals] FID: ${this.metrics.fid.toFixed(0)}ms`);
          }
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift (CLS) - visual stability
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        if (this.metrics) {
          this.metrics.cls = clsValue;
          logger.debug(`[Web Vitals] CLS: ${clsValue.toFixed(3)}`);
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);

      // First Contentful Paint (FCP)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.name === 'first-contentful-paint' && this.metrics) {
            this.metrics.fcp = entry.startTime;
            logger.debug(`[Web Vitals] FCP: ${this.metrics.fcp.toFixed(0)}ms`);
          }
        });
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
      this.observers.push(fcpObserver);
    } catch (error) {
      logger.error('[Performance] Failed to set up Web Vitals monitoring', error);
    }
  }

  /**
   * Monitor long tasks that block the main thread
   */
  private monitorLongTasks(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          logger.warn(`[Performance] Long task detected: ${entry.duration.toFixed(0)}ms - may cause jank`);
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      this.observers.push(longTaskObserver);
    } catch (error) {
      // Long task API not available in all browsers
      logger.debug('[Performance] Long task monitoring not available');
    }
  }

  /**
   * Check for large JavaScript bundles
   */
  private checkBundleSizes(): void {
    const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
    const largeBundles: BundleInfo[] = [];

    scripts.forEach((script) => {
      if (!script.src) return;

      // Get resource timing for this script
      const resources = performance.getEntriesByName(script.src) as PerformanceResourceTiming[];
      if (resources.length === 0) return;

      const resource = resources[0];
      const transferSize = resource.transferSize || 0;
      const loadTime = resource.responseEnd - resource.requestStart;

      // Flag bundles larger than 500KB
      const isLarge = transferSize > 500000;

      if (isLarge) {
        largeBundles.push({
          src: script.src,
          size: transferSize,
          isLarge: true,
          loadTime: loadTime,
        });
      }
    });

    if (largeBundles.length > 0) {
      logger.warn('[Performance] Large bundles detected:', largeBundles);
      logger.warn('💡 Consider code splitting or lazy loading to improve performance');
    }
  }

  /**
   * Log metrics to console with color coding
   */
  private logMetrics(): void {
    if (!this.metrics) return;

    console.group('📊 PERFORMANCE METRICS');
    
    // Navigation timing
    console.group('⏱️  Navigation Timing');
    console.log(`Time to Interactive: ${this.metrics.timeToInteractive}ms`);
    console.log(`Time to First Paint: ${this.metrics.timeToFirstPaint}ms`);
    console.log(`DOM Content Loaded: ${this.metrics.domContentLoaded}ms`);
    console.log(`Full Page Load: ${this.metrics.fullPageLoad}ms`);
    console.groupEnd();

    // Network timing
    console.group('🌐 Network Timing');
    console.log(`DNS Lookup: ${this.metrics.dnsLookup}ms`);
    console.log(`TCP Connection: ${this.metrics.tcpConnection}ms`);
    console.log(`TLS Negotiation: ${this.metrics.tlsNegotiation}ms`);
    console.log(`Server Response (TTFB): ${this.metrics.serverResponse}ms`);
    console.log(`Resource Download: ${this.metrics.resourceDownload}ms`);
    console.groupEnd();

    // Core Web Vitals
    if (this.metrics.fcp || this.metrics.lcp || this.metrics.fid || this.metrics.cls) {
      console.group('⭐ Core Web Vitals');
      if (this.metrics.fcp) console.log(`FCP: ${this.metrics.fcp.toFixed(0)}ms`);
      if (this.metrics.lcp) console.log(`LCP: ${this.metrics.lcp.toFixed(0)}ms`);
      if (this.metrics.fid) console.log(`FID: ${this.metrics.fid.toFixed(0)}ms`);
      if (this.metrics.cls) console.log(`CLS: ${this.metrics.cls.toFixed(3)}`);
      console.groupEnd();
    }

    // Connection info
    console.group('📱 Device Info');
    console.log(`Connection: ${this.metrics.connectionType || 'unknown'}`);
    console.log(`Device Memory: ${this.metrics.deviceMemory ? this.metrics.deviceMemory + 'GB' : 'unknown'}`);
    console.groupEnd();

    console.groupEnd();
  }

  /**
   * Send metrics to backend for aggregation
   */
  private async sendMetricsToBackend(): Promise<void> {
    if (!this.metrics) return;

    try {
      await fetch('/api/performance/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.metrics),
        // Use sendBeacon if available for reliability (survives page unload)
        keepalive: true,
      });
      logger.debug('[Performance] Metrics sent to backend');
    } catch (error) {
      logger.debug('[Performance] Failed to send metrics (non-critical)', error);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics | null {
    return this.metrics;
  }

  /**
   * Cleanup observers
   */
  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

// ============================================================================
// INITIALIZE ON IMPORT
// ============================================================================

// Auto-initialize performance monitoring
if (typeof window !== 'undefined') {
  PerformanceMonitor.getInstance();
}

export default PerformanceMonitor;

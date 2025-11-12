// Real User Monitoring (RUM) - Performance Metrics Tracking

import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  passkeyToDashboard?: number; // Time from passkey click to dashboard load
  
  // Context
  page: string;
  userAgent: string;
  connectionType?: string;
  timestamp: Date;
  userId?: string;
}

// Sample rate: 10% of sessions
const SAMPLE_RATE = 0.1;

// Check if this session should be sampled
function shouldSample(): boolean {
  // Use session storage to ensure consistent sampling per session
  const samplingDecision = sessionStorage.getItem('rum_sample');
  if (samplingDecision !== null) {
    return samplingDecision === 'true';
  }
  
  const sample = Math.random() < SAMPLE_RATE;
  sessionStorage.setItem('rum_sample', sample.toString());
  return sample;
}

// Track Core Web Vitals
export function trackWebVitals() {
  if (!shouldSample()) return;
  
  // Track LCP (Largest Contentful Paint)
  if ('PerformanceObserver' in window) {
    try {
      let lcpValue = 0;
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        // Keep updating LCP value as new candidates arrive
        lcpValue = lastEntry.startTime;
      });
      
      // Use buffered: true to capture already-fired LCP candidates
      try {
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Fallback for browsers that don't support buffered option
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      }
      
      // Report final LCP when page is hidden (user leaves or navigates away)
      const reportLCP = () => {
        // Flush any pending entries before reporting
        const pendingEntries = lcpObserver.takeRecords();
        if (pendingEntries.length > 0) {
          const lastPending = pendingEntries[pendingEntries.length - 1];
          lcpValue = lastPending.startTime;
        }
        
        if (lcpValue > 0) {
          trackMetric({
            lcp: lcpValue,
            page: window.location.pathname,
            userAgent: navigator.userAgent,
            connectionType: (navigator as any).connection?.effectiveType,
            timestamp: new Date(),
          });
        }
        lcpObserver.disconnect();
      };
      
      // Capture final LCP on visibility change or page hide
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          reportLCP();
        }
      }, { once: true });
      
      // Fallback for browsers that don't support visibilitychange
      window.addEventListener('pagehide', reportLCP, { once: true });
    } catch (error) {
      console.error('LCP tracking error:', error);
    }
    
    // Track FID (First Input Delay)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as any;
        
        trackMetric({
          fid: firstEntry.processingStart - firstEntry.startTime,
          page: window.location.pathname,
          userAgent: navigator.userAgent,
          connectionType: (navigator as any).connection?.effectiveType,
          timestamp: new Date(),
        });
        
        fidObserver.disconnect();
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      console.error('FID tracking error:', error);
    }
    
    // Track CLS (Cumulative Layout Shift)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
      });
      
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      
      // Report CLS when page is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          trackMetric({
            cls: clsValue,
            page: window.location.pathname,
            userAgent: navigator.userAgent,
            connectionType: (navigator as any).connection?.effectiveType,
            timestamp: new Date(),
          });
          
          clsObserver.disconnect();
        }
      }, { once: true });
    } catch (error) {
      console.error('CLS tracking error:', error);
    }
  }
  
  // Track TTFB (Time to First Byte)
  if (window.performance && window.performance.timing) {
    const ttfb = window.performance.timing.responseStart - window.performance.timing.requestStart;
    
    trackMetric({
      ttfb,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      connectionType: (navigator as any).connection?.effectiveType,
      timestamp: new Date(),
    });
  }
}

// Track passkey to dashboard time
export function trackPasskeyToDashboard(startTime: number) {
  if (!shouldSample()) return;
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  trackMetric({
    passkeyToDashboard: duration,
    page: '/signin',
    userAgent: navigator.userAgent,
    connectionType: (navigator as any).connection?.effectiveType,
    timestamp: new Date(),
  });
}

// Store metrics to Firestore
async function trackMetric(metrics: PerformanceMetrics) {
  try {
    // Filter out undefined values (Firestore doesn't accept undefined)
    const cleanMetrics: Record<string, any> = {
      timestamp: Timestamp.fromDate(metrics.timestamp),
    };
    
    // Only add defined values
    Object.entries(metrics).forEach(([key, value]) => {
      if (key !== 'timestamp' && value !== undefined) {
        cleanMetrics[key] = value;
      }
    });
    
    await addDoc(collection(db, 'performance_metrics'), cleanMetrics);
  } catch (error) {
    // Silently ignore Firestore permission errors (analytics are non-critical)
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.debug('[RUM] Metrics tracking skipped (Firestore permissions)');
    }
  }
}

// Get median passkey to dashboard time for alerting
export async function getMedianPasskeyToDashboard(minutes: number = 10): Promise<number | null> {
  try {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    const q = query(
      collection(db, 'performance_metrics'),
      where('passkeyToDashboard', '!=', null),
      where('timestamp', '>=', Timestamp.fromDate(cutoffTime)),
      orderBy('passkeyToDashboard')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const values = snapshot.docs.map(doc => doc.data().passkeyToDashboard);
    const medianIndex = Math.floor(values.length / 2);
    
    return values[medianIndex];
  } catch (error) {
    console.error('Failed to get median:', error);
    return null;
  }
}

// Alert if median > threshold
export async function checkPerformanceAlert(threshold: number = 1500): Promise<boolean> {
  const median = await getMedianPasskeyToDashboard(10);
  
  if (median && median > threshold) {
    console.warn(`⚠️ Performance Alert: Median passkey→dashboard time is ${median.toFixed(0)}ms (threshold: ${threshold}ms)`);
    
    // Could send alert to monitoring service here
    return true;
  }
  
  return false;
}

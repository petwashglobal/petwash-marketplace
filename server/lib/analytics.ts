// Analytics tracking utility
// Provides a simple interface for tracking events across the application

export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
  userId?: string;
}

/**
 * Track an analytics event
 * Can be extended to integrate with Google Analytics, Mixpanel, etc.
 */
export function trackEvent(event: AnalyticsEvent): void {
  // For now, just log the event
  // In production, this would send to analytics service
  console.log('[Analytics]', JSON.stringify(event, null, 2));
  
  // TODO: Integrate with actual analytics service (GA4, etc.)
  // Example: gtag('event', event.action, { ... });
}

/**
 * Track page view
 */
export function trackPageView(path: string, userId?: string): void {
  trackEvent({
    action: 'page_view',
    category: 'navigation',
    label: path,
    userId,
  });
}

/**
 * Track error
 */
export function trackError(error: Error, context?: string): void {
  trackEvent({
    action: 'error',
    category: 'system',
    label: context || error.message,
  });
}

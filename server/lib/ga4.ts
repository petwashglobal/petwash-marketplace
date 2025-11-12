/**
 * Google Analytics 4 Integration
 * Tracks auth events, user journeys, and sends to BigQuery
 */

import { logger } from './logger';

export interface GA4Event {
  name: string;
  params: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface AuthFunnelEvent {
  step: 'login_started' | 'login_method_selected' | 'login_completed' | 'login_failed' | 'dashboard_loaded';
  method?: 'email' | 'google' | 'facebook' | 'apple' | 'passkey' | 'magic_link';
  errorCode?: string;
  latencyMs?: number;
  userId?: string;
}

const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const GA4_API_SECRET = process.env.GA4_API_SECRET;
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/**
 * Send event to GA4 Measurement Protocol
 */
export async function sendGA4Event(event: GA4Event): Promise<boolean> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) {
    logger.warn('[GA4] Measurement ID or API Secret not configured');
    return false;
  }

  try {
    const clientId = event.userId || `anonymous-${Date.now()}`;
    
    const payload = {
      client_id: clientId,
      user_id: event.userId,
      events: [{
        name: event.name,
        params: {
          ...event.params,
          session_id: event.sessionId,
          engagement_time_msec: '100',
          timestamp_micros: Date.now() * 1000,
        },
      }],
    };

    const response = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      logger.error('[GA4] Failed to send event', { status: response.statusText });
      return false;
    }

    logger.info('[GA4] Event sent', { eventName: event.name });
    return true;
  } catch (error) {
    logger.error('[GA4] Error sending event', error);
    return false;
  }
}

/**
 * Track auth funnel event
 */
export async function trackAuthFunnel(event: AuthFunnelEvent): Promise<void> {
  const ga4Event: GA4Event = {
    name: event.step,
    params: {
      method: event.method,
      error_code: event.errorCode,
      latency_ms: event.latencyMs,
      timestamp: new Date().toISOString(),
    },
    userId: event.userId,
  };

  await sendGA4Event(ga4Event);
}

/**
 * Track successful login
 */
export async function trackLogin(
  userId: string,
  method: AuthFunnelEvent['method'],
  latencyMs: number
): Promise<void> {
  await trackAuthFunnel({
    step: 'login_completed',
    method,
    latencyMs,
    userId,
  });
}

/**
 * Track login failure
 */
export async function trackLoginFailure(
  method: AuthFunnelEvent['method'],
  errorCode: string
): Promise<void> {
  await trackAuthFunnel({
    step: 'login_failed',
    method,
    errorCode,
  });
}

/**
 * Track dashboard load
 */
export async function trackDashboardLoad(userId: string, latencyMs: number): Promise<void> {
  await trackAuthFunnel({
    step: 'dashboard_loaded',
    latencyMs,
    userId,
  });
}

/**
 * Get GA4 funnel metrics (requires BigQuery)
 */
export interface FunnelMetrics {
  loginStarted: number;
  methodSelected: number;
  loginCompleted: number;
  loginFailed: number;
  dashboardLoaded: number;
  conversionRate: number;
  avgLatencyMs: number;
}

/**
 * Query BigQuery for funnel metrics
 * Note: This requires BigQuery to be set up and @google-cloud/bigquery package
 */
export async function getAuthFunnelMetrics(): Promise<FunnelMetrics | null> {
  const projectId = process.env.BIGQUERY_PROJECT_ID;
  const datasetId = process.env.BIGQUERY_DATASET_ID;

  if (!projectId || !datasetId) {
    logger.warn('[GA4] BigQuery not configured');
    return null;
  }

  try {
    // This would require @google-cloud/bigquery package
    // For now, return mock data structure
    logger.warn('[GA4] BigQuery query not implemented - install @google-cloud/bigquery');
    
    return {
      loginStarted: 0,
      methodSelected: 0,
      loginCompleted: 0,
      loginFailed: 0,
      dashboardLoaded: 0,
      conversionRate: 0,
      avgLatencyMs: 0,
    };
  } catch (error) {
    logger.error('[GA4] Failed to query BigQuery', error);
    return null;
  }
}

/**
 * Track custom event
 */
export async function trackCustomEvent(
  eventName: string,
  params: Record<string, any>,
  userId?: string
): Promise<void> {
  await sendGA4Event({
    name: eventName,
    params,
    userId,
  });
}

/**
 * Track page view
 */
export async function trackPageView(
  path: string,
  title: string,
  userId?: string
): Promise<void> {
  await sendGA4Event({
    name: 'page_view',
    params: {
      page_path: path,
      page_title: title,
      page_location: `https://petwash.co.il${path}`,
    },
    userId,
  });
}

/**
 * Track error event
 */
export async function trackError(
  error: Error,
  context: string,
  userId?: string
): Promise<void> {
  await sendGA4Event({
    name: 'error_occurred',
    params: {
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500),
      error_context: context,
      fatal: false,
    },
    userId,
  });
}

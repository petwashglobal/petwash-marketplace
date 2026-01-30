/**
 * Google Analytics 4 Integration
 * Tracks auth events, user journeys, and sends to BigQuery
 */
import { logger } from './logger';
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const GA4_API_SECRET = process.env.GA4_API_SECRET;
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
/**
 * Check if user has consented to analytics tracking
 */
async function hasAnalyticsConsent(userId) {
    // PRIVACY FIX: Tracking disabled by default, requires explicit user consent
    if (!userId) {
        return false; // No consent for anonymous users
    }
    try {
        const { db } = await import('../db');
        const { users } = await import('../../shared/schema');
        const { eq } = await import('drizzle-orm');
        const [user] = await db
            .select({ analyticsConsent: users.analyticsConsent })
            .from(users)
            .where(eq(users.id, userId));
        return user?.analyticsConsent ?? false;
    }
    catch (error) {
        logger.error('[GA4] Failed to check analytics consent', error);
        return false; // Default to NO TRACKING on error
    }
}
/**
 * Send event to GA4 Measurement Protocol
 * PRIVACY: Only sends if user has given consent
 */
export async function sendGA4Event(event) {
    // PRIVACY FIX: Check user consent first
    const hasConsent = await hasAnalyticsConsent(event.userId);
    if (!hasConsent) {
        logger.debug('[GA4] Analytics tracking disabled - user has not consented');
        return false;
    }
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
        const response = await fetch(`${GA4_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            logger.error('[GA4] Failed to send event', { status: response.statusText });
            return false;
        }
        logger.info('[GA4] Event sent (user consented)', { eventName: event.name });
        return true;
    }
    catch (error) {
        logger.error('[GA4] Error sending event', error);
        return false;
    }
}
/**
 * Track auth funnel event
 */
export async function trackAuthFunnel(event) {
    const ga4Event = {
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
export async function trackLogin(userId, method, latencyMs) {
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
export async function trackLoginFailure(method, errorCode) {
    await trackAuthFunnel({
        step: 'login_failed',
        method,
        errorCode,
    });
}
/**
 * Track dashboard load
 */
export async function trackDashboardLoad(userId, latencyMs) {
    await trackAuthFunnel({
        step: 'dashboard_loaded',
        latencyMs,
        userId,
    });
}
/**
 * Query BigQuery for funnel metrics
 * Note: This requires BigQuery to be set up and @google-cloud/bigquery package
 */
export async function getAuthFunnelMetrics() {
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
    }
    catch (error) {
        logger.error('[GA4] Failed to query BigQuery', error);
        return null;
    }
}
/**
 * Track custom event
 */
export async function trackCustomEvent(eventName, params, userId) {
    await sendGA4Event({
        name: eventName,
        params,
        userId,
    });
}
/**
 * Track page view
 */
export async function trackPageView(path, title, userId) {
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
export async function trackError(error, context, userId) {
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

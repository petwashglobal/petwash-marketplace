import { logger } from './logger';
import { getApiUrl } from './apiConfig';

interface AuthErrorDetails {
  errorCode: string;
  errorMessage: string;
  authMethod: string;
  timestamp: string;
  userAgent: string;
  currentDomain: string;
  authDomain: string;
  projectId: string;
  customData?: any;
}

export async function trackAuthError(error: any, method: string) {
  // Read the actual authDomain and projectId from the runtime-injected Firebase config
  // (window.__FIREBASE_CONFIG__) when available, so error reports reflect what the browser
  // is actually using rather than a hardcoded fallback that may be stale.
  const runtimeConfig = typeof window !== 'undefined' ? (window as any).__FIREBASE_CONFIG__ : null;
  const errorDetails: AuthErrorDetails = {
    errorCode: error.code || 'unknown',
    errorMessage: error.message || 'Unknown error',
    authMethod: method,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    currentDomain: window.location.origin,
    authDomain: runtimeConfig?.authDomain || 'MISSING_AUTH_DOMAIN',
    projectId: runtimeConfig?.projectId || 'MISSING_PROJECT_ID',
    customData: {
      ...(error.customData || {}),
      hasRuntimeConfig: !!runtimeConfig,
      hasApiKey: !!(runtimeConfig?.apiKey && runtimeConfig.apiKey !== 'placeholder-api-key'),
      firebaseCode: error.code || null,
    },
  };

  logger.error(`[AUTH ERROR TRACKER] ${method} failed:`, errorDetails);

  try {
    await fetch(getApiUrl('/api/auth/track-error'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorDetails),
    });
  } catch (e) {
    console.error('Failed to send error to server:', e);
  }

  return errorDetails;
}

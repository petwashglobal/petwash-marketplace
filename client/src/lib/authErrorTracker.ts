import { logger } from './logger';

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
  const errorDetails: AuthErrorDetails = {
    errorCode: error.code || 'unknown',
    errorMessage: error.message || 'Unknown error',
    authMethod: method,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    currentDomain: window.location.origin,
    authDomain: 'signinpetwash.firebaseapp.com',
    projectId: 'signinpetwash',
    customData: error.customData || null,
  };

  logger.error(`[AUTH ERROR TRACKER] ${method} failed:`, errorDetails);

  try {
    await fetch('/api/auth/track-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorDetails),
    });
  } catch (e) {
    console.error('Failed to send error to server:', e);
  }

  return errorDetails;
}

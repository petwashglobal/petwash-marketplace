/**
 * useAutoFaceID Hook
 * Automatically triggers Face ID/Touch ID on app launch for returning users
 * Banking-level UX: Immediate biometric prompt without email input
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { logger } from '@/lib/logger';
import { signInWithPasskeyAuto } from '@/auth/passkey';
import { type Language } from '@/lib/i18n';

export type AutoFaceIDState = 
  | 'idle'           // Initial state, not started
  | 'checking'       // Checking if returning user (200ms delay)
  | 'authenticating' // Face ID prompt active
  | 'success'        // Authentication succeeded
  | 'failed'         // Authentication failed, show form
  | 'unavailable';   // No stored email or passkey not supported

interface UseAutoFaceIDResult {
  state: AutoFaceIDState;
  message: string;
  isLoading: boolean;
  canShowForm: boolean;
  error?: string;
}

interface UseAutoFaceIDOptions {
  language: Language;
  enabled?: boolean;
  onSuccess?: () => void;
  onFailure?: (error?: string) => void;
}

const STORAGE_KEY = 'lastPasskeyEmail';
const CONSECUTIVE_FAILURES_KEY = 'passkeyConsecutiveFailures';
const LAST_AUTH_METHOD_KEY = 'lastAuthMethod';
const MAX_CONSECUTIVE_FAILURES = 3; // Skip auto Face ID after 3 failures
const CHECK_DELAY_MS = 200; // Feel instant if Face ID is quick

/**
 * Get bilingual message for current state
 */
function getMessage(state: AutoFaceIDState, language: Language, error?: string): string {
  const messages = {
    idle: {
      en: '',
      he: ''
    },
    checking: {
      en: 'Checking for Face ID...',
      he: '...בודק זיהוי פנים'
    },
    authenticating: {
      en: 'Authenticating with Face ID...',
      he: '...מאמת זהות עם Face ID'
    },
    success: {
      en: 'Welcome back!',
      he: '!ברוך שובך'
    },
    failed: {
      en: error || 'Please sign in',
      he: error || 'אנא התחבר'
    },
    unavailable: {
      en: '',
      he: ''
    }
  };

  return language === 'he' ? messages[state].he : messages[state].en;
}

/**
 * Store email for future auto-login
 */
export function storePasskeyEmail(email: string) {
  try {
    localStorage.setItem(STORAGE_KEY, email);
    logger.info('Stored passkey email for auto-login', { email: email.substring(0, 3) + '***' });
  } catch (error) {
    logger.error('Failed to store passkey email', error);
  }
}

/**
 * Clear stored email (on logout or switch account)
 */
export function clearPasskeyEmail() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    logger.info('Cleared stored passkey email');
  } catch (error) {
    logger.error('Failed to clear passkey email', error);
  }
}

/**
 * Get stored email for auto-login
 */
function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    logger.error('Failed to get stored passkey email', error);
    return null;
  }
}

/**
 * Track consecutive Face ID failures
 */
function incrementConsecutiveFailures(): number {
  try {
    const current = parseInt(localStorage.getItem(CONSECUTIVE_FAILURES_KEY) || '0', 10);
    const newCount = current + 1;
    localStorage.setItem(CONSECUTIVE_FAILURES_KEY, String(newCount));
    logger.info('Incremented consecutive Face ID failures', { count: newCount });
    return newCount;
  } catch (error) {
    logger.error('Failed to increment consecutive failures', error);
    return 0;
  }
}

/**
 * Reset consecutive failures counter (on successful login)
 */
function resetConsecutiveFailures() {
  try {
    localStorage.removeItem(CONSECUTIVE_FAILURES_KEY);
    logger.info('Reset consecutive Face ID failures');
  } catch (error) {
    logger.error('Failed to reset consecutive failures', error);
  }
}

/**
 * Get consecutive failures count
 */
export function getConsecutiveFailures(): number {
  try {
    return parseInt(localStorage.getItem(CONSECUTIVE_FAILURES_KEY) || '0', 10);
  } catch (error) {
    logger.error('Failed to get consecutive failures', error);
    return 0;
  }
}

/**
 * Store last successful auth method
 */
export function storeLastAuthMethod(method: 'passkey' | 'password' | 'magic_link' | 'social') {
  try {
    localStorage.setItem(LAST_AUTH_METHOD_KEY, method);
    logger.info('Stored last auth method', { method });
  } catch (error) {
    logger.error('Failed to store last auth method', error);
  }
}

/**
 * Get last successful auth method
 */
export function getLastAuthMethod(): string | null {
  try {
    return localStorage.getItem(LAST_AUTH_METHOD_KEY);
  } catch (error) {
    logger.error('Failed to get last auth method', error);
    return null;
  }
}

/**
 * Check if auto Face ID should be skipped
 */
export function shouldSkipAutoFaceID(): boolean {
  const consecutiveFailures = getConsecutiveFailures();
  const shouldSkip = consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
  
  if (shouldSkip) {
    logger.info('Skipping auto Face ID due to consecutive failures', { consecutiveFailures });
  }
  
  return shouldSkip;
}

/**
 * Automatic Face ID hook for banking-level UX
 */
export function useAutoFaceID(options: UseAutoFaceIDOptions): UseAutoFaceIDResult {
  const { language, enabled = true, onSuccess, onFailure } = options;
  const [state, setState] = useState<AutoFaceIDState>('idle');
  const [error, setError] = useState<string | undefined>();
  const [, navigate] = useLocation();
  const attemptedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Only run once per mount
    if (!enabled || attemptedRef.current) {
      return;
    }

    const attemptAutoLogin = async () => {
      attemptedRef.current = true;

      // Check if auto Face ID should be skipped (too many consecutive failures)
      if (shouldSkipAutoFaceID()) {
        logger.info('Auto Face ID: Skipped due to consecutive failures');
        setState('unavailable');
        return;
      }

      // Check for stored email
      const storedEmail = getStoredEmail();
      if (!storedEmail) {
        logger.info('Auto Face ID: No stored email found');
        setState('unavailable');
        return;
      }

      logger.info('Auto Face ID: Found stored email, starting authentication flow', {
        email: storedEmail.substring(0, 3) + '***'
      });

      try {
        // Step 1: Show "Checking..." state (200ms delay)
        setState('checking');
        await new Promise(resolve => setTimeout(resolve, CHECK_DELAY_MS));

        if (!mountedRef.current) return;

        // Step 2: Start Face ID authentication
        setState('authenticating');
        
        const result = await signInWithPasskeyAuto(storedEmail);

        if (!mountedRef.current) return;

        if (result.success) {
          // Step 3: Success - show welcome message
          setState('success');
          logger.info('Auto Face ID: Authentication successful');

          // Reset consecutive failures on success
          resetConsecutiveFailures();
          
          // Store last auth method as passkey
          storeLastAuthMethod('passkey');

          if (onSuccess) {
            onSuccess();
          }

          // Step 4: Navigate after 500ms
          setTimeout(() => {
            if (mountedRef.current) {
              window.scrollTo(0, 0);
              navigate('/dashboard');
            }
          }, 500);
        } else {
          // Authentication failed - track failure and show form
          const failureCount = incrementConsecutiveFailures();
          setState('failed');
          setError(result.error);
          logger.info('Auto Face ID: Authentication failed', { 
            error: result.error,
            consecutiveFailures: failureCount 
          });

          if (onFailure) {
            onFailure(result.error);
          }
        }
      } catch (err: any) {
        if (!mountedRef.current) return;

        logger.error('Auto Face ID: Unexpected error', err);
        incrementConsecutiveFailures();
        setState('failed');
        setError(err.message);

        if (onFailure) {
          onFailure(err.message);
        }
      }
    };

    attemptAutoLogin();
  }, [enabled, language, navigate, onSuccess, onFailure]);

  const message = getMessage(state, language, error);
  const isLoading = state === 'checking' || state === 'authenticating' || state === 'success';
  const canShowForm = state === 'failed' || state === 'unavailable';

  return {
    state,
    message,
    isLoading,
    canShowForm,
    error,
  };
}

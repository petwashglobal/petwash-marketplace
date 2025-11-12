/**
 * Enterprise-Grade Firebase Auth Error Handler
 * 
 * Provides user-friendly error messages for all Firebase auth errors
 * following Fortune 500 best practices for error handling
 */

import type { FirebaseError } from 'firebase/app';

export interface AuthErrorMessage {
  code: string;
  userMessage: string;
  technicalDetails?: string;
  shouldRetry: boolean;
  requiresUserAction: boolean;
}

/**
 * Maps Firebase auth error codes to user-friendly messages
 * Supports Hebrew and English
 */
export function getAuthErrorMessage(error: FirebaseError, language: 'he' | 'en' = 'en'): AuthErrorMessage {
  const errorMap: Record<string, AuthErrorMessage> = {
    // User-initiated cancellations
    'auth/popup-closed-by-user': {
      code: 'auth/popup-closed-by-user',
      userMessage: language === 'he' 
        ? 'חלון ההתחברות נסגר. נסה שוב.' 
        : 'The sign-in window was closed. Please try again.',
      shouldRetry: true,
      requiresUserAction: true,
    },
    'auth/cancelled-popup-request': {
      code: 'auth/cancelled-popup-request',
      userMessage: language === 'he'
        ? 'הבקשה בוטלה. נסה שוב.'
        : 'Sign-in was cancelled. Please try again.',
      shouldRetry: true,
      requiresUserAction: true,
    },

    // Network errors
    'auth/network-request-failed': {
      code: 'auth/network-request-failed',
      userMessage: language === 'he'
        ? 'שגיאת רשת. בדוק את החיבור שלך לאינטרנט.'
        : 'Network error. Please check your internet connection.',
      shouldRetry: true,
      requiresUserAction: true,
    },

    // Internal errors (usually configuration issues)
    'auth/internal-error': {
      code: 'auth/internal-error',
      userMessage: language === 'he'
        ? 'ההתחברות נכשלה. אנחנו עובדים על תיקון הבעיה.'
        : 'Sign-in failed. We\'ve logged the issue and are working on a fix.',
      technicalDetails: 'This usually indicates a configuration issue with Firebase auth, OAuth credentials, or browser settings (Safari third-party cookies).',
      shouldRetry: true,
      requiresUserAction: false,
    },

    // Account errors
    'auth/user-not-found': {
      code: 'auth/user-not-found',
      userMessage: language === 'he'
        ? 'לא נמצא משתמש עם כתובת דוא״ל זו.'
        : 'No account found with this email address.',
      shouldRetry: false,
      requiresUserAction: true,
    },
    'auth/wrong-password': {
      code: 'auth/wrong-password',
      userMessage: language === 'he'
        ? 'סיסמה שגויה. נסה שוב.'
        : 'Incorrect password. Please try again.',
      shouldRetry: true,
      requiresUserAction: true,
    },
    'auth/email-already-in-use': {
      code: 'auth/email-already-in-use',
      userMessage: language === 'he'
        ? 'כתובת הדוא״ל כבר בשימוש. התחבר במקום.'
        : 'This email is already registered. Please sign in instead.',
      shouldRetry: false,
      requiresUserAction: true,
    },
    'auth/weak-password': {
      code: 'auth/weak-password',
      userMessage: language === 'he'
        ? 'הסיסמה חלשה מדי. השתמש לפחות ב-6 תווים.'
        : 'Password is too weak. Please use at least 6 characters.',
      shouldRetry: true,
      requiresUserAction: true,
    },

    // Invalid input
    'auth/invalid-email': {
      code: 'auth/invalid-email',
      userMessage: language === 'he'
        ? 'כתובת דוא״ל לא תקינה.'
        : 'Invalid email address.',
      shouldRetry: true,
      requiresUserAction: true,
    },
    'auth/invalid-credential': {
      code: 'auth/invalid-credential',
      userMessage: language === 'he'
        ? 'פרטי התחברות לא תקינים.'
        : 'Invalid sign-in credentials.',
      shouldRetry: true,
      requiresUserAction: true,
    },

    // Account status
    'auth/user-disabled': {
      code: 'auth/user-disabled',
      userMessage: language === 'he'
        ? 'חשבון זה הושבת. צור קשר עם התמיכה.'
        : 'This account has been disabled. Please contact support.',
      shouldRetry: false,
      requiresUserAction: true,
    },

    // Too many requests
    'auth/too-many-requests': {
      code: 'auth/too-many-requests',
      userMessage: language === 'he'
        ? 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.'
        : 'Too many failed attempts. Please try again in a few minutes.',
      shouldRetry: true,
      requiresUserAction: true,
    },

    // Session errors
    'auth/requires-recent-login': {
      code: 'auth/requires-recent-login',
      userMessage: language === 'he'
        ? 'יש להתחבר מחדש כדי לבצע פעולה זו.'
        : 'Please sign in again to perform this action.',
      shouldRetry: true,
      requiresUserAction: true,
    },

    // Provider errors
    'auth/account-exists-with-different-credential': {
      code: 'auth/account-exists-with-different-credential',
      userMessage: language === 'he'
        ? 'חשבון עם כתובת דוא״ל זו כבר קיים. נסה להתחבר בשיטה אחרת.'
        : 'An account with this email already exists. Try signing in with a different method.',
      shouldRetry: false,
      requiresUserAction: true,
    },
    'auth/credential-already-in-use': {
      code: 'auth/credential-already-in-use',
      userMessage: language === 'he'
        ? 'פרטי התחברות אלו כבר משוייכים לחשבון אחר.'
        : 'These credentials are already associated with a different account.',
      shouldRetry: false,
      requiresUserAction: true,
    },

    // Timeout
    'auth/timeout': {
      code: 'auth/timeout',
      userMessage: language === 'he'
        ? 'תם הזמן להתחברות. נסה שוב.'
        : 'Sign-in timed out. Please try again.',
      shouldRetry: true,
      requiresUserAction: true,
    },
  };

  // Return mapped error or default message
  return errorMap[error.code] || {
    code: error.code || 'unknown',
    userMessage: language === 'he'
      ? 'משהו השתבש. אנא נסה שוב.'
      : 'Something went wrong. Please try again.',
    technicalDetails: error.message,
    shouldRetry: true,
    requiresUserAction: false,
  };
}

/**
 * Logs auth errors for monitoring (Sentry integration)
 */
export function logAuthError(error: FirebaseError, context?: Record<string, any>): void {
  // In production, this would send to Sentry or logging service
  console.error('[Auth Error]', {
    code: error.code,
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
  });
}

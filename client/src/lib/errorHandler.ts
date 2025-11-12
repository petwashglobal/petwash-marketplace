/**
 * Centralized Error Handling System 2025
 * 
 * User-friendly error handling for Pet Wash™:
 * - Catches and logs all errors
 * - Shows bilingual user-friendly messages
 * - Sends error reports to backend
 * - Integrates with Sentry for monitoring
 * - Provides recovery suggestions
 */

import { logger } from './logger';

export interface ErrorContext {
  context: string;              // Where the error occurred (e.g., 'payment', 'booking')
  userId?: string;              // Current user ID
  action?: string;              // What action was being performed
  metadata?: Record<string, any>; // Additional context
}

export interface ErrorReport {
  message: string;
  stack?: string;
  context: string;
  userId?: string;
  action?: string;
  metadata?: Record<string, any>;
  url: string;
  userAgent: string;
  timestamp: string;
}

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

export class ErrorHandler {
  private static instance: ErrorHandler;
  private toastFunction: ((message: string, type: 'success' | 'error' | 'warning') => void) | null = null;

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!this.instance) {
      this.instance = new ErrorHandler();
    }
    return this.instance;
  }

  /**
   * Set toast function for user notifications
   */
  setToastFunction(fn: (message: string, type: 'success' | 'error' | 'warning') => void): void {
    this.toastFunction = fn;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, { context: 'unhandled-error', action: 'global' });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, { context: 'unhandled-rejection', action: 'promise' });
    });

    logger.debug('[ErrorHandler] ✅ Global error handlers installed');
  }

  /**
   * Handle an error with user-friendly message
   */
  handleError(error: any, errorContext: ErrorContext): void {
    // Log to console
    console.error(`❌ ERROR @ ${errorContext.context}:`, error);

    // Get user-friendly message
    const friendlyMessage = this.getFriendlyMessage(error, errorContext);

    // Show toast notification
    this.showToast(friendlyMessage, 'error');

    // Send to backend for logging
    this.reportToBackend(error, errorContext);

    // Log to Sentry (if configured)
    this.reportToSentry(error, errorContext);
  }

  /**
   * Get user-friendly error message (TRULY bilingual: shows BOTH Hebrew AND English)
   */
  private getFriendlyMessage(error: any, errorContext: ErrorContext): string {
    // Detect primary language for ordering
    const primaryLanguage = this.detectLanguage();

    // Bilingual error messages (both languages shown together)
    const messages: Record<string, { en: string; he: string }> = {
      network: {
        en: 'Connection issue. Please check your internet and try again.',
        he: 'בעיית חיבור. אנא בדוק את החיבור לאינטרנט ונסה שוב.',
      },
      auth: {
        en: 'Sign-in issue. Please try again or contact support.',
        he: 'בעיית התחברות. אנא נסה שוב או פנה לתמיכה.',
      },
      payment: {
        en: 'Payment failed. Please verify your details and try again.',
        he: 'התשלום נכשל. אנא בדוק את הפרטים ונסה שוב.',
      },
      booking: {
        en: 'Booking failed. Please try again or contact us for help.',
        he: 'ההזמנה נכשלה. אנא נסה שוב או צור איתנו קשר לעזרה.',
      },
      upload: {
        en: 'File upload failed. Please check the file size and format.',
        he: 'העלאת הקובץ נכשלה. אנא בדוק את גודל הקובץ והפורמט.',
      },
      validation: {
        en: 'Please check your input and try again.',
        he: 'אנא בדוק את הקלט ונסה שוב.',
      },
      timeout: {
        en: 'Request timed out. Please try again.',
        he: 'הבקשה פגה. אנא נסה שוב.',
      },
      generic: {
        en: 'Something went wrong. Please refresh and try again.',
        he: 'משהו השתבש. אנא רענן את הדף ונסה שוב.',
      },
    };

    // Determine error type
    let errorType = 'generic';

    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      errorType = 'network';
    } else if (errorContext.context === 'auth' || error?.code?.includes('auth')) {
      errorType = 'auth';
    } else if (errorContext.context === 'payment') {
      errorType = 'payment';
    } else if (errorContext.context === 'booking') {
      errorType = 'booking';
    } else if (errorContext.context === 'upload') {
      errorType = 'upload';
    } else if (error?.message?.includes('validation') || error?.message?.includes('invalid')) {
      errorType = 'validation';
    } else if (error?.message?.includes('timeout')) {
      errorType = 'timeout';
    }

    // Return BOTH languages (Hebrew first if Hebrew user, English first otherwise)
    const msg = messages[errorType];
    if (primaryLanguage === 'he') {
      return `${msg.he}\n${msg.en}`;
    } else {
      return `${msg.en}\n${msg.he}`;
    }
  }

  /**
   * Detect primary language for message ordering
   */
  private detectLanguage(): 'en' | 'he' {
    if (typeof window === 'undefined') return 'en';

    // Check localStorage
    const storedLang = localStorage.getItem('language');
    if (storedLang === 'he' || storedLang === 'ar') return 'he';
    if (storedLang === 'en') return 'en';

    // Check browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('he') || browserLang.startsWith('ar')) return 'he';

    // Default to English
    return 'en';
  }

  /**
   * Show toast notification
   */
  private showToast(message: string, type: 'success' | 'error' | 'warning'): void {
    if (this.toastFunction) {
      this.toastFunction(message, type);
    } else {
      // Fallback to alert if toast not configured
      if (type === 'error') {
        console.error(message);
      }
    }
  }

  /**
   * Report error to backend
   */
  private async reportToBackend(error: any, errorContext: ErrorContext): Promise<void> {
    try {
      const report: ErrorReport = {
        message: error?.message || String(error),
        stack: error?.stack,
        context: errorContext.context,
        userId: errorContext.userId,
        action: errorContext.action,
        metadata: errorContext.metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      await fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
        // Use keepalive to ensure error logs even during page unload
        keepalive: true,
      });

      logger.debug('[ErrorHandler] Error reported to backend');
    } catch (reportError) {
      // Silently fail - don't create infinite error loops
      console.debug('[ErrorHandler] Failed to report error to backend', reportError);
    }
  }

  /**
   * Report error to Sentry
   */
  private reportToSentry(error: any, errorContext: ErrorContext): void {
    if (typeof window === 'undefined') return;

    try {
      // Check if Sentry is available
      const Sentry = (window as any).Sentry;
      if (!Sentry) return;

      // Capture exception with context
      Sentry.captureException(error, {
        tags: {
          context: errorContext.context,
          action: errorContext.action,
        },
        extra: {
          userId: errorContext.userId,
          metadata: errorContext.metadata,
        },
      });

      logger.debug('[ErrorHandler] Error reported to Sentry');
    } catch (sentryError) {
      console.debug('[ErrorHandler] Failed to report to Sentry', sentryError);
    }
  }

  /**
   * Handle API errors with specific status codes (bilingual)
   */
  handleApiError(response: Response, errorContext: ErrorContext): void {
    const primaryLanguage = this.detectLanguage();

    const statusMessages: Record<number, { en: string; he: string }> = {
      400: {
        en: 'Invalid request. Please check your input.',
        he: 'בקשה לא תקינה. אנא בדוק את הקלט.',
      },
      401: {
        en: 'Please sign in to continue.',
        he: 'אנא התחבר כדי להמשיך.',
      },
      403: {
        en: 'You don\'t have permission to do this.',
        he: 'אין לך הרשאה לבצע פעולה זו.',
      },
      404: {
        en: 'Resource not found.',
        he: 'המשאב לא נמצא.',
      },
      409: {
        en: 'This action conflicts with existing data.',
        he: 'פעולה זו מתנגשת עם נתונים קיימים.',
      },
      429: {
        en: 'Too many requests. Please slow down.',
        he: 'יותר מדי בקשות. אנא האט.',
      },
      500: {
        en: 'Server error. Please try again later.',
        he: 'שגיאת שרת. אנא נסה שוב מאוחר יותר.',
      },
      502: {
        en: 'Service unavailable. Please try again.',
        he: 'השירות אינו זמין. אנא נסה שוב.',
      },
      503: {
        en: 'Service temporarily unavailable.',
        he: 'השירות אינו זמין זמנית.',
      },
    };

    const defaultMsg = {
      en: 'Something went wrong. Please try again.',
      he: 'משהו השתבש. אנא נסה שוב.',
    };

    const msg = statusMessages[response.status] || defaultMsg;
    const bilingualMessage = primaryLanguage === 'he' 
      ? `${msg.he}\n${msg.en}` 
      : `${msg.en}\n${msg.he}`;

    this.handleError(
      new Error(`API Error: ${response.status} ${response.statusText}`),
      { ...errorContext, metadata: { ...errorContext.metadata, status: response.status } }
    );

    this.showToast(bilingualMessage, 'error');
  }

  /**
   * Wrap async function with error handling
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    errorContext: ErrorContext
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, errorContext);
        throw error; // Re-throw for caller to handle if needed
      }
    }) as T;
  }

  /**
   * Try-catch wrapper with automatic error handling
   */
  async tryCatch<T>(
    fn: () => Promise<T>,
    errorContext: ErrorContext,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error, errorContext);
      return fallback;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Handle error with user-friendly message
 */
export function handleError(error: any, context: string, action?: string): void {
  ErrorHandler.getInstance().handleError(error, { context, action });
}

/**
 * Handle API error response
 */
export function handleApiError(response: Response, context: string): void {
  ErrorHandler.getInstance().handleApiError(response, { context });
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string,
  action?: string
): T {
  return ErrorHandler.getInstance().wrapAsync(fn, { context, action });
}

/**
 * Try-catch with automatic error handling
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  return ErrorHandler.getInstance().tryCatch(fn, { context }, fallback);
}

// ============================================================================
// INITIALIZE ON IMPORT
// ============================================================================

// Auto-initialize error handler
if (typeof window !== 'undefined') {
  ErrorHandler.getInstance();
}

export default ErrorHandler;

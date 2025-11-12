/**
 * Production-safe logger for client-side code
 * Only logs in development mode
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class ClientLogger {
  private isDev = import.meta.env.DEV;

  debug(...args: any[]) {
    if (this.isDev) {
      console.debug('[DEBUG]', ...args);
    }
  }

  info(...args: any[]) {
    if (this.isDev) {
      console.info('[INFO]', ...args);
    }
  }

  log(...args: any[]) {
    if (this.isDev) {
      console.log('[LOG]', ...args);
    }
  }

  warn(...args: any[]) {
    if (this.isDev) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: any[]) {
    // Always log errors, even in production (but sanitized)
    if (this.isDev) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, log minimal error info
      const sanitized = args.map(arg => {
        if (arg instanceof Error) {
          return { message: arg.message, name: arg.name };
        }
        return typeof arg === 'string' ? arg : '[Object]';
      });
      console.error('[ERROR]', ...sanitized);
    }
  }
}

export const logger = new ClientLogger();

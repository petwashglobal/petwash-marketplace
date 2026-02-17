/**
 * Production-safe structured logger for server-side code
 * Uses LOG_LEVEL from environment
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  userId?: string;
  [key: string]: any;
}

class ServerLogger {
  private level: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    this.level = this.levels[envLevel] !== undefined ? envLevel : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const log = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context
    };

    // In production (LOG_LEVEL=info or higher), output structured JSON
    if (process.env.APP_ENV === 'production') {
      return JSON.stringify(log);
    }
    
    // In development, output human-readable format
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${context ? ' ' + JSON.stringify(context) : ''}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    if (this.shouldLog('error')) {
      let errorFields: Record<string, any> = {};
      if (error && typeof error === 'object' && (error instanceof Error || error.message || error.stack)) {
        errorFields = {
          errorName: error.name || error.constructor?.name || 'Error',
          errorMessage: typeof error.message === 'string' ? error.message : String(error.message ?? error),
          errorCode: error.code,
          errorStack: process.env.APP_ENV !== 'production' ? error.stack : undefined
        };
      } else if (error !== undefined && error !== null) {
        errorFields = { error: typeof error === 'string' ? error : JSON.stringify(error) };
      }
      const errorContext = { ...context, ...errorFields };
      console.error(this.formatLog('error', message, errorContext));
    }
  }
}

export const logger = new ServerLogger();

// Helper to generate correlation IDs
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

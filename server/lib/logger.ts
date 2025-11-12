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
      const errorContext = {
        ...context,
        ...(error instanceof Error ? {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: process.env.APP_ENV !== 'production' ? error.stack : undefined
        } : { error: String(error) })
      };
      console.error(this.formatLog('error', message, errorContext));
    }
  }
}

export const logger = new ServerLogger();

// Helper to generate correlation IDs
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

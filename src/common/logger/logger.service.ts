/**
 * Lightweight Logger Service
 * 
 * Uses Pino for high-performance structured JSON logging.
 * Zero overhead in production, pretty printing in development.
 */
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      
      // Production: JSON for log aggregators
      // Development: Pretty print
      transport: process.env.NODE_ENV !== 'production' 
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,

      // Base context included in every log
      base: {
        service: 'restorae-api',
        env: process.env.NODE_ENV || 'development',
      },

      // Redact sensitive fields
      redact: {
        paths: ['req.headers.authorization', 'password', 'passwordHash', 'accessToken', 'refreshToken'],
        censor: '[REDACTED]',
      },

      // Custom serializers
      serializers: {
        err: pino.stdSerializers.err,
        req: (req) => ({
          method: req.method,
          url: req.url,
          userId: req.user?.id,
        }),
        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },
    });
  }

  /**
   * Get the underlying Pino instance for advanced usage
   */
  getPino(): Logger {
    return this.logger;
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: Record<string, any>): Logger {
    return this.logger.child(bindings);
  }

  // NestJS LoggerService interface implementation
  log(message: string, context?: string): void {
    this.logger.info({ context }, message);
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, message);
  }

  warn(message: string, context?: string): void {
    this.logger.warn({ context }, message);
  }

  debug(message: string, context?: string): void {
    this.logger.debug({ context }, message);
  }

  verbose(message: string, context?: string): void {
    this.logger.trace({ context }, message);
  }

  // Extended logging methods with structured data
  info(message: string, data?: Record<string, any>): void {
    this.logger.info(data, message);
  }

  logError(message: string, error?: Error, data?: Record<string, any>): void {
    this.logger.error({ err: error, ...data }, message);
  }

  logRequest(method: string, url: string, statusCode: number, durationMs: number, userId?: string): void {
    this.logger.info({
      type: 'http',
      method,
      url,
      statusCode,
      durationMs,
      userId,
    }, `${method} ${url} ${statusCode} ${durationMs}ms`);
  }

  logEvent(eventName: string, data?: Record<string, any>): void {
    this.logger.info({ type: 'event', event: eventName, ...data }, eventName);
  }
}

// Singleton instance for use outside DI
let loggerInstance: LoggerService | null = null;

export function getLogger(): LoggerService {
  if (!loggerInstance) {
    loggerInstance = new LoggerService();
  }
  return loggerInstance;
}

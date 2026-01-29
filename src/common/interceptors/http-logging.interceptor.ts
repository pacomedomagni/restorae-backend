/**
 * HTTP Logging Interceptor
 * 
 * Logs all HTTP requests with timing and tracks metrics.
 * Lightweight - just uses Pino and in-memory metrics.
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';
import { MetricsService } from '../health/metrics.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    private logger: LoggerService,
    private metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const { method, url, ip } = request;
    const userId = (request as any).user?.id;
    const startTime = Date.now();

    // Skip logging for health checks to reduce noise
    if (url.startsWith('/health') || url.startsWith('/metrics')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log the request
        this.logger.logRequest(method, url, statusCode, durationMs, userId);

        // Track metrics
        this.metrics.httpRequest(method, this.normalizePath(url), statusCode, durationMs);
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log the error
        this.logger.logError(`${method} ${url} ${statusCode}`, error, {
          durationMs,
          userId,
          ip,
        });

        // Track metrics
        this.metrics.httpRequest(method, this.normalizePath(url), statusCode, durationMs);
        this.metrics.error(error.name || 'UnknownError', error.message);

        throw error;
      }),
    );
  }

  /**
   * Normalize paths to prevent cardinality explosion in metrics
   * /users/123 -> /users/:id
   */
  private normalizePath(url: string): string {
    return url
      .split('?')[0] // Remove query params
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid') // UUIDs
      .replace(/\/\d+/g, '/:id'); // Numeric IDs
  }
}

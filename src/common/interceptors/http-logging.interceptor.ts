/**
 * HTTP Logging Interceptor
 *
 * Logs all HTTP requests with timing, correlation IDs, and tracks metrics.
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
import * as crypto from 'crypto';
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
    const userId = (request as Request & { user?: { id: string } }).user?.id;
    const startTime = Date.now();

    // Generate or reuse correlation ID from upstream
    const correlationId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    response.setHeader('x-request-id', correlationId);

    // Skip logging for health checks to reduce noise
    if (url.startsWith('/health') || url.startsWith('/metrics')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log the request with correlation ID
        this.logger.logRequest(method, url, statusCode, durationMs, userId, correlationId);

        // Track metrics
        this.metrics.httpRequest(method, this.normalizePath(url), statusCode, durationMs);
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log the error with correlation ID
        this.logger.logError(`${method} ${url} ${statusCode}`, error, {
          correlationId,
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

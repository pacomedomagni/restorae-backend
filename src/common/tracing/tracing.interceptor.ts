import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { TracingService } from './tracing.service';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  constructor(
    private tracingService: TracingService,
    private logger: LoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check for existing trace ID from upstream service
    const existingTraceId = request.headers['x-trace-id'] as string;
    const parentSpanId = request.headers['x-span-id'] as string;

    // Start the trace
    const operationName = `${request.method} ${request.route?.path || request.path}`;
    const trace = this.tracingService.startTrace(operationName, existingTraceId);

    // Add common tags
    this.tracingService.setTag('http.method', request.method);
    this.tracingService.setTag('http.url', request.url);
    this.tracingService.setTag('http.user_agent', request.headers['user-agent'] || 'unknown');
    
    if (parentSpanId) {
      this.tracingService.setTag('parent.span_id', parentSpanId);
    }

    // Set trace ID in response headers
    response.setHeader('x-trace-id', trace.traceId);
    response.setHeader('x-span-id', trace.spanId);

    // Add request ID to request object for downstream use
    (request as Request & { traceId: string }).traceId = trace.traceId;

    return next.handle().pipe(
      tap(() => {
        this.tracingService.setTag('http.status_code', response.statusCode);
        const traceData = this.tracingService.exportTrace();
        
        // Log trace summary
        if (traceData && (traceData.duration as number) > 1000) {
          this.logger.warn(`Slow request: ${operationName} took ${traceData.duration}ms`, 'TracingInterceptor');
        }
      }),
      catchError((error) => {
        this.tracingService.setTag('http.status_code', error.status || 500);
        this.tracingService.setTag('error', true);
        this.tracingService.endSpan(trace.spanId, error);
        
        const traceData = this.tracingService.exportTrace();
        this.logger.error(
          `Request failed: ${operationName}`,
          JSON.stringify(traceData),
          'TracingInterceptor',
        );
        
        return throwError(() => error);
      }),
    );
  }
}

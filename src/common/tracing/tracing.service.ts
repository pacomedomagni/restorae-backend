/**
 * Tracing Service
 * 
 * Provides distributed tracing capabilities with correlation IDs.
 * Tracks requests across services for debugging and observability.
 */
import { Injectable, Scope } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  serviceName: string;
  operationName: string;
  tags: Record<string, string | number | boolean>;
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
  status: 'ok' | 'error';
  errorMessage?: string;
}

@Injectable({ scope: Scope.REQUEST })
export class TracingService {
  private currentTrace: TraceContext | null = null;
  private spans: Map<string, Span> = new Map();
  private readonly serviceName = 'restorae-backend';

  /**
   * Start a new trace (typically at the beginning of an HTTP request)
   */
  startTrace(operationName: string, existingTraceId?: string): TraceContext {
    const traceId = existingTraceId || randomUUID();
    const spanId = randomUUID();

    this.currentTrace = {
      traceId,
      spanId,
      startTime: Date.now(),
      serviceName: this.serviceName,
      operationName,
      tags: {},
    };

    const rootSpan: Span = {
      spanId,
      traceId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    this.spans.set(spanId, rootSpan);
    return this.currentTrace;
  }

  /**
   * Start a child span (for nested operations)
   */
  startSpan(operationName: string): Span | null {
    if (!this.currentTrace) {
      return null;
    }

    const spanId = randomUUID();
    const span: Span = {
      spanId,
      traceId: this.currentTrace.traceId,
      parentSpanId: this.currentTrace.spanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    this.spans.set(spanId, span);
    return span;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, error?: Error): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    if (error) {
      span.status = 'error';
      span.errorMessage = error.message;
      span.logs.push({
        timestamp: Date.now(),
        message: error.stack || error.message,
        level: 'error',
      });
    }
  }

  /**
   * Add a tag to the current trace
   */
  setTag(key: string, value: string | number | boolean): void {
    if (this.currentTrace) {
      this.currentTrace.tags[key] = value;
    }
  }

  /**
   * Add a log entry to a span
   */
  log(spanId: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        level,
      });
    }
  }

  /**
   * Get the current trace ID
   */
  getTraceId(): string | null {
    return this.currentTrace?.traceId || null;
  }

  /**
   * Get the current span ID
   */
  getSpanId(): string | null {
    return this.currentTrace?.spanId || null;
  }

  /**
   * Get trace context for propagation to downstream services
   */
  getTraceContext(): { traceId: string; spanId: string } | null {
    if (!this.currentTrace) return null;
    return {
      traceId: this.currentTrace.traceId,
      spanId: this.currentTrace.spanId,
    };
  }

  /**
   * Finish the trace and return all spans
   */
  finishTrace(): Span[] {
    const allSpans = Array.from(this.spans.values());
    
    // End any open spans
    for (const span of allSpans) {
      if (!span.endTime) {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
      }
    }

    return allSpans;
  }

  /**
   * Export trace data in a format suitable for logging/storage
   */
  exportTrace(): Record<string, unknown> | null {
    if (!this.currentTrace) return null;

    const spans = this.finishTrace();
    const rootSpan = spans.find(s => !s.parentSpanId);

    return {
      traceId: this.currentTrace.traceId,
      serviceName: this.serviceName,
      operationName: this.currentTrace.operationName,
      startTime: this.currentTrace.startTime,
      endTime: rootSpan?.endTime,
      duration: rootSpan?.duration,
      tags: this.currentTrace.tags,
      spans: spans.map(s => ({
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        operationName: s.operationName,
        duration: s.duration,
        status: s.status,
        errorMessage: s.errorMessage,
        tags: s.tags,
        logs: s.logs,
      })),
    };
  }
}

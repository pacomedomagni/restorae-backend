/**
 * Lightweight Metrics Service
 * 
 * In-memory counters and histograms - no external dependencies.
 * Perfect for small to medium scale, exportable to any format.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histogramBuckets: Map<string, number[]> = new Map();
  private startTime: Date = new Date();

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histogramBuckets.get(key) || [];
    values.push(value);
    // Keep last 1000 values to prevent memory bloat
    if (values.length > 1000) values.shift();
    this.histogramBuckets.set(key, values);
  }

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
    return `${name}{${labelStr}}`;
  }

  getMetrics(): Record<string, any> {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    // Calculate histogram summaries
    const histograms: Record<string, any> = {};
    this.histogramBuckets.forEach((values, key) => {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        histograms[key] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)],
        };
      }
    });

    return {
      uptime_seconds: uptimeSeconds,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms,
      memory: {
        heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };
  }

  // Convenience methods for common metrics
  httpRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    this.increment('http_requests_total', 1, { method, status: String(statusCode) });
    this.histogram('http_request_duration_ms', durationMs, { method });
    
    if (statusCode >= 500) {
      this.increment('http_errors_5xx', 1);
    } else if (statusCode >= 400) {
      this.increment('http_errors_4xx', 1);
    }
  }

  dbQuery(operation: string, durationMs: number, success: boolean = true): void {
    this.increment('db_queries_total', 1, { operation, success: String(success) });
    this.histogram('db_query_duration_ms', durationMs, { operation });
  }

  authEvent(event: 'login' | 'logout' | 'register' | 'refresh', success: boolean): void {
    this.increment('auth_events_total', 1, { event, success: String(success) });
  }

  subscriptionEvent(event: 'started' | 'cancelled' | 'renewed'): void {
    this.increment('subscription_events_total', 1, { event });
  }

  error(type: string, context?: string): void {
    this.increment('errors_total', 1, { type, context: context || 'unknown' });
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histogramBuckets.clear();
    this.startTime = new Date();
  }
}

/**
 * Sentry Service
 * 
 * Abstraction layer for Sentry error tracking.
 * Allows easy swapping of error tracking providers.
 */
import { Injectable } from '@nestjs/common';

interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
}

interface ErrorContext {
  user?: { id: string; email?: string };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

interface BreadcrumbData {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}

@Injectable()
export class SentryService {
  private initialized = false;
  private config: SentryConfig | null = null;
  private breadcrumbs: BreadcrumbData[] = [];
  private maxBreadcrumbs = 100;

  // In production, you would import Sentry SDK here
  // import * as Sentry from '@sentry/node';

  /**
   * Initialize Sentry with configuration
   */
  init(config: SentryConfig): void {
    this.config = config;
    this.initialized = true;

    // In production with real Sentry SDK:
    // Sentry.init({
    //   dsn: config.dsn,
    //   environment: config.environment,
    //   release: config.release,
    //   tracesSampleRate: config.tracesSampleRate ?? 0.1,
    //   integrations: [
    //     new Sentry.Integrations.Http({ tracing: true }),
    //     new Sentry.Integrations.Express({ app }),
    //   ],
    // });

    console.log(`[Sentry] Initialized for environment: ${config.environment}`);
  }

  /**
   * Capture an exception with optional context
   */
  captureException(error: Error, context?: ErrorContext): string {
    const eventId = this.generateEventId();

    if (!this.initialized) {
      console.error('[Sentry] Not initialized, logging locally:', error.message);
      return eventId;
    }

    // In production with real Sentry SDK:
    // Sentry.withScope((scope) => {
    //   if (context?.user) {
    //     scope.setUser(context.user);
    //   }
    //   if (context?.tags) {
    //     Object.entries(context.tags).forEach(([key, value]) => {
    //       scope.setTag(key, value);
    //     });
    //   }
    //   if (context?.extra) {
    //     Object.entries(context.extra).forEach(([key, value]) => {
    //       scope.setExtra(key, value);
    //     });
    //   }
    //   if (context?.level) {
    //     scope.setLevel(context.level);
    //   }
    //   Sentry.captureException(error);
    // });

    console.error(`[Sentry] Exception captured (${eventId}):`, {
      message: error.message,
      stack: error.stack,
      context,
      breadcrumbs: this.breadcrumbs.slice(-10),
    });

    return eventId;
  }

  /**
   * Capture a message (non-exception event)
   */
  captureMessage(message: string, level: ErrorContext['level'] = 'info', context?: ErrorContext): string {
    const eventId = this.generateEventId();

    if (!this.initialized) {
      console.log(`[Sentry] Not initialized, logging locally: ${message}`);
      return eventId;
    }

    // In production:
    // Sentry.captureMessage(message, level);

    console.log(`[Sentry] Message captured (${eventId}):`, { message, level, context });
    return eventId;
  }

  /**
   * Add a breadcrumb for context tracking
   */
  addBreadcrumb(breadcrumb: BreadcrumbData): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      level: breadcrumb.level || 'info',
    });

    // Keep breadcrumbs under limit
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    // In production:
    // Sentry.addBreadcrumb({
    //   category: breadcrumb.category,
    //   message: breadcrumb.message,
    //   level: breadcrumb.level,
    //   data: breadcrumb.data,
    // });
  }

  /**
   * Set user context for all subsequent events
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    // In production:
    // Sentry.setUser(user);
    
    console.log('[Sentry] User context set:', user.id);
  }

  /**
   * Clear user context (on logout)
   */
  clearUser(): void {
    // In production:
    // Sentry.setUser(null);
  }

  /**
   * Set a tag for all subsequent events
   */
  setTag(key: string, value: string): void {
    // In production:
    // Sentry.setTag(key, value);
  }

  /**
   * Start a performance transaction
   */
  startTransaction(name: string, op: string): { finish: () => void; setStatus: (status: string) => void } {
    const startTime = Date.now();

    // In production:
    // return Sentry.startTransaction({ name, op });

    return {
      finish: () => {
        const duration = Date.now() - startTime;
        console.log(`[Sentry] Transaction finished: ${name} (${op}) - ${duration}ms`);
      },
      setStatus: (status: string) => {
        console.log(`[Sentry] Transaction status: ${status}`);
      },
    };
  }

  /**
   * Check if Sentry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get recent breadcrumbs (useful for debugging)
   */
  getBreadcrumbs(): BreadcrumbData[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clear all breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}

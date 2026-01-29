import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/health/metrics.service';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

export interface AnalyticsBatch {
  events: AnalyticsEvent[];
  userId?: string;
  anonymousId?: string;
  userProperties?: Record<string, any>;
  deviceInfo?: {
    platform?: string;
    platformVersion?: string;
    deviceModel?: string;
    appVersion?: string;
  };
}

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private metrics: MetricsService,
  ) {}

  async trackEvents(batch: AnalyticsBatch): Promise<{ received: number }> {
    const { events, userId, anonymousId, deviceInfo } = batch;

    // Track metrics
    this.metrics.increment('analytics_events_received', events.length);

    // Log events for debugging/analysis
    for (const event of events) {
      this.logger.debug(
        `Analytics event: ${event.name} user=${userId || anonymousId}`,
        'AnalyticsService'
      );

      // Track specific event types
      this.trackEventMetrics(event);

      // Store important events in database
      await this.storeSignificantEvent(event, userId, anonymousId);
    }

    return { received: events.length };
  }

  private trackEventMetrics(event: AnalyticsEvent): void {
    const eventName = event.name;

    // Track event categories
    if (eventName.startsWith('mood_')) {
      this.metrics.increment('app_mood_events', 1, { event: eventName });
    } else if (eventName.startsWith('breathing_')) {
      this.metrics.increment('app_breathing_events', 1, { event: eventName });
    } else if (eventName.startsWith('journal_')) {
      this.metrics.increment('app_journal_events', 1, { event: eventName });
    } else if (eventName.startsWith('subscription_')) {
      this.metrics.increment('app_subscription_events', 1, { event: eventName });
    } else if (eventName.startsWith('story_')) {
      this.metrics.increment('app_story_events', 1, { event: eventName });
    } else if (eventName === 'error_occurred') {
      this.metrics.increment('app_errors', 1, { 
        type: event.properties?.errorName || 'unknown' 
      });
    }
  }

  private async storeSignificantEvent(
    event: AnalyticsEvent,
    userId?: string,
    anonymousId?: string,
  ): Promise<void> {
    // Store conversion-critical events
    const significantEvents = [
      'sign_up_completed',
      'subscription_started',
      'subscription_completed',
      'subscription_cancelled',
      'trial_started',
      'onboarding_completed',
      'first_mood_checkin_funnel_completed',
      'first_breathing_funnel_completed',
    ];

    if (significantEvents.includes(event.name)) {
      try {
        // Store in a simple analytics table or just log for now
        this.logger.log(
          `Significant event: ${event.name} user=${userId || anonymousId}`,
          'AnalyticsService'
        );
      } catch (error) {
        this.logger.error(
          `Failed to store event: ${event.name}`,
          error instanceof Error ? error.stack : String(error),
          'AnalyticsService'
        );
      }
    }
  }

  async getEventCounts(period: 'hour' | 'day' | 'week' = 'day'): Promise<Record<string, number>> {
    // Return current metric counters related to app events
    const metrics = this.metrics.getMetrics();
    const counters = metrics.counters as Record<string, number>;
    
    // Filter for app-specific events
    const appEvents: Record<string, number> = {};
    for (const [key, value] of Object.entries(counters)) {
      if (key.startsWith('app_') || key.startsWith('analytics_')) {
        appEvents[key] = value;
      }
    }
    
    return appEvents;
  }
}

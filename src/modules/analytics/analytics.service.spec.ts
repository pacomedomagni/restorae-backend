import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AnalyticsService, AnalyticsBatch, AnalyticsEvent } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/health/metrics.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function createMockLoggerService() {
  return {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createMockMetricsService() {
  return {
    increment: jest.fn(),
    getMetrics: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function buildBatch(overrides: Partial<AnalyticsBatch> = {}): AnalyticsBatch {
  return {
    events: [],
    userId: 'user-123',
    anonymousId: undefined,
    userProperties: {},
    deviceInfo: {
      platform: 'ios',
      platformVersion: '17.0',
      deviceModel: 'iPhone 15',
      appVersion: '1.2.0',
    },
    ...overrides,
  };
}

function buildEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    name: 'test_event',
    properties: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: DeepMockProxy<PrismaService>;
  let logger: ReturnType<typeof createMockLoggerService>;
  let metrics: ReturnType<typeof createMockMetricsService>;

  beforeEach(async () => {
    logger = createMockLoggerService();
    metrics = createMockMetricsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: LoggerService, useValue: logger },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // trackEvents
  // =========================================================================
  describe('trackEvents', () => {
    it('should return { received: 0 } for an empty events array', async () => {
      const batch = buildBatch({ events: [] });

      const result = await service.trackEvents(batch);

      expect(result).toEqual({ received: 0 });
      expect(metrics.increment).toHaveBeenCalledWith('analytics_events_received', 0);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should return the correct count for multiple events', async () => {
      const events = [
        buildEvent({ name: 'screen_view' }),
        buildEvent({ name: 'button_tap' }),
        buildEvent({ name: 'scroll_depth' }),
      ];
      const batch = buildBatch({ events });

      const result = await service.trackEvents(batch);

      expect(result).toEqual({ received: 3 });
      expect(metrics.increment).toHaveBeenCalledWith('analytics_events_received', 3);
    });

    it('should log a debug message for each event with userId', async () => {
      const events = [
        buildEvent({ name: 'app_open' }),
        buildEvent({ name: 'app_close' }),
      ];
      const batch = buildBatch({ events, userId: 'user-abc' });

      await service.trackEvents(batch);

      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenCalledWith(
        'Analytics event: app_open user=user-abc',
        'AnalyticsService',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'Analytics event: app_close user=user-abc',
        'AnalyticsService',
      );
    });

    it('should fall back to anonymousId in debug log when userId is not provided', async () => {
      const events = [buildEvent({ name: 'app_open' })];
      const batch = buildBatch({
        events,
        userId: undefined,
        anonymousId: 'anon-456',
      });

      await service.trackEvents(batch);

      expect(logger.debug).toHaveBeenCalledWith(
        'Analytics event: app_open user=anon-456',
        'AnalyticsService',
      );
    });

    it('should log "undefined" when neither userId nor anonymousId is provided', async () => {
      const events = [buildEvent({ name: 'app_open' })];
      const batch = buildBatch({
        events,
        userId: undefined,
        anonymousId: undefined,
      });

      await service.trackEvents(batch);

      expect(logger.debug).toHaveBeenCalledWith(
        'Analytics event: app_open user=undefined',
        'AnalyticsService',
      );
    });

    // -----------------------------------------------------------------------
    // Event metric tracking by category prefix
    // -----------------------------------------------------------------------
    it('should increment app_mood_events for mood_ prefixed events', async () => {
      const events = [buildEvent({ name: 'mood_checkin_completed' })];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_mood_events', 1, {
        event: 'mood_checkin_completed',
      });
    });

    it('should increment app_breathing_events for breathing_ prefixed events', async () => {
      const events = [buildEvent({ name: 'breathing_session_started' })];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_breathing_events', 1, {
        event: 'breathing_session_started',
      });
    });

    it('should increment app_journal_events for journal_ prefixed events', async () => {
      const events = [buildEvent({ name: 'journal_entry_saved' })];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_journal_events', 1, {
        event: 'journal_entry_saved',
      });
    });

    it('should increment app_subscription_events for subscription_ prefixed events', async () => {
      const events = [buildEvent({ name: 'subscription_started' })];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_subscription_events', 1, {
        event: 'subscription_started',
      });
    });

    it('should increment app_story_events for story_ prefixed events', async () => {
      const events = [buildEvent({ name: 'story_played' })];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_story_events', 1, {
        event: 'story_played',
      });
    });

    it('should increment app_errors for error_occurred event with errorName property', async () => {
      const events = [
        buildEvent({
          name: 'error_occurred',
          properties: { errorName: 'NetworkError' },
        }),
      ];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_errors', 1, {
        type: 'NetworkError',
      });
    });

    it('should use "unknown" as error type when error_occurred has no errorName', async () => {
      const events = [
        buildEvent({
          name: 'error_occurred',
          properties: {},
        }),
      ];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(metrics.increment).toHaveBeenCalledWith('app_errors', 1, {
        type: 'unknown',
      });
    });

    it('should not increment category metrics for unrecognised event prefixes', async () => {
      const events = [buildEvent({ name: 'custom_unrecognised_event' })];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      // Only the top-level analytics_events_received counter should be called
      expect(metrics.increment).toHaveBeenCalledTimes(1);
      expect(metrics.increment).toHaveBeenCalledWith('analytics_events_received', 1);
    });

    // -----------------------------------------------------------------------
    // Significant event logging
    // -----------------------------------------------------------------------
    it('should log significant events via logger.log', async () => {
      const significantNames = [
        'sign_up_completed',
        'subscription_started',
        'subscription_completed',
        'subscription_cancelled',
        'trial_started',
        'onboarding_completed',
        'first_mood_checkin_funnel_completed',
        'first_breathing_funnel_completed',
      ];

      for (const name of significantNames) {
        jest.clearAllMocks();
        const events = [buildEvent({ name })];
        const batch = buildBatch({ events, userId: 'user-sig' });

        await service.trackEvents(batch);

        expect(logger.log).toHaveBeenCalledWith(
          `Significant event: ${name} user=user-sig`,
          'AnalyticsService',
        );
      }
    });

    it('should not log non-significant events via logger.log', async () => {
      const events = [
        buildEvent({ name: 'screen_view' }),
        buildEvent({ name: 'button_tap' }),
      ];
      const batch = buildBatch({ events });

      await service.trackEvents(batch);

      expect(logger.log).not.toHaveBeenCalled();
    });

    it('should log significant event with anonymousId when userId is absent', async () => {
      const events = [buildEvent({ name: 'trial_started' })];
      const batch = buildBatch({
        events,
        userId: undefined,
        anonymousId: 'anon-trial',
      });

      await service.trackEvents(batch);

      expect(logger.log).toHaveBeenCalledWith(
        'Significant event: trial_started user=anon-trial',
        'AnalyticsService',
      );
    });

    it('should correctly track a mixed batch of events', async () => {
      const events = [
        buildEvent({ name: 'mood_logged' }),
        buildEvent({ name: 'breathing_completed' }),
        buildEvent({ name: 'subscription_started' }),
        buildEvent({ name: 'screen_view' }),
        buildEvent({ name: 'error_occurred', properties: { errorName: 'Timeout' } }),
      ];
      const batch = buildBatch({ events, userId: 'user-mix' });

      const result = await service.trackEvents(batch);

      expect(result).toEqual({ received: 5 });
      expect(metrics.increment).toHaveBeenCalledWith('analytics_events_received', 5);
      expect(metrics.increment).toHaveBeenCalledWith('app_mood_events', 1, { event: 'mood_logged' });
      expect(metrics.increment).toHaveBeenCalledWith('app_breathing_events', 1, { event: 'breathing_completed' });
      expect(metrics.increment).toHaveBeenCalledWith('app_subscription_events', 1, { event: 'subscription_started' });
      expect(metrics.increment).toHaveBeenCalledWith('app_errors', 1, { type: 'Timeout' });
      // subscription_started is significant
      expect(logger.log).toHaveBeenCalledWith(
        'Significant event: subscription_started user=user-mix',
        'AnalyticsService',
      );
      // screen_view is not significant
      expect(logger.log).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledTimes(5);
    });
  });

  // =========================================================================
  // getEventCounts
  // =========================================================================
  describe('getEventCounts', () => {
    it('should return only counters prefixed with app_ or analytics_', async () => {
      metrics.getMetrics.mockReturnValue({
        counters: {
          app_mood_events: 10,
          app_breathing_events: 5,
          analytics_events_received: 42,
          http_requests_total: 999,
          db_queries_total: 500,
        },
        histograms: {},
        uptime_seconds: 3600,
        memory: { heapUsedMB: 50, heapTotalMB: 100, rssMB: 120 },
      });

      const result = await service.getEventCounts('day');

      expect(result).toEqual({
        app_mood_events: 10,
        app_breathing_events: 5,
        analytics_events_received: 42,
      });
      expect(result).not.toHaveProperty('http_requests_total');
      expect(result).not.toHaveProperty('db_queries_total');
    });

    it('should return an empty object when no app_ or analytics_ counters exist', async () => {
      metrics.getMetrics.mockReturnValue({
        counters: {
          http_requests_total: 100,
          errors_total: 3,
        },
        histograms: {},
        uptime_seconds: 1800,
        memory: { heapUsedMB: 40, heapTotalMB: 80, rssMB: 100 },
      });

      const result = await service.getEventCounts('hour');

      expect(result).toEqual({});
    });

    it('should return an empty object when counters map is empty', async () => {
      metrics.getMetrics.mockReturnValue({
        counters: {},
        histograms: {},
        uptime_seconds: 60,
        memory: { heapUsedMB: 30, heapTotalMB: 70, rssMB: 90 },
      });

      const result = await service.getEventCounts('week');

      expect(result).toEqual({});
    });

    it('should default period to "day" and still return filtered counters', async () => {
      metrics.getMetrics.mockReturnValue({
        counters: {
          app_story_events: 7,
          analytics_events_received: 20,
        },
        histograms: {},
        uptime_seconds: 7200,
        memory: { heapUsedMB: 55, heapTotalMB: 110, rssMB: 130 },
      });

      const result = await service.getEventCounts();

      expect(result).toEqual({
        app_story_events: 7,
        analytics_events_received: 20,
      });
    });

    it('should include all app_ sub-categories in the result', async () => {
      metrics.getMetrics.mockReturnValue({
        counters: {
          app_mood_events: 3,
          app_breathing_events: 8,
          app_journal_events: 2,
          app_subscription_events: 1,
          app_story_events: 4,
          app_errors: 6,
          analytics_events_received: 24,
        },
        histograms: {},
        uptime_seconds: 600,
        memory: { heapUsedMB: 45, heapTotalMB: 90, rssMB: 110 },
      });

      const result = await service.getEventCounts('day');

      expect(Object.keys(result)).toHaveLength(7);
      expect(result['app_mood_events']).toBe(3);
      expect(result['app_breathing_events']).toBe(8);
      expect(result['app_journal_events']).toBe(2);
      expect(result['app_subscription_events']).toBe(1);
      expect(result['app_story_events']).toBe(4);
      expect(result['app_errors']).toBe(6);
      expect(result['analytics_events_received']).toBe(24);
    });
  });
});

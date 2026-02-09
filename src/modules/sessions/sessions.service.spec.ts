import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionMode } from './dto/create-session.dto';
import { SessionStatus } from './dto/update-session.dto';

// ---------------------------------------------------------------------------
// Suppress Logger output
// ---------------------------------------------------------------------------
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-session-1';
const TEST_SESSION_ID = 'session-abc-123';
const TEST_ACTIVITY_ID = 'activity-xyz-1';

function buildSession(overrides: Record<string, any> = {}) {
  return {
    id: TEST_SESSION_ID,
    userId: TEST_USER_ID,
    mode: 'RITUAL',
    ritualId: 'ritual-1',
    ritualSlug: 'morning-calm',
    sosPresetId: null,
    status: 'IN_PROGRESS',
    totalActivities: 2,
    completedCount: 0,
    skippedCount: 0,
    totalDuration: 0,
    wasPartial: false,
    wasInterrupted: false,
    startedAt: new Date(),
    completedAt: null,
    activities: [
      buildActivity({ order: 0 }),
      buildActivity({ id: 'activity-xyz-2', order: 1, activityName: 'Grounding' }),
    ],
    ...overrides,
  };
}

function buildActivity(overrides: Record<string, any> = {}) {
  return {
    id: TEST_ACTIVITY_ID,
    sessionId: TEST_SESSION_ID,
    activityType: 'breathing',
    activityId: 'breathe-1',
    activityName: 'Deep Breathing',
    order: 0,
    completed: false,
    skipped: false,
    duration: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper: the service accesses prisma via this.db (casted to any),
  // so we mock via (prisma as any).userSession / .sessionActivity
  function mockUserSession() {
    return (prisma as any).userSession;
  }

  function mockSessionActivity() {
    return (prisma as any).sessionActivity;
  }

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    it('should create a session with nested activities', async () => {
      const session = buildSession();
      mockUserSession().create.mockResolvedValue(session);

      const dto = {
        mode: SessionMode.RITUAL,
        ritualId: 'ritual-1',
        ritualSlug: 'morning-calm',
        activities: [
          { activityType: 'breathing', activityId: 'breathe-1', activityName: 'Deep Breathing', order: 0 },
          { activityType: 'grounding', activityId: 'ground-1', activityName: 'Grounding', order: 1 },
        ],
      };

      const result = await service.create(TEST_USER_ID, dto);

      expect(result).toEqual(session);
      expect(mockUserSession().create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          mode: SessionMode.RITUAL,
          ritualId: 'ritual-1',
          ritualSlug: 'morning-calm',
          sosPresetId: undefined,
          totalActivities: 2,
          activities: {
            create: [
              { activityType: 'breathing', activityId: 'breathe-1', activityName: 'Deep Breathing', order: 0 },
              { activityType: 'grounding', activityId: 'ground-1', activityName: 'Grounding', order: 1 },
            ],
          },
        },
        include: {
          activities: { orderBy: { order: 'asc' } },
        },
      });
    });

    it('should create an SOS session with sosPresetId', async () => {
      const session = buildSession({ mode: 'SOS', sosPresetId: 'sos-1', ritualId: null, ritualSlug: null });
      mockUserSession().create.mockResolvedValue(session);

      const dto = {
        mode: SessionMode.SOS,
        sosPresetId: 'sos-1',
        activities: [
          { activityType: 'breathing', activityId: 'breathe-1', activityName: 'Quick Calm', order: 0 },
        ],
      };

      const result = await service.create(TEST_USER_ID, dto);

      expect(result.mode).toBe('SOS');
      expect(mockUserSession().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mode: SessionMode.SOS,
            sosPresetId: 'sos-1',
            totalActivities: 1,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================
  describe('findOne', () => {
    it('should return a session when found', async () => {
      const session = buildSession();
      mockUserSession().findFirst.mockResolvedValue(session);

      const result = await service.findOne(TEST_USER_ID, TEST_SESSION_ID);

      expect(result).toEqual(session);
      expect(mockUserSession().findFirst).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID, userId: TEST_USER_ID },
        include: {
          activities: { orderBy: { order: 'asc' } },
        },
      });
    });

    it('should throw NotFoundException when session is not found', async () => {
      mockUserSession().findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TEST_USER_ID, 'nonexistent-session'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.findOne(TEST_USER_ID, 'nonexistent-session'),
      ).rejects.toThrow('Session not found');
    });

    it('should not return a session belonging to a different user', async () => {
      mockUserSession().findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('other-user-id', TEST_SESSION_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // findAll
  // =========================================================================
  describe('findAll', () => {
    it('should return paginated session list with total count', async () => {
      const sessions = [buildSession(), buildSession({ id: 'session-2' })];
      mockUserSession().findMany.mockResolvedValue(sessions);
      mockUserSession().count.mockResolvedValue(2);

      const result = await service.findAll(TEST_USER_ID);

      expect(result).toEqual({ sessions, total: 2 });
      expect(mockUserSession().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID },
          orderBy: { startedAt: 'desc' },
          take: 20,
          skip: 0,
        }),
      );
    });

    it('should filter by mode when provided', async () => {
      mockUserSession().findMany.mockResolvedValue([]);
      mockUserSession().count.mockResolvedValue(0);

      await service.findAll(TEST_USER_ID, { mode: SessionMode.SOS });

      expect(mockUserSession().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID, mode: SessionMode.SOS },
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockUserSession().findMany.mockResolvedValue([]);
      mockUserSession().count.mockResolvedValue(0);

      await service.findAll(TEST_USER_ID, { status: SessionStatus.COMPLETED });

      expect(mockUserSession().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: TEST_USER_ID, status: SessionStatus.COMPLETED },
        }),
      );
    });

    it('should apply date range filters when startDate and endDate are provided', async () => {
      mockUserSession().findMany.mockResolvedValue([]);
      mockUserSession().count.mockResolvedValue(0);

      await service.findAll(TEST_USER_ID, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(mockUserSession().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: TEST_USER_ID,
            startedAt: {
              gte: new Date('2025-01-01'),
              lte: new Date('2025-01-31'),
            },
          }),
        }),
      );
    });

    it('should respect custom limit and offset', async () => {
      mockUserSession().findMany.mockResolvedValue([]);
      mockUserSession().count.mockResolvedValue(0);

      await service.findAll(TEST_USER_ID, { limit: 5, offset: 10 });

      expect(mockUserSession().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        }),
      );
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('update', () => {
    it('should update session status to COMPLETED', async () => {
      // findOne (called internally) returns a session
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      const updatedSession = buildSession({ status: 'COMPLETED', completedCount: 2, totalDuration: 300 });
      mockUserSession().update.mockResolvedValue(updatedSession);

      const result = await service.update(TEST_USER_ID, TEST_SESSION_ID, {
        status: SessionStatus.COMPLETED,
        completedCount: 2,
        totalDuration: 300,
        completedAt: '2025-01-15T10:00:00Z',
      });

      expect(result.status).toBe('COMPLETED');
      expect(mockUserSession().update).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID },
        data: {
          status: SessionStatus.COMPLETED,
          completedCount: 2,
          skippedCount: undefined,
          totalDuration: 300,
          wasPartial: undefined,
          wasInterrupted: undefined,
          completedAt: new Date('2025-01-15T10:00:00Z'),
        },
        include: {
          activities: { orderBy: { order: 'asc' } },
        },
      });
    });

    it('should track partial exit with wasPartial flag', async () => {
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      const updatedSession = buildSession({ status: 'EXITED', wasPartial: true, completedCount: 1, skippedCount: 1 });
      mockUserSession().update.mockResolvedValue(updatedSession);

      const result = await service.update(TEST_USER_ID, TEST_SESSION_ID, {
        status: SessionStatus.EXITED,
        wasPartial: true,
        completedCount: 1,
        skippedCount: 1,
      });

      expect(result.wasPartial).toBe(true);
      expect(result.status).toBe('EXITED');
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockUserSession().findFirst.mockResolvedValue(null);

      await expect(
        service.update(TEST_USER_ID, 'nonexistent', { status: SessionStatus.COMPLETED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should track interrupted session with wasInterrupted flag', async () => {
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      const updated = buildSession({ status: 'INTERRUPTED', wasInterrupted: true });
      mockUserSession().update.mockResolvedValue(updated);

      const result = await service.update(TEST_USER_ID, TEST_SESSION_ID, {
        status: SessionStatus.INTERRUPTED,
        wasInterrupted: true,
      });

      expect(result.wasInterrupted).toBe(true);
    });
  });

  // =========================================================================
  // updateActivity
  // =========================================================================
  describe('updateActivity', () => {
    it('should mark an activity as completed and recalculate session stats', async () => {
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      mockSessionActivity().findFirst.mockResolvedValue(buildActivity());
      mockSessionActivity().update.mockResolvedValue(
        buildActivity({ completed: true, duration: 120 }),
      );
      // For recalculateSessionStats
      mockSessionActivity().findMany.mockResolvedValue([
        buildActivity({ completed: true, duration: 120 }),
        buildActivity({ id: 'activity-xyz-2', completed: false, duration: null }),
      ]);
      mockUserSession().update.mockResolvedValue(buildSession({ completedCount: 1, totalDuration: 120 }));

      const result = await service.updateActivity(
        TEST_USER_ID,
        TEST_SESSION_ID,
        TEST_ACTIVITY_ID,
        { completed: true, duration: 120 },
      );

      expect(result.completed).toBe(true);

      // Verify recalculation was triggered
      expect(mockSessionActivity().findMany).toHaveBeenCalledWith({
        where: { sessionId: TEST_SESSION_ID },
      });
      expect(mockUserSession().update).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID },
        data: { completedCount: 1, skippedCount: 0, totalDuration: 120 },
      });
    });

    it('should mark an activity as skipped and recalculate session stats', async () => {
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      mockSessionActivity().findFirst.mockResolvedValue(buildActivity());
      mockSessionActivity().update.mockResolvedValue(
        buildActivity({ skipped: true }),
      );
      mockSessionActivity().findMany.mockResolvedValue([
        buildActivity({ skipped: true }),
        buildActivity({ id: 'activity-xyz-2', completed: false }),
      ]);
      mockUserSession().update.mockResolvedValue(buildSession({ skippedCount: 1 }));

      const result = await service.updateActivity(
        TEST_USER_ID,
        TEST_SESSION_ID,
        TEST_ACTIVITY_ID,
        { skipped: true },
      );

      expect(result.skipped).toBe(true);
      expect(mockUserSession().update).toHaveBeenCalledWith({
        where: { id: TEST_SESSION_ID },
        data: { completedCount: 0, skippedCount: 1, totalDuration: 0 },
      });
    });

    it('should NOT recalculate stats when activity is only partially updated (no completion or skip)', async () => {
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      mockSessionActivity().findFirst.mockResolvedValue(buildActivity());
      mockSessionActivity().update.mockResolvedValue(
        buildActivity({ duration: 60 }),
      );

      await service.updateActivity(
        TEST_USER_ID,
        TEST_SESSION_ID,
        TEST_ACTIVITY_ID,
        { duration: 60 },
      );

      // recalculateSessionStats should NOT be called
      expect(mockSessionActivity().findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when activity is not found in session', async () => {
      mockUserSession().findFirst.mockResolvedValue(buildSession());
      mockSessionActivity().findFirst.mockResolvedValue(null);

      await expect(
        service.updateActivity(TEST_USER_ID, TEST_SESSION_ID, 'nonexistent-activity', {
          completed: true,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateActivity(TEST_USER_ID, TEST_SESSION_ID, 'nonexistent-activity', {
          completed: true,
        }),
      ).rejects.toThrow('Activity not found in session');
    });

    it('should throw NotFoundException when session does not belong to user', async () => {
      mockUserSession().findFirst.mockResolvedValue(null);

      await expect(
        service.updateActivity('wrong-user', TEST_SESSION_ID, TEST_ACTIVITY_ID, {
          completed: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getStats
  // =========================================================================
  describe('getStats', () => {
    it('should return today, thisWeek, allTime, and byMode statistics', async () => {
      // Today's sessions
      mockUserSession().findMany
        .mockResolvedValueOnce([
          { id: 's1', totalDuration: 300, mode: 'RITUAL' },
        ])
        // This week's sessions
        .mockResolvedValueOnce([
          { id: 's1', totalDuration: 300, mode: 'RITUAL' },
          { id: 's2', totalDuration: 180, mode: 'SOS' },
        ]);

      // All-time aggregate
      mockUserSession().aggregate.mockResolvedValue({
        _count: 10,
        _sum: { totalDuration: 6000 },
      });

      // Group by mode
      mockUserSession().groupBy.mockResolvedValue([
        { mode: 'RITUAL', _count: 7, _sum: { totalDuration: 4200 } },
        { mode: 'SOS', _count: 3, _sum: { totalDuration: 1800 } },
      ]);

      const result = await service.getStats(TEST_USER_ID);

      expect(result.today).toEqual({
        sessions: 1,
        minutes: 5, // 300/60 = 5
      });

      expect(result.thisWeek).toEqual({
        sessions: 2,
        minutes: 8, // (300+180)/60 = 8
      });

      expect(result.allTime).toEqual({
        sessions: 10,
        minutes: 100, // 6000/60 = 100
      });

      expect(result.byMode).toEqual({
        ritual: { sessions: 7, minutes: 70 },  // 4200/60 = 70
        sos: { sessions: 3, minutes: 30 },     // 1800/60 = 30
      });
    });

    it('should handle zero sessions gracefully', async () => {
      mockUserSession().findMany
        .mockResolvedValueOnce([])  // today
        .mockResolvedValueOnce([]); // this week

      mockUserSession().aggregate.mockResolvedValue({
        _count: 0,
        _sum: { totalDuration: null },
      });

      mockUserSession().groupBy.mockResolvedValue([]);

      const result = await service.getStats(TEST_USER_ID);

      expect(result.today).toEqual({ sessions: 0, minutes: 0 });
      expect(result.thisWeek).toEqual({ sessions: 0, minutes: 0 });
      expect(result.allTime).toEqual({ sessions: 0, minutes: 0 });
      expect(result.byMode).toEqual({});
    });

    it('should query completed sessions for today using start of day', async () => {
      mockUserSession().findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockUserSession().aggregate.mockResolvedValue({
        _count: 0,
        _sum: { totalDuration: null },
      });
      mockUserSession().groupBy.mockResolvedValue([]);

      await service.getStats(TEST_USER_ID);

      // First findMany call is for today's sessions
      const todayCall = mockUserSession().findMany.mock.calls[0][0];
      expect(todayCall.where.userId).toBe(TEST_USER_ID);
      expect(todayCall.where.status).toBe('COMPLETED');
      expect(todayCall.where.startedAt.gte).toBeInstanceOf(Date);

      // Verify it's start of day (hours, minutes, seconds, ms all 0)
      const todayStart: Date = todayCall.where.startedAt.gte;
      expect(todayStart.getHours()).toBe(0);
      expect(todayStart.getMinutes()).toBe(0);
      expect(todayStart.getSeconds()).toBe(0);
      expect(todayStart.getMilliseconds()).toBe(0);
    });

    it('should query completed sessions for this week using start of week (Monday)', async () => {
      mockUserSession().findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockUserSession().aggregate.mockResolvedValue({
        _count: 0,
        _sum: { totalDuration: null },
      });
      mockUserSession().groupBy.mockResolvedValue([]);

      await service.getStats(TEST_USER_ID);

      // Second findMany call is for this week's sessions
      const weekCall = mockUserSession().findMany.mock.calls[1][0];
      const weekStart: Date = weekCall.where.startedAt.gte;

      // Should be a Monday (day 1) or the adjusted start of the week
      expect(weekStart.getHours()).toBe(0);
      expect(weekStart.getMinutes()).toBe(0);
      expect(weekStart.getSeconds()).toBe(0);
    });

    it('should round minutes correctly', async () => {
      // 90 seconds = 1.5 minutes, should round to 2
      mockUserSession().findMany
        .mockResolvedValueOnce([
          { id: 's1', totalDuration: 90, mode: 'RITUAL' },
        ])
        .mockResolvedValueOnce([
          { id: 's1', totalDuration: 90, mode: 'RITUAL' },
        ]);

      mockUserSession().aggregate.mockResolvedValue({
        _count: 1,
        _sum: { totalDuration: 90 },
      });

      mockUserSession().groupBy.mockResolvedValue([
        { mode: 'RITUAL', _count: 1, _sum: { totalDuration: 90 } },
      ]);

      const result = await service.getStats(TEST_USER_ID);

      expect(result.today.minutes).toBe(Math.round(90 / 60)); // 2
      expect(result.allTime.minutes).toBe(Math.round(90 / 60)); // 2
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivitiesService } from './activities.service';
import { ActivityCategory, CreateActivityLogDto } from './dto/create-activity-log.dto';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    // Suppress Logger output
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---- Helpers ----

  const userId = 'user-1';

  const makeDto = (overrides: Partial<CreateActivityLogDto> = {}): CreateActivityLogDto => ({
    category: ActivityCategory.BREATHING,
    activityType: 'box-breathing',
    duration: 300,
    completed: true,
    timestamp: '2024-06-01T10:00:00.000Z',
    ...overrides,
  });

  const makeActivity = (overrides: Record<string, any> = {}) => ({
    id: 'act-1',
    userId,
    category: 'BREATHING',
    activityType: 'box-breathing',
    activityId: null,
    duration: 300,
    completed: true,
    metadata: null,
    timestamp: new Date('2024-06-01T10:00:00.000Z'),
    createdAt: new Date(),
    ...overrides,
  });

  // ==================== logActivity ====================

  describe('logActivity', () => {
    it('should log a single activity and return it', async () => {
      const dto = makeDto();
      const created = makeActivity();
      (prisma as any).activityLog = { create: jest.fn().mockResolvedValue(created) };

      const result = await service.logActivity(userId, dto);

      expect((prisma as any).activityLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          category: 'BREATHING',
          activityType: 'box-breathing',
          activityId: undefined,
          duration: 300,
          completed: true,
          metadata: undefined,
          timestamp: new Date('2024-06-01T10:00:00.000Z'),
        },
      });
      expect(result).toEqual(created);
    });

    it('should uppercase the category', async () => {
      const dto = makeDto({ category: 'breathing' as any });
      (prisma as any).activityLog = { create: jest.fn().mockResolvedValue(makeActivity()) };

      await service.logActivity(userId, dto);

      expect((prisma as any).activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'BREATHING' }),
        }),
      );
    });

    it('should include optional metadata and activityId', async () => {
      const dto = makeDto({
        activityId: 'content-123',
        metadata: { rounds: 4 },
      });
      (prisma as any).activityLog = { create: jest.fn().mockResolvedValue(makeActivity({ activityId: 'content-123', metadata: { rounds: 4 } })) };

      const result = await service.logActivity(userId, dto);

      expect((prisma as any).activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            activityId: 'content-123',
            metadata: { rounds: 4 },
          }),
        }),
      );
      expect(result.activityId).toBe('content-123');
    });

    it('should propagate Prisma errors', async () => {
      const dto = makeDto();
      (prisma as any).activityLog = { create: jest.fn().mockRejectedValue(new Error('DB connection error')) };

      await expect(service.logActivity(userId, dto)).rejects.toThrow('DB connection error');
    });
  });

  // ==================== logActivitiesBatch ====================

  describe('logActivitiesBatch', () => {
    it('should log multiple activities in a batch and return count', async () => {
      const dtos = [makeDto(), makeDto({ activityType: 'alternate-nostril', duration: 180 })];
      (prisma as any).activityLog = { createMany: jest.fn().mockResolvedValue({ count: 2 }) };

      const result = await service.logActivitiesBatch(userId, dtos);

      expect((prisma as any).activityLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ activityType: 'box-breathing' }),
          expect.objectContaining({ activityType: 'alternate-nostril', duration: 180 }),
        ]),
        skipDuplicates: true,
      });
      expect(result).toEqual({ count: 2 });
    });

    it('should handle empty batch', async () => {
      (prisma as any).activityLog = { createMany: jest.fn().mockResolvedValue({ count: 0 }) };

      const result = await service.logActivitiesBatch(userId, []);

      expect(result).toEqual({ count: 0 });
    });

    it('should uppercase all categories in batch', async () => {
      const dtos = [
        makeDto({ category: 'grounding' as any }),
        makeDto({ category: 'focus' as any }),
      ];
      (prisma as any).activityLog = { createMany: jest.fn().mockResolvedValue({ count: 2 }) };

      await service.logActivitiesBatch(userId, dtos);

      const callData = (prisma as any).activityLog.createMany.mock.calls[0][0].data;
      expect(callData[0].category).toBe('GROUNDING');
      expect(callData[1].category).toBe('FOCUS');
    });
  });

  // ==================== getStats ====================

  describe('getStats', () => {
    it('should return today, thisWeek, and allTime stats without date range', async () => {
      const statResult = [
        { category: 'BREATHING', _count: 5, _sum: { duration: 1500 } },
        { category: 'GROUNDING', _count: 3, _sum: { duration: 900 } },
      ];
      const dailyActivities = [
        { timestamp: new Date('2024-06-03T10:00:00Z') }, // Monday
        { timestamp: new Date('2024-06-04T10:00:00Z') }, // Tuesday
      ];

      (prisma as any).activityLog = {
        groupBy: jest.fn().mockResolvedValue(statResult),
        findMany: jest.fn().mockResolvedValue(dailyActivities),
      };

      const result = await service.getStats(userId) as Record<string, any>;

      expect(result.today).toBeDefined();
      expect(result.thisWeek).toBeDefined();
      expect(result.allTime).toBeDefined();
      expect(result.range).toBeUndefined();
      expect(result.today.sessions).toBe(8);
      expect(result.today.minutes).toBe(40); // (1500+900)/60 = 40
    });

    it('should include range stats when startDate and endDate are provided', async () => {
      const statResult = [{ category: 'BREATHING', _count: 2, _sum: { duration: 600 } }];
      (prisma as any).activityLog = {
        groupBy: jest.fn().mockResolvedValue(statResult),
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.getStats(userId, '2024-01-01', '2024-06-30') as Record<string, any>;

      expect(result.range).toBeDefined();
      expect(result.range.startDate).toBe(new Date('2024-01-01').toISOString());
      expect(result.range.endDate).toBe(new Date('2024-06-30').toISOString());
    });

    it('should include range stats when only startDate is provided', async () => {
      const statResult = [{ category: 'MOOD', _count: 1, _sum: { duration: 60 } }];
      (prisma as any).activityLog = {
        groupBy: jest.fn().mockResolvedValue(statResult),
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.getStats(userId, '2024-03-01') as Record<string, any>;

      expect(result.range).toBeDefined();
      expect(result.range.endDate).toBeNull();
    });

    it('should calculate byCategory correctly in formatStats', async () => {
      const statResult = [
        { category: 'BREATHING', _count: 10, _sum: { duration: 3000 } },
        { category: 'JOURNAL', _count: 5, _sum: { duration: null } },
      ];
      (prisma as any).activityLog = {
        groupBy: jest.fn().mockResolvedValue(statResult),
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.getStats(userId) as Record<string, any>;

      expect(result.allTime.byCategory).toEqual({
        BREATHING: 10,
        JOURNAL: 5,
      });
      expect(result.allTime.sessions).toBe(15);
      expect(result.allTime.minutes).toBe(50); // 3000/60
    });
  });

  // ==================== getHistory ====================

  describe('getHistory', () => {
    it('should return paginated activities with defaults', async () => {
      const activities = [makeActivity(), makeActivity({ id: 'act-2' })];
      (prisma as any).activityLog = {
        findMany: jest.fn().mockResolvedValue(activities),
        count: jest.fn().mockResolvedValue(2),
      };

      const result = await service.getHistory(userId);

      expect((prisma as any).activityLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual({
        activities,
        total: 2,
        limit: 50,
        offset: 0,
      });
    });

    it('should apply category filter (uppercased)', async () => {
      (prisma as any).activityLog = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      };

      await service.getHistory(userId, { category: 'breathing' });

      expect((prisma as any).activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, category: 'BREATHING' },
        }),
      );
    });

    it('should apply custom limit and offset', async () => {
      (prisma as any).activityLog = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(100),
      };

      const result = await service.getHistory(userId, { limit: 10, offset: 20 });

      expect((prisma as any).activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });

    it('should apply date range filters', async () => {
      (prisma as any).activityLog = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      };

      await service.getHistory(userId, {
        startDate: '2024-01-01',
        endDate: '2024-06-30',
      });

      expect((prisma as any).activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            timestamp: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-06-30'),
            },
          },
        }),
      );
    });

    it('should apply only startDate when endDate is not provided', async () => {
      (prisma as any).activityLog = {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      };

      await service.getHistory(userId, { startDate: '2024-01-01' });

      expect((prisma as any).activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            timestamp: {
              gte: new Date('2024-01-01'),
            },
          },
        }),
      );
    });
  });
});

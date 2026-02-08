import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { MoodType, MoodContext } from '@prisma/client';
import { MoodService } from './mood.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMoodEntryDto } from './dto/create-mood-entry.dto';
import { UpdateMoodEntryDto } from './dto/update-mood-entry.dto';

describe('MoodService', () => {
  let service: MoodService;
  let prisma: DeepMockProxy<PrismaService>;

  const userId = 'user-123';

  const baseMoodEntry = {
    id: 'entry-1',
    userId,
    mood: MoodType.GOOD,
    note: 'Feeling great',
    context: MoodContext.MANUAL,
    factors: ['exercise', 'sleep'],
    timestamp: new Date('2026-02-08T10:00:00Z'),
    createdAt: new Date('2026-02-08T10:00:00Z'),
    updatedAt: new Date('2026-02-08T10:00:00Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoodService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
      ],
    }).compile();

    service = module.get<MoodService>(MoodService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a mood entry with default context and factors', async () => {
      const dto: CreateMoodEntryDto = {
        mood: MoodType.GOOD,
      };

      prisma.moodEntry.create.mockResolvedValue({
        ...baseMoodEntry,
        note: null,
        factors: [],
        context: MoodContext.MANUAL,
      });

      const result = await service.create(userId, dto);

      expect(prisma.moodEntry.create).toHaveBeenCalledWith({
        data: {
          userId,
          mood: MoodType.GOOD,
          note: undefined,
          context: MoodContext.MANUAL,
          factors: [],
          timestamp: expect.any(Date),
        },
      });
      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should create a mood entry with all fields provided', async () => {
      const dto: CreateMoodEntryDto = {
        mood: MoodType.ENERGIZED,
        note: 'Morning workout done',
        context: MoodContext.MORNING,
        factors: ['exercise', 'nutrition'],
        timestamp: '2026-02-08T08:00:00Z',
      };

      const expectedEntry = {
        ...baseMoodEntry,
        mood: MoodType.ENERGIZED,
        note: 'Morning workout done',
        context: MoodContext.MORNING,
        factors: ['exercise', 'nutrition'],
        timestamp: new Date('2026-02-08T08:00:00Z'),
      };

      prisma.moodEntry.create.mockResolvedValue(expectedEntry);

      const result = await service.create(userId, dto);

      expect(prisma.moodEntry.create).toHaveBeenCalledWith({
        data: {
          userId,
          mood: MoodType.ENERGIZED,
          note: 'Morning workout done',
          context: MoodContext.MORNING,
          factors: ['exercise', 'nutrition'],
          timestamp: new Date('2026-02-08T08:00:00Z'),
        },
      });
      expect(result.mood).toBe(MoodType.ENERGIZED);
      expect(result.context).toBe(MoodContext.MORNING);
      expect(result.factors).toEqual(['exercise', 'nutrition']);
    });

    it('should default context to MANUAL when not provided', async () => {
      const dto: CreateMoodEntryDto = {
        mood: MoodType.CALM,
        note: 'Peaceful evening',
      };

      prisma.moodEntry.create.mockResolvedValue({
        ...baseMoodEntry,
        mood: MoodType.CALM,
        note: 'Peaceful evening',
        context: MoodContext.MANUAL,
      });

      await service.create(userId, dto);

      expect(prisma.moodEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: MoodContext.MANUAL,
        }),
      });
    });

    it('should default factors to empty array when not provided', async () => {
      const dto: CreateMoodEntryDto = {
        mood: MoodType.LOW,
      };

      prisma.moodEntry.create.mockResolvedValue({
        ...baseMoodEntry,
        mood: MoodType.LOW,
        factors: [],
      });

      await service.create(userId, dto);

      expect(prisma.moodEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          factors: [],
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated results with default limit and offset', async () => {
      const entries = [baseMoodEntry, { ...baseMoodEntry, id: 'entry-2' }];
      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const result = await service.findAll(userId);

      expect(prisma.moodEntry.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
      expect(result).toHaveLength(2);
    });

    it('should return paginated results with custom limit and offset', async () => {
      prisma.moodEntry.findMany.mockResolvedValue([baseMoodEntry]);

      const result = await service.findAll(userId, 10, 20);

      expect(prisma.moodEntry.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 20,
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no entries exist', async () => {
      prisma.moodEntry.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });

    it('should exclude soft-deleted entries', async () => {
      prisma.moodEntry.findMany.mockResolvedValue([]);

      await service.findAll(userId);

      expect(prisma.moodEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  describe('findByDateRange', () => {
    it('should return entries within the specified date range', async () => {
      const start = new Date('2026-02-01T00:00:00Z');
      const end = new Date('2026-02-07T23:59:59Z');
      const entries = [baseMoodEntry];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const result = await service.findByDateRange(userId, start, end);

      expect(prisma.moodEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
          timestamp: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { timestamp: 'desc' },
      });
      expect(result).toEqual(entries);
    });

    it('should return empty array when no entries in range', async () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const end = new Date('2025-01-31T23:59:59Z');

      prisma.moodEntry.findMany.mockResolvedValue([]);

      const result = await service.findByDateRange(userId, start, end);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a mood entry when found', async () => {
      prisma.moodEntry.findFirst.mockResolvedValue(baseMoodEntry);

      const result = await service.findOne(userId, 'entry-1');

      expect(prisma.moodEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId, deletedAt: null },
      });
      expect(result).toEqual(baseMoodEntry);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.moodEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with correct message', async () => {
      prisma.moodEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(
        'Mood entry not found',
      );
    });
  });

  describe('update', () => {
    it('should update mood entry after verifying it exists', async () => {
      const dto: UpdateMoodEntryDto = {
        mood: MoodType.ENERGIZED,
        note: 'Updated note',
      };

      const updatedEntry = {
        ...baseMoodEntry,
        mood: MoodType.ENERGIZED,
        note: 'Updated note',
      };

      prisma.moodEntry.findFirst.mockResolvedValue(baseMoodEntry);
      prisma.moodEntry.update.mockResolvedValue(updatedEntry);

      const result = await service.update(userId, 'entry-1', dto);

      expect(prisma.moodEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId, deletedAt: null },
      });
      expect(prisma.moodEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          mood: MoodType.ENERGIZED,
          note: 'Updated note',
          context: undefined,
          factors: undefined,
        },
      });
      expect(result.mood).toBe(MoodType.ENERGIZED);
      expect(result.note).toBe('Updated note');
    });

    it('should update only provided fields', async () => {
      const dto: UpdateMoodEntryDto = {
        note: 'Only updating the note',
      };

      prisma.moodEntry.findFirst.mockResolvedValue(baseMoodEntry);
      prisma.moodEntry.update.mockResolvedValue({
        ...baseMoodEntry,
        note: 'Only updating the note',
      });

      await service.update(userId, 'entry-1', dto);

      expect(prisma.moodEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          mood: undefined,
          note: 'Only updating the note',
          context: undefined,
          factors: undefined,
        },
      });
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.moodEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, 'nonexistent', { mood: MoodType.CALM }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.moodEntry.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete by setting deletedAt timestamp', async () => {
      const deletedEntry = {
        ...baseMoodEntry,
        deletedAt: new Date(),
      };

      prisma.moodEntry.findFirst.mockResolvedValue(baseMoodEntry);
      prisma.moodEntry.update.mockResolvedValue(deletedEntry);

      const result = await service.delete(userId, 'entry-1');

      expect(prisma.moodEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId, deletedAt: null },
      });
      expect(prisma.moodEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.moodEntry.findFirst.mockResolvedValue(null);

      await expect(service.delete(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.moodEntry.update).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct stats for empty entries', async () => {
      prisma.moodEntry.findMany.mockResolvedValue([]);

      const stats = await service.getStats(userId);

      expect(stats.totalEntries).toBe(0);
      expect(stats.weeklyEntries).toBe(0);
      expect(stats.monthlyEntries).toBe(0);
      expect(stats.mostCommonMood).toBeNull();
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
      expect(stats.lastSevenDays).toEqual([]);
      expect(stats.moodTrend).toBe('insufficient');
      expect(stats.moodDistribution).toEqual({
        ENERGIZED: 0,
        CALM: 0,
        ANXIOUS: 0,
        LOW: 0,
        GOOD: 0,
        TOUGH: 0,
      });
    });

    it('should calculate mood distribution correctly', async () => {
      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.GOOD, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.GOOD, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e3', mood: MoodType.CALM, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e4', mood: MoodType.ANXIOUS, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e5', mood: MoodType.ENERGIZED, timestamp: new Date() },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.moodDistribution.GOOD).toBe(2);
      expect(stats.moodDistribution.CALM).toBe(1);
      expect(stats.moodDistribution.ANXIOUS).toBe(1);
      expect(stats.moodDistribution.ENERGIZED).toBe(1);
      expect(stats.moodDistribution.LOW).toBe(0);
      expect(stats.moodDistribution.TOUGH).toBe(0);
    });

    it('should identify the most common mood', async () => {
      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.CALM, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.CALM, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e3', mood: MoodType.CALM, timestamp: new Date() },
        { ...baseMoodEntry, id: 'e4', mood: MoodType.GOOD, timestamp: new Date() },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.mostCommonMood).toBe(MoodType.CALM);
    });

    it('should calculate current and longest streaks', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const entries = [
        { ...baseMoodEntry, id: 'e1', timestamp: today },
        { ...baseMoodEntry, id: 'e2', timestamp: yesterday },
        { ...baseMoodEntry, id: 'e3', timestamp: twoDaysAgo },
        { ...baseMoodEntry, id: 'e4', timestamp: threeDaysAgo },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.currentStreak).toBeGreaterThanOrEqual(1);
      expect(stats.longestStreak).toBeGreaterThanOrEqual(stats.currentStreak);
    });

    it('should count weekly entries correctly', async () => {
      const now = new Date();
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 10);

      const entries = [
        { ...baseMoodEntry, id: 'e1', timestamp: now },
        { ...baseMoodEntry, id: 'e2', timestamp: now },
        { ...baseMoodEntry, id: 'e3', timestamp: lastWeek },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.totalEntries).toBe(3);
      expect(stats.weeklyEntries).toBe(2);
    });

    it('should count monthly entries correctly', async () => {
      const now = new Date();
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 2);

      const entries = [
        { ...baseMoodEntry, id: 'e1', timestamp: now },
        { ...baseMoodEntry, id: 'e2', timestamp: now },
        { ...baseMoodEntry, id: 'e3', timestamp: lastMonth },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.monthlyEntries).toBe(2);
    });

    it('should return last seven days entries', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.GOOD, timestamp: now },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.CALM, timestamp: threeDaysAgo },
        { ...baseMoodEntry, id: 'e3', mood: MoodType.LOW, timestamp: tenDaysAgo },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.lastSevenDays).toHaveLength(2);
    });

    it('should return "insufficient" trend when fewer than 3 entries in last 7 days', async () => {
      const now = new Date();

      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.GOOD, timestamp: now },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.CALM, timestamp: now },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.moodTrend).toBe('insufficient');
    });

    it('should return "improving" trend when recent moods score higher', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const fourDaysAgo = new Date(now);
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      // Recent entries (higher scores) followed by older entries (lower scores)
      // Entries are ordered desc by timestamp, so recent ones are first
      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.ENERGIZED, timestamp: now },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.ENERGIZED, timestamp: oneDayAgo },
        { ...baseMoodEntry, id: 'e3', mood: MoodType.GOOD, timestamp: twoDaysAgo },
        { ...baseMoodEntry, id: 'e4', mood: MoodType.LOW, timestamp: threeDaysAgo },
        { ...baseMoodEntry, id: 'e5', mood: MoodType.LOW, timestamp: fourDaysAgo },
        { ...baseMoodEntry, id: 'e6', mood: MoodType.LOW, timestamp: fiveDaysAgo },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.moodTrend).toBe('improving');
    });

    it('should return "declining" trend when recent moods score lower', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const fourDaysAgo = new Date(now);
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const fiveDaysAgo = new Date(now);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      // Recent entries (lower scores) followed by older entries (higher scores)
      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.LOW, timestamp: now },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.LOW, timestamp: oneDayAgo },
        { ...baseMoodEntry, id: 'e3', mood: MoodType.TOUGH, timestamp: twoDaysAgo },
        { ...baseMoodEntry, id: 'e4', mood: MoodType.ENERGIZED, timestamp: threeDaysAgo },
        { ...baseMoodEntry, id: 'e5', mood: MoodType.ENERGIZED, timestamp: fourDaysAgo },
        { ...baseMoodEntry, id: 'e6', mood: MoodType.GOOD, timestamp: fiveDaysAgo },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.moodTrend).toBe('declining');
    });

    it('should return "stable" trend when mood scores are consistent', async () => {
      const now = new Date();
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // All same mood = same scores = diff of 0 = stable
      const entries = [
        { ...baseMoodEntry, id: 'e1', mood: MoodType.GOOD, timestamp: now },
        { ...baseMoodEntry, id: 'e2', mood: MoodType.GOOD, timestamp: oneDayAgo },
        { ...baseMoodEntry, id: 'e3', mood: MoodType.GOOD, timestamp: twoDaysAgo },
        { ...baseMoodEntry, id: 'e4', mood: MoodType.GOOD, timestamp: threeDaysAgo },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.moodTrend).toBe('stable');
    });

    it('should calculate streak as 0 when no entries are from today or yesterday', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const entries = [
        { ...baseMoodEntry, id: 'e1', timestamp: fiveDaysAgo },
      ];

      prisma.moodEntry.findMany.mockResolvedValue(entries);

      const stats = await service.getStats(userId);

      expect(stats.currentStreak).toBe(0);
    });
  });
});

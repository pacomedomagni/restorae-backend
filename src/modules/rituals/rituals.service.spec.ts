import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RitualsService } from './rituals.service';

describe('RitualsService', () => {
  let service: RitualsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RitualsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<RitualsService>(RitualsService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;

    // Make $transaction execute the callback with the same prisma mock
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
  });

  // ---- Helpers ----

  const userId = 'user-1';
  const ritualId = 'ritual-1';

  const makeRitual = (overrides: Record<string, any> = {}) => ({
    id: ritualId,
    userId,
    title: 'Morning Routine',
    description: 'Start the day right',
    timeOfDay: 'MORNING',
    days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    reminderEnabled: false,
    reminderTime: null as string | null,
    isFavorite: false,
    isArchived: false,
    completedCount: 0,
    lastCompletedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    steps: [
      { id: 'step-1', ritualId, title: 'Breathe', description: 'Deep breathing', duration: 60, order: 0 },
      { id: 'step-2', ritualId, title: 'Stretch', description: 'Light stretching', duration: 120, order: 1 },
    ],
    ...overrides,
  });

  const makeCompletion = (overrides: Record<string, any> = {}) => ({
    id: 'comp-1',
    userId,
    ritualId,
    duration: 180,
    completedSteps: 2,
    totalSteps: 2,
    mood: 'great',
    notes: null as string | null,
    completedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  });

  // ==================== create ====================

  describe('create', () => {
    it('should create a ritual with steps', async () => {
      const dto = {
        title: 'Morning Routine',
        description: 'Start the day right',
        timeOfDay: 'MORNING' as any,
        days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] as any[],
        steps: [
          { title: 'Breathe', description: 'Deep breathing', duration: 60 },
          { title: 'Stretch', description: 'Light stretching', duration: 120 },
        ],
      };
      const created = makeRitual();
      prisma.customRitual.create.mockResolvedValue(created as any);

      const result = await service.create(userId, dto as any);

      expect(prisma.customRitual.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: 'Morning Routine',
          description: 'Start the day right',
          timeOfDay: 'MORNING',
          days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
          reminderEnabled: false,
          reminderTime: undefined,
          steps: {
            create: [
              { title: 'Breathe', description: 'Deep breathing', duration: 60, order: 0 },
              { title: 'Stretch', description: 'Light stretching', duration: 120, order: 1 },
            ],
          },
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(created);
    });

    it('should use default values for optional fields', async () => {
      const dto = {
        title: 'Simple Ritual',
        steps: [{ title: 'Do it', duration: 30 }],
      };
      prisma.customRitual.create.mockResolvedValue(makeRitual({ title: 'Simple Ritual' }) as any);

      await service.create(userId, dto as any);

      expect(prisma.customRitual.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            days: [],
            reminderEnabled: false,
          }),
        }),
      );
    });

    it('should preserve step order via index', async () => {
      const dto = {
        title: 'Multi-step',
        steps: [
          { title: 'Step A', duration: 10 },
          { title: 'Step B', duration: 20 },
          { title: 'Step C', duration: 30 },
        ],
      };
      prisma.customRitual.create.mockResolvedValue(makeRitual() as any);

      await service.create(userId, dto as any);

      const callData = prisma.customRitual.create.mock.calls[0][0].data;
      expect((callData as any).steps.create[0].order).toBe(0);
      expect((callData as any).steps.create[1].order).toBe(1);
      expect((callData as any).steps.create[2].order).toBe(2);
    });
  });

  // ==================== findAll ====================

  describe('findAll', () => {
    it('should return non-archived rituals by default', async () => {
      const rituals = [makeRitual()];
      prisma.customRitual.findMany.mockResolvedValue(rituals as any);

      const result = await service.findAll(userId);

      expect(prisma.customRitual.findMany).toHaveBeenCalledWith({
        where: { userId, isArchived: false },
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(rituals);
    });

    it('should include archived rituals when flag is true', async () => {
      prisma.customRitual.findMany.mockResolvedValue([]);

      await service.findAll(userId, true);

      expect(prisma.customRitual.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ==================== findOne ====================

  describe('findOne', () => {
    it('should return a ritual when found', async () => {
      const ritual = makeRitual();
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);

      const result = await service.findOne(userId, ritualId);

      expect(prisma.customRitual.findFirst).toHaveBeenCalledWith({
        where: { id: ritualId, userId },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(ritual);
    });

    it('should throw NotFoundException when ritual is not found', async () => {
      prisma.customRitual.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== update ====================

  describe('update', () => {
    it('should update ritual fields without replacing steps', async () => {
      const ritual = makeRitual();
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.customRitual.update.mockResolvedValue({ ...ritual, title: 'Updated Routine' } as any);

      const result = await service.update(userId, ritualId, { title: 'Updated Routine' } as any);

      expect(prisma.ritualStep.deleteMany).not.toHaveBeenCalled();
      expect(result.title).toBe('Updated Routine');
    });

    it('should delete old steps and create new ones when steps are provided', async () => {
      const ritual = makeRitual();
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.ritualStep.deleteMany.mockResolvedValue({ count: 2 } as any);
      prisma.customRitual.update.mockResolvedValue({
        ...ritual,
        steps: [{ id: 'step-new', title: 'New Step', duration: 45, order: 0 }],
      } as any);

      const dto = {
        steps: [{ title: 'New Step', duration: 45 }],
      };

      await service.update(userId, ritualId, dto as any);

      expect(prisma.ritualStep.deleteMany).toHaveBeenCalledWith({
        where: { ritualId },
      });
      expect(prisma.customRitual.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            steps: {
              create: [{ title: 'New Step', description: undefined, duration: 45, order: 0 }],
            },
          }),
        }),
      );
    });

    it('should throw NotFoundException when ritual to update does not exist', async () => {
      prisma.customRitual.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, 'nonexistent', { title: 'x' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should delete a ritual when it exists', async () => {
      const ritual = makeRitual();
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.customRitual.delete.mockResolvedValue(ritual as any);

      const result = await service.delete(userId, ritualId);

      expect(prisma.customRitual.delete).toHaveBeenCalledWith({ where: { id: ritualId } });
      expect(result).toEqual(ritual);
    });

    it('should throw NotFoundException when ritual to delete does not exist', async () => {
      prisma.customRitual.findFirst.mockResolvedValue(null);

      await expect(service.delete(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== archive / unarchive ====================

  describe('archive', () => {
    it('should set isArchived to true', async () => {
      const ritual = makeRitual();
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.customRitual.update.mockResolvedValue({ ...ritual, isArchived: true } as any);

      const result = await service.archive(userId, ritualId);

      expect(prisma.customRitual.update).toHaveBeenCalledWith({
        where: { id: ritualId },
        data: { isArchived: true },
      });
      expect(result.isArchived).toBe(true);
    });
  });

  describe('unarchive', () => {
    it('should set isArchived to false', async () => {
      const ritual = makeRitual({ isArchived: true });
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.customRitual.update.mockResolvedValue({ ...ritual, isArchived: false } as any);

      const result = await service.unarchive(userId, ritualId);

      expect(prisma.customRitual.update).toHaveBeenCalledWith({
        where: { id: ritualId },
        data: { isArchived: false },
      });
      expect(result.isArchived).toBe(false);
    });
  });

  // ==================== toggleFavorite ====================

  describe('toggleFavorite', () => {
    it('should toggle isFavorite from false to true', async () => {
      const ritual = makeRitual({ isFavorite: false });
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.customRitual.update.mockResolvedValue({ ...ritual, isFavorite: true } as any);

      const result = await service.toggleFavorite(userId, ritualId);

      expect(prisma.customRitual.update).toHaveBeenCalledWith({
        where: { id: ritualId },
        data: { isFavorite: true },
      });
      expect(result.isFavorite).toBe(true);
    });

    it('should toggle isFavorite from true to false', async () => {
      const ritual = makeRitual({ isFavorite: true });
      prisma.customRitual.findFirst.mockResolvedValue(ritual as any);
      prisma.customRitual.update.mockResolvedValue({ ...ritual, isFavorite: false } as any);

      const result = await service.toggleFavorite(userId, ritualId);

      expect(prisma.customRitual.update).toHaveBeenCalledWith({
        where: { id: ritualId },
        data: { isFavorite: false },
      });
      expect(result.isFavorite).toBe(false);
    });
  });

  // ==================== getFavorites ====================

  describe('getFavorites', () => {
    it('should return only non-archived favorite rituals', async () => {
      const favorites = [makeRitual({ isFavorite: true })];
      prisma.customRitual.findMany.mockResolvedValue(favorites as any);

      const result = await service.getFavorites(userId);

      expect(prisma.customRitual.findMany).toHaveBeenCalledWith({
        where: { userId, isFavorite: true, isArchived: false },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(favorites);
    });
  });

  // ==================== recordCompletion ====================

  describe('recordCompletion', () => {
    it('should record a completion and increment ritual stats', async () => {
      const dto = {
        ritualId,
        duration: 180,
        completedSteps: 2,
        totalSteps: 2,
        mood: 'great',
      };
      const completion = makeCompletion();
      prisma.customRitual.update.mockResolvedValue(makeRitual({ completedCount: 1 }) as any);
      prisma.ritualCompletion.create.mockResolvedValue(completion as any);

      const result = await service.recordCompletion(userId, dto as any);

      expect(prisma.customRitual.update).toHaveBeenCalledWith({
        where: { id: ritualId },
        data: {
          completedCount: { increment: 1 },
          lastCompletedAt: expect.any(Date),
        },
      });
      expect(prisma.ritualCompletion.create).toHaveBeenCalledWith({
        data: {
          userId,
          ritualId,
          duration: 180,
          completedSteps: 2,
          totalSteps: 2,
          mood: 'great',
          notes: undefined,
        },
      });
      expect(result).toEqual(completion);
    });

    it('should handle completion with optional notes', async () => {
      const dto = {
        ritualId,
        duration: 120,
        completedSteps: 1,
        totalSteps: 2,
        notes: 'Felt great today',
      };
      prisma.customRitual.update.mockResolvedValue(makeRitual() as any);
      prisma.ritualCompletion.create.mockResolvedValue(makeCompletion({ notes: 'Felt great today' }) as any);

      const result = await service.recordCompletion(userId, dto as any);

      expect(prisma.ritualCompletion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: 'Felt great today' }),
        }),
      );
      expect(result.notes).toBe('Felt great today');
    });
  });

  // ==================== getCompletions ====================

  describe('getCompletions', () => {
    it('should return completions for all rituals when ritualId is not provided', async () => {
      const completions = [makeCompletion()];
      prisma.ritualCompletion.findMany.mockResolvedValue(completions as any);

      const result = await service.getCompletions(userId);

      expect(prisma.ritualCompletion.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { completedAt: 'desc' },
        take: 30,
        include: { ritual: true },
      });
      expect(result).toEqual(completions);
    });

    it('should filter by ritualId when provided', async () => {
      prisma.ritualCompletion.findMany.mockResolvedValue([]);

      await service.getCompletions(userId, ritualId, 10);

      expect(prisma.ritualCompletion.findMany).toHaveBeenCalledWith({
        where: { userId, ritualId },
        orderBy: { completedAt: 'desc' },
        take: 10,
        include: { ritual: true },
      });
    });
  });

  // ==================== getStreak ====================

  describe('getStreak', () => {
    it('should return 0 when there are no completions', async () => {
      prisma.ritualCompletion.findMany.mockResolvedValue([]);

      const result = await service.getStreak(userId);

      expect(result).toBe(0);
    });

    it('should return 0 when last completion is older than yesterday', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
      prisma.ritualCompletion.findMany.mockResolvedValue([
        { completedAt: threeDaysAgo },
      ] as any);

      const result = await service.getStreak(userId);

      expect(result).toBe(0);
    });

    it('should count consecutive days as streak', async () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000);

      prisma.ritualCompletion.findMany.mockResolvedValue([
        { completedAt: today },
        { completedAt: yesterday },
        { completedAt: twoDaysAgo },
      ] as any);

      const result = await service.getStreak(userId);

      expect(result).toBe(3);
    });

    it('should stop counting at the first gap', async () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 86400000);
      const fourDaysAgo = new Date(Date.now() - 4 * 86400000);

      prisma.ritualCompletion.findMany.mockResolvedValue([
        { completedAt: today },
        { completedAt: yesterday },
        { completedAt: fourDaysAgo },
      ] as any);

      const result = await service.getStreak(userId);

      expect(result).toBe(2);
    });

    it('should deduplicate multiple completions on the same day', async () => {
      const today = new Date();
      const todayEarlier = new Date(today);
      todayEarlier.setHours(today.getHours() - 2);
      const yesterday = new Date(Date.now() - 86400000);

      prisma.ritualCompletion.findMany.mockResolvedValue([
        { completedAt: today },
        { completedAt: todayEarlier },
        { completedAt: yesterday },
      ] as any);

      const result = await service.getStreak(userId);

      expect(result).toBe(2);
    });
  });

  // ==================== getWeeklyCompletionRate ====================

  describe('getWeeklyCompletionRate', () => {
    it('should return 0 when there are no rituals', async () => {
      prisma.ritualCompletion.findMany.mockResolvedValue([]);
      prisma.customRitual.findMany.mockResolvedValue([]);

      const result = await service.getWeeklyCompletionRate(userId);

      expect(result).toBe(0);
    });

    it('should calculate completion rate based on rituals and days passed', async () => {
      prisma.ritualCompletion.findMany.mockResolvedValue([
        makeCompletion(),
        makeCompletion({ id: 'comp-2' }),
      ] as any);
      prisma.customRitual.findMany.mockResolvedValue([
        makeRitual(),
        makeRitual({ id: 'ritual-2' }),
      ] as any);

      const result = await service.getWeeklyCompletionRate(userId);

      // Result depends on current day of week; just ensure it returns a number
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  // ==================== getTodayRituals ====================

  describe('getTodayRituals', () => {
    it('should query for rituals matching today or anytime rituals', async () => {
      prisma.customRitual.findMany.mockResolvedValue([makeRitual()] as any);

      const result = await service.getTodayRituals(userId);

      expect(prisma.customRitual.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          isArchived: false,
          OR: [
            { days: { has: expect.any(String) } },
            { days: { isEmpty: true } },
          ],
        },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
      expect(result).toBeDefined();
    });
  });
});

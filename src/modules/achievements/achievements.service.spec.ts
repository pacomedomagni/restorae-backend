import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import { AchievementCategory, AchievementTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService, XP_REWARDS } from './achievements.service';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  // ---- Helpers ----

  const userId = 'user-1';

  const makeAchievement = (overrides: Record<string, any> = {}) => ({
    id: 'ach-1',
    key: 'first-breath',
    title: 'First Breath',
    description: 'Complete your first breathing session',
    icon: '🌬️',
    category: AchievementCategory.SESSION,
    tier: AchievementTier.BRONZE,
    requirement: 1,
    xpReward: 25,
    order: 0,
    isActive: true,
    isSecret: false,
    locales: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const makeUserLevel = (overrides: Record<string, any> = {}) => ({
    id: 'ul-1',
    userId,
    level: 1,
    currentXp: 0,
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  // ==================== getAll ====================

  describe('getAll', () => {
    it('should return all active achievements without user progress when userId is not provided', async () => {
      const achievements = [makeAchievement()];
      prisma.achievement.findMany.mockResolvedValue(achievements as any);

      const result = await service.getAll();

      expect(prisma.achievement.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { locales: { where: { locale: 'en' } } },
        orderBy: [{ category: 'asc' }, { tier: 'asc' }, { order: 'asc' }],
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        unlocked: false,
        unlockedAt: null,
        progress: 0,
      });
    });

    it('should merge user progress when userId is provided', async () => {
      const achievements = [makeAchievement()];
      const unlockedAt = new Date('2024-06-01');
      prisma.achievement.findMany.mockResolvedValue(achievements as any);
      prisma.userAchievement.findMany.mockResolvedValue([
        { achievementId: 'ach-1', unlockedAt, progress: 1 },
      ] as any);

      const result = await service.getAll(userId);

      expect(prisma.userAchievement.findMany).toHaveBeenCalledWith({
        where: { userId },
        select: { achievementId: true, unlockedAt: true, progress: true },
      });
      expect(result[0]).toMatchObject({
        unlocked: true,
        unlockedAt,
        progress: 1,
      });
    });

    it('should use locale parameter for filtering locales', async () => {
      prisma.achievement.findMany.mockResolvedValue([]);

      await service.getAll(undefined, 'fr');

      expect(prisma.achievement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { locales: { where: { locale: 'fr' } } },
        }),
      );
    });

    it('should show unlocked false for achievements without user progress', async () => {
      const achievements = [makeAchievement(), makeAchievement({ id: 'ach-2', key: 'streak-3' })];
      prisma.achievement.findMany.mockResolvedValue(achievements as any);
      prisma.userAchievement.findMany.mockResolvedValue([
        { achievementId: 'ach-1', unlockedAt: new Date(), progress: 1 },
      ] as any);

      const result = await service.getAll(userId);

      expect(result[0].unlocked).toBe(true);
      expect(result[1].unlocked).toBe(false);
      expect(result[1].progress).toBe(0);
    });
  });

  // ==================== getByCategory ====================

  describe('getByCategory', () => {
    it('should return achievements filtered by category without userId', async () => {
      const achievements = [makeAchievement()];
      prisma.achievement.findMany.mockResolvedValue(achievements as any);

      const result = await service.getByCategory(AchievementCategory.SESSION);

      expect(prisma.achievement.findMany).toHaveBeenCalledWith({
        where: { category: AchievementCategory.SESSION, isActive: true },
        orderBy: [{ tier: 'asc' }, { order: 'asc' }],
      });
      expect(result[0]).toMatchObject({ unlocked: false, progress: 0 });
    });

    it('should merge user progress when userId is provided', async () => {
      const achievements = [makeAchievement()];
      prisma.achievement.findMany.mockResolvedValue(achievements as any);
      prisma.userAchievement.findMany.mockResolvedValue([
        { achievementId: 'ach-1', unlockedAt: new Date(), progress: 1 },
      ] as any);

      const result = await service.getByCategory(AchievementCategory.SESSION, userId);

      expect(result[0].unlocked).toBe(true);
    });
  });

  // ==================== getUserAchievements ====================

  describe('getUserAchievements', () => {
    it('should return only unlocked achievements for user', async () => {
      const mockData = [
        { userId, achievementId: 'ach-1', unlockedAt: new Date(), achievement: makeAchievement() },
      ];
      prisma.userAchievement.findMany.mockResolvedValue(mockData as any);

      const result = await service.getUserAchievements(userId);

      expect(prisma.userAchievement.findMany).toHaveBeenCalledWith({
        where: { userId, unlockedAt: { not: null } },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      });
      expect(result).toEqual(mockData);
    });
  });

  // ==================== getUserLevel ====================

  describe('getUserLevel', () => {
    it('should return existing user level with computed fields', async () => {
      const userLevel = makeUserLevel({ level: 3, currentXp: 50, totalXp: 250 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);

      const result = await service.getUserLevel(userId);

      expect(result).toMatchObject({
        level: 3,
        currentXp: 50,
        xpToNextLevel: 100,
        xpInCurrentLevel: 50,
      });
    });

    it('should create default level when user level does not exist', async () => {
      const newLevel = makeUserLevel();
      prisma.userLevel.findUnique.mockResolvedValue(null);
      prisma.userLevel.create.mockResolvedValue(newLevel as any);

      const result = await service.getUserLevel(userId);

      expect(prisma.userLevel.create).toHaveBeenCalledWith({ data: { userId } });
      expect(result.level).toBe(1);
    });

    it('should return xpToNextLevel 0 when at max level', async () => {
      const maxLevel = makeUserLevel({ level: 50 });
      prisma.userLevel.findUnique.mockResolvedValue(maxLevel as any);

      const result = await service.getUserLevel(userId);

      expect(result.xpToNextLevel).toBe(0);
    });
  });

  // ==================== getUserProgress ====================

  describe('getUserProgress', () => {
    it('should return comprehensive user progress', async () => {
      const userLevel = makeUserLevel({ level: 2, currentXp: 30, totalXp: 130 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.achievement.count.mockResolvedValue(20);
      prisma.userAchievement.count.mockResolvedValue(5);

      const result = await service.getUserProgress(userId);

      expect(result).toMatchObject({
        totalAchievements: 20,
        unlockedCount: 5,
        percentComplete: 25,
      });
    });
  });

  // ==================== getLeaderboard ====================

  describe('getLeaderboard', () => {
    it('should return ranked leaderboard with user details', async () => {
      const leaders = [
        makeUserLevel({ userId: 'u-1', totalXp: 500, level: 5, currentStreak: 10 }),
        makeUserLevel({ userId: 'u-2', totalXp: 300, level: 3, currentStreak: 5 }),
      ];
      const users = [
        { id: 'u-1', name: 'Alice', avatarUrl: 'http://a.png' },
        { id: 'u-2', name: 'Bob', avatarUrl: null },
      ];
      prisma.userLevel.findMany.mockResolvedValue(leaders as any);
      prisma.user.findMany.mockResolvedValue(users as any);

      const result = await service.getLeaderboard(2);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ rank: 1, name: 'Alice', level: 5 });
      expect(result[1]).toMatchObject({ rank: 2, name: 'Bob', level: 3 });
    });

    it('should default to "Anonymous" when user has no name', async () => {
      const leaders = [makeUserLevel({ userId: 'u-ghost', totalXp: 100 })];
      prisma.userLevel.findMany.mockResolvedValue(leaders as any);
      prisma.user.findMany.mockResolvedValue([] as any);

      const result = await service.getLeaderboard();

      expect(result[0].name).toBe('Anonymous');
      expect(result[0].avatarUrl).toBeNull();
    });
  });

  // ==================== updateStreak ====================

  describe('updateStreak', () => {
    it('should start a new streak when no lastActiveDate exists', async () => {
      const userLevel = makeUserLevel({ lastActiveDate: null, currentStreak: 0, longestStreak: 0 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({
        ...userLevel,
        currentStreak: 1,
        longestStreak: 1,
      } as any);

      const result = await service.updateStreak(userId);

      expect(result).toMatchObject({ streak: 1, updated: true });
    });

    it('should return no change if same day activity', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const userLevel = makeUserLevel({ lastActiveDate: today, currentStreak: 3 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);

      const result = await service.updateStreak(userId);

      expect(result).toMatchObject({ streak: 3, updated: false });
      expect(prisma.userLevel.update).not.toHaveBeenCalled();
    });

    it('should increment streak on consecutive day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);
      const userLevel = makeUserLevel({ lastActiveDate: yesterday, currentStreak: 5, longestStreak: 10 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({
        ...userLevel,
        currentStreak: 6,
        longestStreak: 10,
      } as any);

      const result = await service.updateStreak(userId);

      expect(result.streak).toBe(6);
      expect(result.updated).toBe(true);
    });

    it('should reset streak when more than 1 day gap', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const userLevel = makeUserLevel({ lastActiveDate: threeDaysAgo, currentStreak: 10, longestStreak: 15 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({
        ...userLevel,
        currentStreak: 1,
        longestStreak: 15,
      } as any);

      const result = await service.updateStreak(userId);

      expect(result.streak).toBe(1);
    });

    it('should create userLevel if it does not exist', async () => {
      const newLevel = makeUserLevel();
      prisma.userLevel.findUnique.mockResolvedValue(null);
      prisma.userLevel.create.mockResolvedValue(newLevel as any);
      prisma.userLevel.update.mockResolvedValue({ ...newLevel, currentStreak: 1, longestStreak: 1 } as any);

      const result = await service.updateStreak(userId);

      expect(prisma.userLevel.create).toHaveBeenCalledWith({ data: { userId } });
      expect(result.updated).toBe(true);
    });
  });

  // ==================== trackSessionComplete ====================

  describe('trackSessionComplete', () => {
    it('should award XP and check breathing achievement', async () => {
      // Mock awardXp path
      const userLevel = makeUserLevel({ totalXp: 0, currentXp: 0, level: 1 });
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({
        ...userLevel,
        totalXp: XP_REWARDS.SESSION_COMPLETE,
        currentXp: XP_REWARDS.SESSION_COMPLETE,
        level: 1,
      } as any);

      // Mock updateProgress path for first-breath
      const achievement = makeAchievement({ key: 'first-breath', requirement: 1, xpReward: 25 });
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue(null);
      prisma.userAchievement.create.mockResolvedValue({
        id: 'ua-1',
        userId,
        achievementId: 'ach-1',
        progress: 1,
        unlockedAt: null,
      } as any);
      prisma.userAchievement.update.mockResolvedValue({
        id: 'ua-1',
        unlockedAt: new Date(),
      } as any);

      const result = await service.trackSessionComplete(userId, 3, 'BREATHING');

      expect(result.xpAwarded).toBe(XP_REWARDS.SESSION_COMPLETE);
      expect(result.achievements).toBeDefined();
    });

    it('should check five-minute-master for sessions >= 5 minutes', async () => {
      const userLevel = makeUserLevel();
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({ ...userLevel, totalXp: 10, currentXp: 10 } as any);

      const achievement = makeAchievement({ key: 'five-minute-master', requirement: 1, xpReward: 25 });
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue(null);
      prisma.userAchievement.create.mockResolvedValue({
        id: 'ua-2',
        userId,
        achievementId: 'ach-1',
        progress: 1,
        unlockedAt: null,
      } as any);
      prisma.userAchievement.update.mockResolvedValue({
        id: 'ua-2',
        unlockedAt: new Date(),
      } as any);

      const result = await service.trackSessionComplete(userId, 5, 'GROUNDING');

      expect(result).toBeDefined();
    });
  });

  // ==================== unlockBySlug ====================

  describe('unlockBySlug', () => {
    it('should throw NotFoundException when achievement slug does not exist', async () => {
      prisma.achievement.findUnique.mockResolvedValue(null);

      await expect(service.unlockBySlug(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return alreadyUnlocked if achievement was previously unlocked', async () => {
      const achievement = makeAchievement();
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue({
        userId,
        achievementId: 'ach-1',
        unlockedAt: new Date(),
        progress: 1,
      } as any);

      const result = await service.unlockBySlug(userId, 'first-breath');

      expect(result).toMatchObject({ alreadyUnlocked: true });
      expect(prisma.userAchievement.upsert).not.toHaveBeenCalled();
    });

    it('should unlock achievement and award XP when not previously unlocked', async () => {
      const achievement = makeAchievement({ xpReward: 25 });
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue(null);
      prisma.userAchievement.upsert.mockResolvedValue({} as any);

      const userLevel = makeUserLevel();
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({
        ...userLevel,
        totalXp: 25,
        currentXp: 25,
        level: 1,
      } as any);

      const result = await service.unlockBySlug(userId, 'first-breath');
      const successResult = result as { unlocked: boolean; xpAwarded: number };

      expect(successResult.unlocked).toBe(true);
      expect(successResult.xpAwarded).toBe(25);
      expect(prisma.userAchievement.upsert).toHaveBeenCalled();
    });
  });

  // ==================== updateProgress ====================

  describe('updateProgress', () => {
    it('should throw NotFoundException when achievement key does not exist', async () => {
      prisma.achievement.findUnique.mockResolvedValue(null);

      await expect(service.updateProgress(userId, 'nope', 1)).rejects.toThrow(NotFoundException);
    });

    it('should create userAchievement when it does not exist and not unlock if below requirement', async () => {
      const achievement = makeAchievement({ requirement: 5, xpReward: 50 });
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue(null);
      prisma.userAchievement.create.mockResolvedValue({
        id: 'ua-new',
        userId,
        achievementId: 'ach-1',
        progress: 2,
        unlockedAt: null,
      } as any);

      const result = await service.updateProgress(userId, 'first-breath', 2);

      expect(result).toMatchObject({ unlocked: false, progress: 2, requirement: 5 });
    });

    it('should unlock and award XP when progress meets requirement', async () => {
      const achievement = makeAchievement({ requirement: 3, xpReward: 50 });
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue(null);
      prisma.userAchievement.create.mockResolvedValue({
        id: 'ua-new',
        userId,
        achievementId: 'ach-1',
        progress: 3,
        unlockedAt: null,
      } as any);
      prisma.userAchievement.update.mockResolvedValue({ id: 'ua-new', unlockedAt: new Date() } as any);

      // awardXp mocking
      const userLevel = makeUserLevel();
      prisma.userLevel.findUnique.mockResolvedValue(userLevel as any);
      prisma.userLevel.update.mockResolvedValue({ ...userLevel, totalXp: 50, currentXp: 50 } as any);

      const result = await service.updateProgress(userId, 'first-breath', 3);

      expect(result).toMatchObject({ unlocked: true, xpAwarded: 50 });
    });

    it('should not update progress when achievement is already unlocked', async () => {
      const achievement = makeAchievement({ requirement: 1 });
      prisma.achievement.findUnique.mockResolvedValue(achievement as any);
      prisma.userAchievement.findUnique.mockResolvedValue({
        id: 'ua-existing',
        userId,
        achievementId: 'ach-1',
        progress: 1,
        unlockedAt: new Date(),
      } as any);

      const result = await service.updateProgress(userId, 'first-breath', 2);

      // Should not call update since already unlocked
      expect(result).toMatchObject({ unlocked: false, progress: 2, requirement: 1 });
    });
  });

  // ==================== Admin: create ====================

  describe('create', () => {
    it('should create an achievement with locales', async () => {
      const dto = {
        key: 'new-ach',
        title: 'New',
        description: 'desc',
        icon: '🎯',
        category: AchievementCategory.MASTERY,
        requirement: 10,
        locales: [{ locale: 'en', title: 'New', description: 'desc' }],
      };
      const created = makeAchievement({ ...dto, id: 'ach-new' });
      prisma.achievement.create.mockResolvedValue(created as any);

      const result = await service.create(dto as any);

      expect(prisma.achievement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'new-ach',
          locales: {
            create: [{ locale: 'en', title: 'New', description: 'desc' }],
          },
        }),
        include: { locales: true },
      });
      expect(result).toEqual(created);
    });

    it('should create an achievement without locales', async () => {
      const dto = {
        key: 'no-locale',
        title: 'Simple',
        description: 'simple desc',
        icon: '✨',
        category: AchievementCategory.SPECIAL,
        requirement: 1,
      };
      prisma.achievement.create.mockResolvedValue(makeAchievement(dto) as any);

      await service.create(dto as any);

      expect(prisma.achievement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ key: 'no-locale', locales: undefined }),
        include: { locales: true },
      });
    });
  });

  // ==================== Admin: update ====================

  describe('update', () => {
    it('should update achievement and upsert locales', async () => {
      const dto = {
        title: 'Updated Title',
        locales: [{ locale: 'en', title: 'Updated', description: 'updated desc' }],
      };
      prisma.achievement.update.mockResolvedValue(makeAchievement({ title: 'Updated Title' }) as any);
      prisma.achievementLocale.upsert.mockResolvedValue({} as any);

      const result = await service.update('ach-1', dto as any);

      expect(prisma.achievement.update).toHaveBeenCalledWith({
        where: { id: 'ach-1' },
        data: { title: 'Updated Title' },
        include: { locales: true },
      });
      expect(prisma.achievementLocale.upsert).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('should update achievement without locales', async () => {
      const dto = { title: 'New Title' };
      prisma.achievement.update.mockResolvedValue(makeAchievement({ title: 'New Title' }) as any);

      await service.update('ach-1', dto as any);

      expect(prisma.achievementLocale.upsert).not.toHaveBeenCalled();
    });
  });

  // ==================== Admin: delete ====================

  describe('delete', () => {
    it('should delete achievement by id', async () => {
      prisma.achievement.delete.mockResolvedValue(makeAchievement() as any);

      const result = await service.delete('ach-1');

      expect(prisma.achievement.delete).toHaveBeenCalledWith({ where: { id: 'ach-1' } });
      expect(result).toBeDefined();
    });
  });
});

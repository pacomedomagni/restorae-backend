import { Injectable, NotFoundException } from '@nestjs/common';
import { AchievementCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAchievementDto, UpdateAchievementDto } from './dto/achievement.dto';

// XP and leveling configuration
const XP_PER_LEVEL = 100;
const MAX_LEVEL = 50;

// XP rewards for different activities
export const XP_REWARDS = {
  SESSION_COMPLETE: 10,
  JOURNAL_ENTRY: 5,
  STREAK_DAY: 15,
  ACHIEVEMENT_UNLOCK: 25,
  FIRST_OF_DAY: 5,
};

@Injectable()
export class AchievementsService {
  constructor(private prisma: PrismaService) {}

  // ==================== USER-FACING METHODS ====================

  // Get all achievements (with user's unlock status)
  async getAll(userId?: string, locale = 'en') {
    const achievements = await this.prisma.achievement.findMany({
      where: { isActive: true },
      include: {
        locales: {
          where: { locale },
        },
      },
      orderBy: [{ category: 'asc' }, { tier: 'asc' }, { order: 'asc' }],
    });

    if (!userId) {
      return achievements.map((a) => this.mergeLocale(a, { unlocked: false, unlockedAt: null, progress: 0 }));
    }

    // Get user's achievement progress
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true, progress: true },
    });

    const progressMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua]),
    );

    return achievements.map((a) => {
      const userProgress = progressMap.get(a.id);
      return this.mergeLocale(a, {
        unlocked: userProgress?.unlockedAt !== null && userProgress?.unlockedAt !== undefined,
        unlockedAt: userProgress?.unlockedAt || null,
        progress: userProgress?.progress || 0,
      });
    });
  }

  // Get user's unlocked achievements only
  async getUserAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId, unlockedAt: { not: null } },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  // Get achievements by category
  async getByCategory(category: AchievementCategory, userId?: string) {
    const achievements = await this.prisma.achievement.findMany({
      where: { category, isActive: true },
      orderBy: [{ tier: 'asc' }, { order: 'asc' }],
    });

    if (!userId) {
      return achievements.map((a) => ({ ...a, unlocked: false, unlockedAt: null, progress: 0 }));
    }

    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId, achievement: { category } },
      select: { achievementId: true, unlockedAt: true, progress: true },
    });

    const progressMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua]),
    );

    return achievements.map((a) => {
      const userProgress = progressMap.get(a.id);
      return {
        ...a,
        unlocked: userProgress?.unlockedAt !== null && userProgress?.unlockedAt !== undefined,
        unlockedAt: userProgress?.unlockedAt || null,
        progress: userProgress?.progress || 0,
      };
    });
  }

  // Get user's level and XP progress
  async getUserLevel(userId: string) {
    let userLevel = await this.prisma.userLevel.findUnique({
      where: { userId },
    });

    if (!userLevel) {
      // Create default level if not exists
      userLevel = await this.prisma.userLevel.create({
        data: { userId },
      });
    }

    return {
      ...userLevel,
      xpToNextLevel: this.xpToNextLevel(userLevel.level),
      xpInCurrentLevel: userLevel.currentXp % XP_PER_LEVEL,
    };
  }

  // Get comprehensive user progress
  async getUserProgress(userId: string) {
    const [level, achievements, unlocked] = await Promise.all([
      this.getUserLevel(userId),
      this.prisma.achievement.count({ where: { isActive: true } }),
      this.prisma.userAchievement.count({
        where: { userId, unlockedAt: { not: null } },
      }),
    ]);

    return {
      ...level,
      totalAchievements: achievements,
      unlockedCount: unlocked,
      percentComplete: Math.round((unlocked / achievements) * 100),
    };
  }

  // Get leaderboard
  async getLeaderboard(limit = 10) {
    const leaders = await this.prisma.userLevel.findMany({
      take: limit,
      orderBy: [{ totalXp: 'desc' }, { currentStreak: 'desc' }],
    });

    // Fetch user details separately
    const userIds = leaders.map(l => l.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return leaders.map((l, index) => {
      const user = userMap.get(l.userId);
      return {
        rank: index + 1,
        userId: l.userId,
        name: user?.name || 'Anonymous',
        avatarUrl: user?.avatarUrl || null,
        level: l.level,
        totalXp: l.totalXp,
        currentStreak: l.currentStreak,
      };
    });
  }

  // Track session completion
  async trackSessionComplete(userId: string, durationMinutes: number, sessionType: string) {
    // Award XP for session completion
    const xpResult = await this.awardXp(
      userId,
      XP_REWARDS.SESSION_COMPLETE,
      `session:${sessionType}`,
    );

    // Check for session-related achievements
    const achievements = [];

    // First breath achievement
    if (sessionType === 'BREATHING') {
      const result = await this.updateProgress(userId, 'first-breath', 1);
      if (result.unlocked) achievements.push(result.achievement);
    }

    // Milestone achievements based on duration
    if (durationMinutes >= 5) {
      const result = await this.updateProgress(userId, 'five-minute-master', 1);
      if (result.unlocked) achievements.push(result.achievement);
    }

    return {
      ...xpResult,
      achievements,
    };
  }

  // Unlock achievement by slug/key
  async unlockBySlug(userId: string, slug: string) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { key: slug },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement ${slug} not found`);
    }

    // Check if already unlocked
    const existing = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
    });

    if (existing?.unlockedAt) {
      return { alreadyUnlocked: true, achievement };
    }

    // Create or update user achievement
    await this.prisma.userAchievement.upsert({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
      update: {
        unlockedAt: new Date(),
        progress: achievement.requirement,
      },
      create: {
        userId,
        achievementId: achievement.id,
        progress: achievement.requirement,
        unlockedAt: new Date(),
      },
    });

    // Award XP
    const xpResult = await this.awardXp(userId, achievement.xpReward, `achievement:${slug}`);

    return {
      unlocked: true,
      achievement,
      ...xpResult,
    };
  }

  // Award XP to user
  async awardXp(userId: string, xp: number, source: string) {
    let userLevel = await this.prisma.userLevel.findUnique({
      where: { userId },
    });

    if (!userLevel) {
      userLevel = await this.prisma.userLevel.create({
        data: { userId },
      });
    }

    const newTotalXp = userLevel.totalXp + xp;
    const newCurrentXp = userLevel.currentXp + xp;
    const newLevel = Math.min(Math.floor(newTotalXp / XP_PER_LEVEL) + 1, MAX_LEVEL);
    const levelsGained = newLevel - userLevel.level;

    const updated = await this.prisma.userLevel.update({
      where: { userId },
      data: {
        totalXp: newTotalXp,
        currentXp: newCurrentXp % XP_PER_LEVEL,
        level: newLevel,
      },
    });

    return {
      xpAwarded: xp,
      source,
      levelsGained,
      currentLevel: updated.level,
      currentXp: updated.currentXp,
      totalXp: updated.totalXp,
      xpToNextLevel: this.xpToNextLevel(updated.level),
    };
  }

  // Update user streak
  async updateStreak(userId: string) {
    let userLevel = await this.prisma.userLevel.findUnique({
      where: { userId },
    });

    if (!userLevel) {
      userLevel = await this.prisma.userLevel.create({
        data: { userId },
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActive = userLevel.lastActiveDate;
    let newStreak = userLevel.currentStreak;

    if (lastActive) {
      const lastActiveDate = new Date(lastActive);
      lastActiveDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // Same day, no change
        return { streak: newStreak, updated: false };
      } else if (daysDiff === 1) {
        // Consecutive day
        newStreak++;
      } else {
        // Streak broken
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    const updated = await this.prisma.userLevel.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, userLevel.longestStreak),
        lastActiveDate: today,
      },
    });

    return {
      streak: updated.currentStreak,
      longestStreak: updated.longestStreak,
      updated: true,
    };
  }

  // Update achievement progress for a user
  async updateProgress(userId: string, achievementKey: string, progress: number) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { key: achievementKey },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement ${achievementKey} not found`);
    }

    // Get or create user achievement
    let userAchievement = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: { userId, achievementId: achievement.id },
      },
    });

    if (!userAchievement) {
      userAchievement = await this.prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id,
          progress,
        },
      });
    } else {
      // Only update if not already unlocked
      if (!userAchievement.unlockedAt) {
        userAchievement = await this.prisma.userAchievement.update({
          where: { id: userAchievement.id },
          data: { progress },
        });
      }
    }

    // Check if achievement is now unlocked
    if (progress >= achievement.requirement && !userAchievement.unlockedAt) {
      await this.prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: { unlockedAt: new Date() },
      });

      // Award XP for unlocking
      await this.awardXp(userId, achievement.xpReward, `achievement:${achievementKey}`);

      return {
        unlocked: true,
        achievement,
        xpAwarded: achievement.xpReward,
      };
    }

    return {
      unlocked: false,
      progress,
      requirement: achievement.requirement,
    };
  }

  // ==================== ADMIN METHODS ====================

  // Admin: Get all achievements (including inactive)
  async getAllAdmin() {
    return this.prisma.achievement.findMany({
      include: { locales: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  // Admin: Get single achievement by ID
  async getById(id: string) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { id },
      include: { locales: true },
    });

    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }

    return achievement;
  }

  // Admin: Create achievement
  async create(dto: CreateAchievementDto) {
    const { locales, ...data } = dto;

    return this.prisma.achievement.create({
      data: {
        ...data,
        locales: locales
          ? {
              create: locales.map((l) => ({
                locale: l.locale,
                title: l.title,
                description: l.description,
              })),
            }
          : undefined,
      },
      include: { locales: true },
    });
  }

  // Admin: Update achievement
  async update(id: string, dto: UpdateAchievementDto) {
    const { locales, ...data } = dto;

    const achievement = await this.prisma.achievement.update({
      where: { id },
      data,
      include: { locales: true },
    });

    if (locales) {
      for (const l of locales) {
        await this.prisma.achievementLocale.upsert({
          where: {
            achievementId_locale: { achievementId: id, locale: l.locale },
          },
          update: {
            title: l.title,
            description: l.description,
          },
          create: {
            achievementId: id,
            locale: l.locale,
            title: l.title,
            description: l.description,
          },
        });
      }
    }

    return achievement;
  }

  // Admin: Delete achievement
  async delete(id: string) {
    // Locales and user achievements are deleted via cascade
    return this.prisma.achievement.delete({
      where: { id },
    });
  }

  // ==================== HELPERS ====================

  private xpToNextLevel(currentLevel: number): number {
    if (currentLevel >= MAX_LEVEL) return 0;
    return XP_PER_LEVEL;
  }

  private mergeLocale(achievement: any, userProgress: { unlocked: boolean; unlockedAt: Date | null; progress: number }) {
    const localeData = achievement.locales?.[0];

    return {
      ...achievement,
      title: localeData?.title || achievement.title,
      description: localeData?.description || achievement.description,
      ...userProgress,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { MoodType, MoodContext } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMoodEntryDto } from './dto/create-mood-entry.dto';
import { UpdateMoodEntryDto } from './dto/update-mood-entry.dto';

@Injectable()
export class MoodService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateMoodEntryDto) {
    return this.prisma.moodEntry.create({
      data: {
        userId,
        mood: dto.mood,
        note: dto.note,
        context: dto.context || MoodContext.MANUAL,
        factors: dto.factors || [],
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
    });
  }

  async findAll(userId: string, limit = 100, offset = 0) {
    return this.prisma.moodEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });
  }

  async findByDateRange(userId: string, start: Date, end: Date) {
    return this.prisma.moodEntry.findMany({
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
  }

  async findOne(userId: string, id: string) {
    const entry = await this.prisma.moodEntry.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!entry) {
      throw new NotFoundException('Mood entry not found');
    }

    return entry;
  }

  async update(userId: string, id: string, dto: UpdateMoodEntryDto) {
    await this.findOne(userId, id);

    return this.prisma.moodEntry.update({
      where: { id },
      data: {
        mood: dto.mood,
        note: dto.note,
        context: dto.context,
        factors: dto.factors,
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.moodEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(userId: string) {
    const entries = await this.prisma.moodEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate statistics
    const totalEntries = entries.length;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const weeklyEntries = entries.filter((e) => new Date(e.timestamp) >= weekStart).length;
    const monthlyEntries = entries.filter((e) => new Date(e.timestamp) >= monthStart).length;

    // Mood distribution
    const moodDistribution: Record<MoodType, number> = {
      ENERGIZED: 0,
      CALM: 0,
      ANXIOUS: 0,
      LOW: 0,
      GOOD: 0,
      TOUGH: 0,
    };

    entries.forEach((e) => {
      moodDistribution[e.mood]++;
    });

    // Most common mood
    const mostCommonMood = Object.entries(moodDistribution).reduce(
      (a, b) => (b[1] > a[1] ? b : a),
      ['GOOD', 0] as [string, number],
    )[0] as MoodType;

    // Streak calculation
    const streaks = this.calculateStreaks(entries);

    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const lastSevenDays = entries.filter((e) => new Date(e.timestamp) >= sevenDaysAgo);

    // Mood trend
    const trend = this.calculateTrend(lastSevenDays);

    return {
      totalEntries,
      weeklyEntries,
      monthlyEntries,
      moodDistribution,
      mostCommonMood: totalEntries > 0 ? mostCommonMood : null,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      lastSevenDays,
      moodTrend: trend,
    };
  }

  async getWeeklyGoal(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    let goal = await this.prisma.weeklyGoal.findUnique({
      where: {
        userId_weekStart: {
          userId,
          weekStart,
        },
      },
    });

    if (!goal) {
      // Create default goal
      goal = await this.prisma.weeklyGoal.create({
        data: {
          userId,
          weekStart,
          targetDays: 7,
          completedDays: 0,
        },
      });
    }

    // Update completed days
    const daysWithEntries = await this.prisma.moodEntry.groupBy({
      by: ['timestamp'],
      where: {
        userId,
        deletedAt: null,
        timestamp: { gte: weekStart },
      },
    });

    const uniqueDays = new Set(
      daysWithEntries.map((e) => new Date(e.timestamp).toDateString()),
    ).size;

    if (uniqueDays !== goal.completedDays) {
      goal = await this.prisma.weeklyGoal.update({
        where: { id: goal.id },
        data: { completedDays: uniqueDays },
      });
    }

    return goal;
  }

  async setWeeklyGoalTarget(userId: string, targetDays: number) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return this.prisma.weeklyGoal.upsert({
      where: {
        userId_weekStart: {
          userId,
          weekStart,
        },
      },
      update: { targetDays },
      create: {
        userId,
        weekStart,
        targetDays,
        completedDays: 0,
      },
    });
  }

  private calculateStreaks(entries: Array<{ timestamp: Date }>) {
    if (entries.length === 0) {
      return { current: 0, longest: 0 };
    }

    const dates = entries.map((e) => new Date(e.timestamp).toDateString());
    const uniqueDates = [...new Set(dates)].sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );

    let current = 0;
    let longest = 0;
    let tempStreak = 1;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Check if streak is active
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      current = 1;
    }

    for (let i = 1; i < uniqueDates.length; i++) {
      const diff =
        (new Date(uniqueDates[i - 1]).getTime() - new Date(uniqueDates[i]).getTime()) /
        86400000;

      if (diff === 1) {
        tempStreak++;
        if (i === 1 || current > 0) {
          current = tempStreak;
        }
      } else {
        longest = Math.max(longest, tempStreak);
        tempStreak = 1;
      }
    }

    longest = Math.max(longest, tempStreak);

    return { current, longest };
  }

  private calculateTrend(entries: Array<{ mood: MoodType }>): string {
    if (entries.length < 3) {
      return 'insufficient';
    }

    const moodScores: Record<MoodType, number> = {
      ENERGIZED: 5,
      GOOD: 4,
      CALM: 4,
      ANXIOUS: 2,
      LOW: 1,
      TOUGH: 1,
    };

    const scores = entries.map((e) => moodScores[e.mood as MoodType]);
    const recentAvg = scores.slice(0, Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(scores.length / 2);
    const olderAvg = scores.slice(Math.floor(scores.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(scores.length / 2);

    const diff = recentAvg - olderAvg;

    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }
}

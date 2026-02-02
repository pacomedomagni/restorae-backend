import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log a single activity
   */
  async logActivity(userId: string, dto: CreateActivityLogDto) {
    const category = dto.category.toUpperCase();
    
    const activity = await (this.prisma as any).activityLog.create({
      data: {
        userId,
        category,
        activityType: dto.activityType,
        activityId: dto.activityId,
        duration: dto.duration,
        completed: dto.completed,
        metadata: dto.metadata as Prisma.JsonObject,
        timestamp: new Date(dto.timestamp),
      },
    });

    this.logger.log(`Activity logged: ${category}/${dto.activityType} for user ${userId}`);
    return activity;
  }

  /**
   * Log multiple activities (batch)
   */
  async logActivitiesBatch(userId: string, activities: CreateActivityLogDto[]) {
    const data = activities.map(dto => ({
      userId,
      category: dto.category.toUpperCase(),
      activityType: dto.activityType,
      activityId: dto.activityId,
      duration: dto.duration,
      completed: dto.completed,
      metadata: dto.metadata as Prisma.JsonObject,
      timestamp: new Date(dto.timestamp),
    }));

    const result = await (this.prisma as any).activityLog.createMany({
      data,
      skipDuplicates: true,
    });

    this.logger.log(`Batch logged ${result.count} activities for user ${userId}`);
    return { count: result.count };
  }

  /**
   * Get activity statistics for a user
   */
  async getStats(userId: string, startDate?: string, endDate?: string) {
    const hasRange = Boolean(startDate || endDate);
    const rangeStart = startDate ? new Date(startDate) : undefined;
    const rangeEnd = endDate ? new Date(endDate) : undefined;

    // Get today's stats
    const todayStart = this.getStartOfDay(new Date());
    const todayStats = await (this.prisma as any).activityLog.groupBy({
      by: ['category'],
      where: {
        userId,
        timestamp: { gte: todayStart },
      },
      _count: true,
      _sum: { duration: true },
    });

    // Get this week's stats
    const weekStart = this.getStartOfWeek(new Date());
    const weekStats = await (this.prisma as any).activityLog.groupBy({
      by: ['category'],
      where: {
        userId,
        timestamp: { gte: weekStart },
      },
      _count: true,
      _sum: { duration: true },
    });

    // Get all-time stats
    const allTimeStats = await (this.prisma as any).activityLog.groupBy({
      by: ['category'],
      where: { userId },
      _count: true,
      _sum: { duration: true },
    });

    // Optional: custom date range stats
    const rangeStats = hasRange
      ? await (this.prisma as any).activityLog.groupBy({
          by: ['category'],
          where: {
            userId,
            timestamp: {
              ...(rangeStart ? { gte: rangeStart } : {}),
              ...(rangeEnd ? { lte: rangeEnd } : {}),
            },
          },
          _count: true,
          _sum: { duration: true },
        })
      : null;

    // Get daily breakdown for this week
    const dailyBreakdown = await this.getDailyBreakdown(userId, weekStart);

    const result: any = {
      today: this.formatStats(todayStats),
      thisWeek: {
        ...this.formatStats(weekStats),
        dailyBreakdown,
      },
      allTime: this.formatStats(allTimeStats),
    };

    if (rangeStats) {
      result.range = {
        startDate: rangeStart?.toISOString() ?? null,
        endDate: rangeEnd?.toISOString() ?? null,
        ...this.formatStats(rangeStats),
      };
    }

    return result;
  }

  /**
   * Get activity history with pagination and filters
   */
  async getHistory(
    userId: string,
    params?: {
      category?: string;
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: any = { userId };

    if (params?.category) {
      where.category = params.category.toUpperCase();
    }

    if (params?.startDate || params?.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = new Date(params.startDate);
      if (params.endDate) where.timestamp.lte = new Date(params.endDate);
    }

    const [activities, total] = await Promise.all([
      (this.prisma as any).activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: params?.limit || 50,
        skip: params?.offset || 0,
      }),
      (this.prisma as any).activityLog.count({ where }),
    ]);

    return {
      activities,
      total,
      limit: params?.limit || 50,
      offset: params?.offset || 0,
    };
  }

  // Helper methods
  private formatStats(stats: any[]) {
    const byCategory: Record<string, number> = {};
    let totalSessions = 0;
    let totalSeconds = 0;

    for (const stat of stats) {
      byCategory[stat.category] = stat._count;
      totalSessions += stat._count;
      totalSeconds += stat._sum?.duration || 0;
    }

    return {
      sessions: totalSessions,
      minutes: Math.round(totalSeconds / 60),
      byCategory,
    };
  }

  private getStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async getDailyBreakdown(userId: string, startDate: Date): Promise<Record<string, number>> {
    const activities = await (this.prisma as any).activityLog.findMany({
      where: {
        userId,
        timestamp: { gte: startDate },
      },
      select: { timestamp: true },
    });

    const breakdown: Record<string, number> = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (const activity of activities) {
      const dayName = days[activity.timestamp.getDay()];
      breakdown[dayName] = (breakdown[dayName] || 0) + 1;
    }

    return breakdown;
  }
}

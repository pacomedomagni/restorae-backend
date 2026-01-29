import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSessionDto, SessionMode } from './dto/create-session.dto';
import { UpdateSessionDto, UpdateActivityDto, SessionStatus } from './dto/update-session.dto';

// Type aliases until prisma generate is run
type AnyPrisma = any;

interface SessionActivity {
  id: string;
  completed: boolean;
  skipped: boolean;
  duration: number | null;
}

interface UserSession {
  id: string;
  totalDuration: number;
  mode: string;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private prisma: PrismaService) {}

  // Helper to access new models (until prisma generate)
  private get db(): AnyPrisma {
    return this.prisma as AnyPrisma;
  }

  /**
   * Create a new session with activities
   */
  async create(userId: string, dto: CreateSessionDto) {
    const session = await this.db.userSession.create({
      data: {
        userId,
        mode: dto.mode,
        ritualId: dto.ritualId,
        ritualSlug: dto.ritualSlug,
        sosPresetId: dto.sosPresetId,
        totalActivities: dto.activities.length,
        activities: {
          create: dto.activities.map((activity) => ({
            activityType: activity.activityType,
            activityId: activity.activityId,
            activityName: activity.activityName,
            order: activity.order,
          })),
        },
      },
      include: {
        activities: { orderBy: { order: 'asc' } },
      },
    });

    this.logger.log(`Session created: ${session.id} (${dto.mode}) for user ${userId}`);
    return session;
  }

  /**
   * Get a session by ID
   */
  async findOne(userId: string, sessionId: string) {
    const session = await this.db.userSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        activities: { orderBy: { order: 'asc' } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Get user's session history
   */
  async findAll(
    userId: string,
    options?: {
      mode?: SessionMode;
      status?: SessionStatus;
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: Record<string, unknown> = { userId };

    if (options?.mode) {
      where.mode = options.mode;
    }
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.startDate || options?.endDate) {
      where.startedAt = {} as Record<string, Date>;
      if (options.startDate) {
        (where.startedAt as Record<string, Date>).gte = new Date(options.startDate);
      }
      if (options.endDate) {
        (where.startedAt as Record<string, Date>).lte = new Date(options.endDate);
      }
    }

    const [sessions, total] = await Promise.all([
      this.db.userSession.findMany({
        where,
        include: {
          activities: { orderBy: { order: 'asc' } },
        },
        orderBy: { startedAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      this.db.userSession.count({ where }),
    ]);

    return { sessions, total };
  }

  /**
   * Update session status and stats
   */
  async update(userId: string, sessionId: string, dto: UpdateSessionDto) {
    await this.findOne(userId, sessionId);

    const session = await this.db.userSession.update({
      where: { id: sessionId },
      data: {
        status: dto.status,
        completedCount: dto.completedCount,
        skippedCount: dto.skippedCount,
        totalDuration: dto.totalDuration,
        wasPartial: dto.wasPartial,
        wasInterrupted: dto.wasInterrupted,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
      },
      include: {
        activities: { orderBy: { order: 'asc' } },
      },
    });

    this.logger.log(`Session updated: ${sessionId} -> ${dto.status || 'no status change'}`);
    return session;
  }

  /**
   * Update a specific activity within a session
   */
  async updateActivity(
    userId: string,
    sessionId: string,
    activityId: string,
    dto: UpdateActivityDto,
  ) {
    // Verify session ownership
    await this.findOne(userId, sessionId);

    const activity = await this.db.sessionActivity.findFirst({
      where: { id: activityId, sessionId },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found in session');
    }

    const updated = await this.db.sessionActivity.update({
      where: { id: activityId },
      data: {
        completed: dto.completed,
        skipped: dto.skipped,
        duration: dto.duration,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
      },
    });

    // Update session counts if activity completed or skipped
    if (dto.completed || dto.skipped) {
      await this.recalculateSessionStats(sessionId);
    }

    return updated;
  }

  /**
   * Recalculate session statistics
   */
  private async recalculateSessionStats(sessionId: string) {
    const activities: SessionActivity[] = await this.db.sessionActivity.findMany({
      where: { sessionId },
    });

    const completedCount = activities.filter((a) => a.completed).length;
    const skippedCount = activities.filter((a) => a.skipped).length;
    const totalDuration = activities
      .filter((a) => a.completed && a.duration)
      .reduce((sum: number, a) => sum + (a.duration || 0), 0);

    await this.db.userSession.update({
      where: { id: sessionId },
      data: { completedCount, skippedCount, totalDuration },
    });
  }

  /**
   * Get session statistics for a user
   */
  async getStats(userId: string, startDate?: string, endDate?: string) {
    // Today's sessions
    const todayStart = this.getStartOfDay(new Date());
    const todaySessions: UserSession[] = await this.db.userSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        startedAt: { gte: todayStart },
      },
    });

    // This week's sessions
    const weekStart = this.getStartOfWeek(new Date());
    const weekSessions: UserSession[] = await this.db.userSession.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        startedAt: { gte: weekStart },
      },
    });

    // All-time stats
    const allTimeSessions = await this.db.userSession.aggregate({
      where: {
        userId,
        status: 'COMPLETED',
      },
      _count: true,
      _sum: { totalDuration: true },
    });

    // Group by mode
    const byMode: Array<{
      mode: string;
      _count: number;
      _sum: { totalDuration: number | null };
    }> = await this.db.userSession.groupBy({
      by: ['mode'],
      where: {
        userId,
        status: 'COMPLETED',
      },
      _count: true,
      _sum: { totalDuration: true },
    });

    return {
      today: {
        sessions: todaySessions.length,
        minutes: Math.round(
          todaySessions.reduce((s: number, sess) => s + sess.totalDuration, 0) / 60,
        ),
      },
      thisWeek: {
        sessions: weekSessions.length,
        minutes: Math.round(
          weekSessions.reduce((s: number, sess) => s + sess.totalDuration, 0) / 60,
        ),
      },
      allTime: {
        sessions: allTimeSessions._count,
        minutes: Math.round((allTimeSessions._sum.totalDuration || 0) / 60),
      },
      byMode: byMode.reduce(
        (acc: Record<string, { sessions: number; minutes: number }>, item) => {
          acc[item.mode.toLowerCase()] = {
            sessions: item._count,
            minutes: Math.round((item._sum.totalDuration || 0) / 60),
          };
          return acc;
        },
        {} as Record<string, { sessions: number; minutes: number }>,
      ),
    };
  }

  private getStartOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getStartOfWeek(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }
}

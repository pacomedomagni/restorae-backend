import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRitualDto } from './dto/create-ritual.dto';
import { UpdateRitualDto } from './dto/update-ritual.dto';
import { CreateCompletionDto } from './dto/create-completion.dto';

@Injectable()
export class RitualsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRitualDto) {
    return this.prisma.customRitual.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        timeOfDay: dto.timeOfDay,
        days: dto.days || [],
        reminderEnabled: dto.reminderEnabled || false,
        reminderTime: dto.reminderTime,
        steps: {
          create: dto.steps.map((step, index) => ({
            title: step.title,
            description: step.description,
            duration: step.duration,
            order: index,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async findAll(userId: string, includeArchived = false) {
    return this.prisma.customRitual.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const ritual = await this.prisma.customRitual.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!ritual) {
      throw new NotFoundException('Ritual not found');
    }

    return ritual;
  }

  async update(userId: string, id: string, dto: UpdateRitualDto) {
    await this.findOne(userId, id);

    // If steps are provided, delete old and create new
    if (dto.steps) {
      await this.prisma.ritualStep.deleteMany({
        where: { ritualId: id },
      });
    }

    return this.prisma.customRitual.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        timeOfDay: dto.timeOfDay,
        days: dto.days,
        reminderEnabled: dto.reminderEnabled,
        reminderTime: dto.reminderTime,
        ...(dto.steps && {
          steps: {
            create: dto.steps.map((step, index) => ({
              title: step.title,
              description: step.description,
              duration: step.duration,
              order: index,
            })),
          },
        }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async delete(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.customRitual.delete({
      where: { id },
    });
  }

  async archive(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.customRitual.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async unarchive(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.customRitual.update({
      where: { id },
      data: { isArchived: false },
    });
  }

  async toggleFavorite(userId: string, id: string) {
    const ritual = await this.findOne(userId, id);

    return this.prisma.customRitual.update({
      where: { id },
      data: { isFavorite: !ritual.isFavorite },
    });
  }

  async getFavorites(userId: string) {
    return this.prisma.customRitual.findMany({
      where: { userId, isFavorite: true, isArchived: false },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async getTodayRituals(userId: string) {
    const today = new Date();
    const dayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayDay = dayMap[today.getDay()];

    return this.prisma.customRitual.findMany({
      where: {
        userId,
        isArchived: false,
        OR: [
          { days: { has: todayDay as any } },
          { days: { isEmpty: true } }, // Anytime rituals
        ],
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  // Completions
  async recordCompletion(userId: string, dto: CreateCompletionDto) {
    // Update ritual stats
    await this.prisma.customRitual.update({
      where: { id: dto.ritualId },
      data: {
        completedCount: { increment: 1 },
        lastCompletedAt: new Date(),
      },
    });

    return this.prisma.ritualCompletion.create({
      data: {
        userId,
        ritualId: dto.ritualId,
        duration: dto.duration,
        completedSteps: dto.completedSteps,
        totalSteps: dto.totalSteps,
        mood: dto.mood,
        notes: dto.notes,
      },
    });
  }

  async getCompletions(userId: string, ritualId?: string, limit = 30) {
    return this.prisma.ritualCompletion.findMany({
      where: {
        userId,
        ...(ritualId && { ritualId }),
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: { ritual: true },
    });
  }

  async getStreak(userId: string) {
    const completions = await this.prisma.ritualCompletion.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    if (completions.length === 0) return 0;

    const dates = completions.map((c) => new Date(c.completedAt).toDateString());
    const uniqueDates = [...new Set(dates)];

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Check if active
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
      return 0;
    }

    streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const diff =
        (new Date(uniqueDates[i - 1]).getTime() - new Date(uniqueDates[i]).getTime()) /
        86400000;
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  async getWeeklyCompletionRate(userId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const completions = await this.prisma.ritualCompletion.findMany({
      where: {
        userId,
        completedAt: { gte: weekStart },
      },
    });

    const rituals = await this.prisma.customRitual.findMany({
      where: { userId, isArchived: false },
    });

    if (rituals.length === 0) return 0;

    // Calculate expected vs actual
    const daysPassed = Math.min(7, Math.ceil((Date.now() - weekStart.getTime()) / 86400000));
    const expected = rituals.length * daysPassed;
    const actual = completions.length;

    return Math.round((actual / expected) * 100);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoachMarksService {
  constructor(private prisma: PrismaService) {}

  // Get all active coach marks for the app
  async getAll() {
    return this.prisma.coachMark.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  // Get coach marks for a specific screen
  async getByScreen(screen: string) {
    return this.prisma.coachMark.findMany({
      where: {
        screen,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // Get a single coach mark by key
  async getByKey(key: string) {
    const coachMark = await this.prisma.coachMark.findUnique({
      where: { key },
    });

    if (!coachMark) {
      throw new NotFoundException(`Coach mark ${key} not found`);
    }

    return coachMark;
  }

  // Track which coach marks a user has seen
  async markAsSeen(userId: string, key: string) {
    // We store seen coach marks in user preferences
    // This is a lightweight approach - you could also use a separate table
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as any) || {};
    const seenCoachMarks = preferences.seenCoachMarks || [];

    if (!seenCoachMarks.includes(key)) {
      seenCoachMarks.push(key);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...preferences,
          seenCoachMarks,
        },
      },
    });

    return { success: true, key };
  }

  // Get user's seen coach marks
  async getSeenCoachMarks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as any) || {};
    return preferences.seenCoachMarks || [];
  }

  // Reset all coach marks for a user (for re-onboarding)
  async resetSeenCoachMarks(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences = (user?.preferences as any) || {};
    delete preferences.seenCoachMarks;

    await this.prisma.user.update({
      where: { id: userId },
      data: { preferences },
    });

    return { success: true };
  }

  // ==================== ADMIN METHODS ====================

  async getAllAdmin() {
    return this.prisma.coachMark.findMany({
      orderBy: [{ screen: 'asc' }, { order: 'asc' }],
    });
  }

  async create(data: {
    key: string;
    screen: string;
    targetId: string;
    title: string;
    description: string;
    position?: string;
    order?: number;
    isActive?: boolean;
  }) {
    return this.prisma.coachMark.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      key: string;
      screen: string;
      targetId: string;
      title: string;
      description: string;
      position: string;
      order: number;
      isActive: boolean;
    }>,
  ) {
    return this.prisma.coachMark.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.coachMark.delete({
      where: { id },
    });
  }
}

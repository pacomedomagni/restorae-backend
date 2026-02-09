import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _, ...result } = user as Record<string, unknown> & { passwordHash?: string };
    return result;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        timezone: dto.timezone,
        locale: dto.locale,
        avatarUrl: dto.avatarUrl,
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    const { passwordHash: _, ...result } = user as Record<string, unknown> & { passwordHash?: string };
    return result;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.preference.update({
      where: { userId },
      data: dto,
    });
  }

  async completeOnboarding(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });
  }

  async getDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async removeDevice(userId: string, deviceId: string) {
    return this.prisma.device.deleteMany({
      where: {
        userId,
        deviceId,
      },
    });
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        moodEntries: {
          where: { deletedAt: null },
        },
        journalEntries: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            content: true,
            tags: true,
            createdAt: true,
            // Don't export locked entries
            isLocked: true,
          },
        },
        customRituals: {
          include: { steps: true },
        },
        ritualCompletions: true,
        weeklyGoals: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Filter out locked journal entries
    const journalEntries = user.journalEntries
      .filter((e) => !e.isLocked)
      .map(({ isLocked: _, ...rest }) => rest);

    const { passwordHash: _pw, ...userData } = user as Record<string, unknown> & { passwordHash?: string };

    return {
      exportedAt: new Date().toISOString(),
      user: {
        email: userData.email,
        name: userData.name,
        timezone: userData.timezone,
        locale: userData.locale,
        createdAt: userData.createdAt,
      },
      preferences: userData.preferences,
      moodEntries: userData.moodEntries,
      journalEntries,
      rituals: userData.customRituals,
      ritualCompletions: userData.ritualCompletions,
      weeklyGoals: userData.weeklyGoals,
    };
  }

  async deleteAccount(userId: string) {
    // Soft delete user and related data
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: null, // Clear PII
        name: null,
      },
    });

    // Invalidate all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    return { success: true };
  }
}

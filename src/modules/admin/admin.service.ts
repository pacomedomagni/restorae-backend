import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Analytics
  async getDashboardStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeToday,
      activeMonth,
      premiumUsers,
      totalMoodEntries,
      totalJournalEntries,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.device.count({
        where: { lastActiveAt: { gte: today } },
      }),
      this.prisma.device.count({
        where: { lastActiveAt: { gte: monthStart } },
      }),
      this.prisma.subscription.count({
        where: { tier: { not: 'FREE' } },
      }),
      this.prisma.moodEntry.count({ where: { deletedAt: null } }),
      this.prisma.journalEntry.count({ where: { deletedAt: null } }),
    ]);

    return {
      totalUsers,
      dau: activeToday,
      mau: activeMonth,
      premiumUsers,
      conversionRate: totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(2) : 0,
      totalMoodEntries,
      totalJournalEntries,
    };
  }

  async getContentStats() {
    const stats = await this.prisma.contentItem.groupBy({
      by: ['type', 'status'],
      _count: true,
    });

    return stats;
  }

  async getRecentFeedback(limit = 10) {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  // Audit logging
  async createAuditLog(data: {
    userId?: string;
    adminId: string;
    action: string;
    resource: string;
    resourceId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({
      data,
    });
  }

  async getAuditLogs(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: {
        user: { select: { id: true, email: true, name: true } },
        admin: { select: { id: true, email: true, name: true } },
      },
    });
  }
}

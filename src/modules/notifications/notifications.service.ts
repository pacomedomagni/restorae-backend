import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseMessagingService } from './firebase-messaging.service';

interface SendNotificationOptions {
  userId?: string;
  target?: 'all' | 'premium' | 'free' | 'inactive' | 'trial' | 'expiring';
  title: string;
  body: string;
  data?: Record<string, string>;
  scheduledFor?: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private fcm: FirebaseMessagingService,
  ) {}

  async registerPushToken(userId: string, deviceId: string, pushToken: string) {
    return this.prisma.device.update({
      where: { deviceId },
      data: { pushToken },
    });
  }

  async unregisterPushToken(deviceId: string) {
    return this.prisma.device.update({
      where: { deviceId },
      data: { pushToken: null },
    });
  }

  // =========================================================================
  // REMINDERS (User-configured local notifications)
  // =========================================================================

  async getReminders(userId: string) {
    return this.prisma.reminder.findMany({
      where: { userId },
      orderBy: { time: 'asc' },
    });
  }

  async createReminder(userId: string, data: {
    type: string;
    label: string;
    time: string;
    ritualId?: string;
  }) {
    return this.prisma.reminder.create({
      data: {
        userId,
        type: data.type,
        label: data.label,
        time: data.time,
        ritualId: data.ritualId,
      },
    });
  }

  async updateReminder(userId: string, id: string, data: {
    label?: string;
    time?: string;
    enabled?: boolean;
  }) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    return this.prisma.reminder.update({
      where: { id },
      data,
    });
  }

  async deleteReminder(userId: string, id: string) {
    return this.prisma.reminder.deleteMany({
      where: { id, userId },
    });
  }

  async toggleReminder(userId: string, id: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, userId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    return this.prisma.reminder.update({
      where: { id },
      data: { enabled: !reminder.enabled },
    });
  }

  // =========================================================================
  // PUSH NOTIFICATIONS
  // =========================================================================

  // Send push notification to a specific user
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    const devices = await this.prisma.device.findMany({
      where: { userId, pushToken: { not: null } },
    });

    if (devices.length === 0) {
      this.logger.warn(`No devices with push tokens for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const device of devices) {
      const result = await this.fcm.sendRich(
        device.pushToken!,
        title,
        body,
        data
      );

      if (result.success) {
        sent++;
        // Log successful notification
        await this.prisma.notificationLog.create({
          data: {
            userId,
            deviceId: device.deviceId,
            title,
            body,
            status: 'SENT',
          },
        });
      } else {
        failed++;
        // Log failed notification
        await this.prisma.notificationLog.create({
          data: {
            userId,
            deviceId: device.deviceId,
            title,
            body,
            status: 'FAILED',
          },
        });

        // Track invalid tokens for cleanup
        if (result.error === 'INVALID_TOKEN') {
          invalidTokens.push(device.deviceId);
        }
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await this.prisma.device.updateMany({
        where: { deviceId: { in: invalidTokens } },
        data: { pushToken: null },
      });
    }

    return { sent, failed };
  }

  // Send push notification to a group of users
  async sendToTarget(options: SendNotificationOptions) {
    const { target, title, body, data, scheduledFor } = options;

    // If scheduled, create campaign and return
    if (scheduledFor && scheduledFor > new Date()) {
      const campaign = await this.prisma.notificationCampaign.create({
        data: {
          title,
          body,
          scheduledFor,
          data: data as any,
          createdBy: options.userId || 'system',
        },
      });

      return {
        scheduled: true,
        campaignId: campaign.id,
        scheduledFor,
      };
    }

    // Build user query based on target
    const userWhere: any = { isActive: true };

    switch (target) {
      case 'premium':
        userWhere.subscription = { tier: { in: ['PREMIUM', 'LIFETIME'] } };
        break;
      case 'free':
        userWhere.subscription = { tier: 'FREE', isTrialing: false };
        break;
      case 'trial':
        userWhere.subscription = { isTrialing: true };
        break;
      case 'expiring':
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        userWhere.subscription = {
          OR: [
            { trialEndsAt: { lte: threeDaysFromNow, gte: new Date() } },
            { currentPeriodEnd: { lte: threeDaysFromNow, gte: new Date() } },
          ],
        };
        break;
      case 'inactive':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        userWhere.devices = {
          every: { lastActiveAt: { lt: sevenDaysAgo } },
        };
        break;
      // 'all' uses default where
    }

    // Get all devices with push tokens for matching users
    const devices = await this.prisma.device.findMany({
      where: {
        pushToken: { not: null },
        user: userWhere,
      },
      select: {
        deviceId: true,
        pushToken: true,
        userId: true,
      },
    });

    if (devices.length === 0) {
      return { sent: 0, failed: 0, total: 0 };
    }

    // Create campaign record
    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title,
        body,
        data: data as any,
        createdBy: options.userId || 'system',
      },
    });

    // Send to all devices
    const tokens = devices.map(d => d.pushToken!);
    const result = await this.fcm.sendMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    // Update campaign with results
    await this.prisma.notificationCampaign.update({
      where: { id: campaign.id },
      data: {
        sentAt: new Date(),
        sentCount: result.successCount,
      },
    });

    // Log individual notifications
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const response = result.responses[i];

      await this.prisma.notificationLog.create({
        data: {
          userId: device.userId,
          deviceId: device.deviceId,
          title,
          body,
          status: response.success ? 'SENT' : 'FAILED',
          campaignId: campaign.id,
        },
      });
    }

    // Clean up invalid tokens
    const invalidDevices = devices.filter((_, i) => 
      result.responses[i]?.error === 'INVALID_TOKEN'
    );
    if (invalidDevices.length > 0) {
      await this.prisma.device.updateMany({
        where: { deviceId: { in: invalidDevices.map(d => d.deviceId) } },
        data: { pushToken: null },
      });
    }

    return {
      sent: result.successCount,
      failed: result.failureCount,
      total: devices.length,
      campaignId: campaign.id,
    };
  }

  // =========================================================================
  // CAMPAIGN MANAGEMENT
  // =========================================================================

  async getCampaigns(limit = 20) {
    return this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
  }

  async getCampaign(id: string) {
    return this.prisma.notificationCampaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: { logs: true },
        },
      },
    });
  }

  async cancelCampaign(id: string) {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Can only cancel campaigns that haven't been sent yet
    if (campaign.sentAt) {
      throw new Error('Can only cancel campaigns that have not been sent');
    }

    // Delete the unsent campaign
    return this.prisma.notificationCampaign.delete({
      where: { id },
    });
  }

  // =========================================================================
  // SCHEDULED NOTIFICATIONS PROCESSOR
  // =========================================================================

  // This would be called by a cron job
  async processScheduledCampaigns() {
    const due = await this.prisma.notificationCampaign.findMany({
      where: {
        sentAt: null,
        scheduledFor: { lte: new Date() },
      },
    });

    for (const campaign of due) {
      try {
        await this.sendToTarget({
          title: campaign.title,
          body: campaign.body,
          data: campaign.data as Record<string, string> | undefined,
        });
      } catch (error) {
        this.logger.error(`Failed to process campaign ${campaign.id}:`, error);
      }
    }

    return { processed: due.length };
  }
}

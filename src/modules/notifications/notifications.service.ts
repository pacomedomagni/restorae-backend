import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async registerPushToken(userId: string, deviceId: string, pushToken: string) {
    return this.prisma.device.update({
      where: { deviceId },
      data: { pushToken },
    });
  }

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
        ...data,
      },
    });
  }

  async updateReminder(userId: string, id: string, data: {
    label?: string;
    time?: string;
    enabled?: boolean;
  }) {
    return this.prisma.reminder.updateMany({
      where: { id, userId },
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

    if (!reminder) return null;

    return this.prisma.reminder.update({
      where: { id },
      data: { enabled: !reminder.enabled },
    });
  }

  // Send push notification (would integrate with FCM/APNs)
  async sendPush(userId: string, title: string, body: string, data?: any) {
    const devices = await this.prisma.device.findMany({
      where: { userId, pushToken: { not: null } },
    });

    // TODO: Integrate with Firebase Cloud Messaging
    // For each device, send push notification

    // Log notification
    for (const device of devices) {
      await this.prisma.notificationLog.create({
        data: {
          userId,
          deviceId: device.deviceId,
          title,
          body,
          status: 'PENDING',
        },
      });
    }

    return { sent: devices.length };
  }

  // Schedule notification for later
  async scheduleNotification(userId: string, title: string, body: string, scheduledFor: Date) {
    return this.prisma.notificationLog.create({
      data: {
        userId,
        title,
        body,
        status: 'PENDING',
        // Note: Actual scheduling would be handled by a cron job or queue
      },
    });
  }
}

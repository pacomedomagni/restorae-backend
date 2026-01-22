import { Injectable } from '@nestjs/common';
import { FeedbackType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  async submit(userId: string | null, data: {
    type: FeedbackType;
    subject?: string;
    message: string;
    email?: string;
    deviceInfo?: any;
  }) {
    return this.prisma.feedback.create({
      data: {
        userId,
        type: data.type,
        subject: data.subject,
        message: data.message,
        email: data.email,
        deviceInfo: data.deviceInfo,
      },
    });
  }

  async getUserFeedback(userId: string) {
    return this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.feedback.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async getAllFeedback(limit = 50, offset = 0) {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  async getFAQs() {
    return this.prisma.fAQ.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }
}

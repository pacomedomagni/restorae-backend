import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateJournalEntryDto) {
    return this.prisma.journalEntry.create({
      data: {
        userId,
        title: dto.title,
        content: dto.content,
        promptId: dto.promptId,
        moodEntryId: dto.moodEntryId,
        tags: dto.tags || [],
        isEncrypted: dto.isEncrypted || false,
        isLocked: dto.isLocked || false,
      },
    });
  }

  async findAll(userId: string, limit = 50, offset = 0) {
    return this.prisma.journalEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        moodEntry: true,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        moodEntry: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    return entry;
  }

  async update(userId: string, id: string, dto: UpdateJournalEntryDto) {
    await this.findOne(userId, id);

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        tags: dto.tags,
        isLocked: dto.isLocked,
      },
    });
  }

  async delete(userId: string, id: string) {
    await this.findOne(userId, id);

    // Soft delete
    return this.prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async search(userId: string, query: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        isLocked: false, // Don't search locked entries
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { tags: { has: query } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByMood(userId: string, moodId: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        moodEntryId: moodId,
        deletedAt: null,
      },
    });
  }

  async findByTag(userId: string, tag: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        deletedAt: null,
        tags: { has: tag },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecentEntries(userId: string, limit = 10) {
    return this.prisma.journalEntry.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Get deleted entries (for recovery)
  async getDeleted(userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        deletedAt: {
          not: null,
          gte: thirtyDaysAgo, // Only show entries deleted within 30 days
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
  }

  // Restore deleted entry
  async restore(userId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, userId, deletedAt: { not: null } },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found or not deleted');
    }

    return this.prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  // Permanently delete
  async permanentDelete(userId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, userId },
    });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return this.prisma.journalEntry.delete({
      where: { id },
    });
  }
}

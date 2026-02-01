import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BatchSyncDto, SyncEntity, SyncOperationDto, SyncOperationType } from './dto/batch-sync.dto';
import { MoodContext, MoodType } from '@prisma/client';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private prisma: PrismaService) {}

  async processBatch(userId: string, dto: BatchSyncDto) {
    const results: Array<{
      id: string;
      success: boolean;
      result?: unknown;
      error?: string;
    }> = [];
    
    // Process sequentially to maintain order dependencies
    // Alternatively, use prisma.$transaction if logic allows, but separate actions might vary
    
    for (const op of dto.operations) {
      try {
        const result = await this.processOperation(userId, op);
        results.push({ id: op.id, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to process operation ${op.id}`, error);
        results.push({
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { results };
  }

  private async processOperation(userId: string, op: SyncOperationDto) {
    switch (op.entity) {
      case SyncEntity.MOOD:
        return this.handleMoodSync(userId, op);
      case SyncEntity.JOURNAL:
        return this.handleJournalSync(userId, op);
      default:
        throw new Error(`Unsupported sync entity: ${op.entity}`);
    }
  }

  private normalizeMoodType(mood: unknown): MoodType {
    if (typeof mood !== 'string') {
      throw new Error('Invalid mood');
    }

    const key = mood.toUpperCase() as keyof typeof MoodType;
    const normalized = MoodType[key];
    if (!normalized) {
      throw new Error(`Invalid mood: ${mood}`);
    }
    return normalized;
  }

  private normalizeMoodContext(context: unknown): MoodContext {
    if (context == null) return MoodContext.MANUAL;
    if (typeof context !== 'string') {
      throw new Error('Invalid mood context');
    }

    const key = context.toUpperCase() as keyof typeof MoodContext;
    const normalized = MoodContext[key];
    if (!normalized) {
      throw new Error(`Invalid mood context: ${context}`);
    }
    return normalized;
  }

  private getServerId(data: Record<string, unknown>): string {
    const serverId = (data.serverId ?? data.id) as unknown;
    if (typeof serverId !== 'string' || !serverId) {
      throw new Error('Missing serverId');
    }
    return serverId;
  }

  private async handleMoodSync(userId: string, op: SyncOperationDto) {
    const data = (op.data ?? {}) as Record<string, unknown>;

    if (op.type === SyncOperationType.CREATE) {
      return this.prisma.moodEntry.create({
        data: {
          userId,
          mood: this.normalizeMoodType(data.mood),
          note: typeof data.note === 'string' ? data.note : undefined,
          context: this.normalizeMoodContext(data.context),
          factors: Array.isArray(data.factors) ? (data.factors as string[]) : [],
          timestamp: typeof data.timestamp === 'string' ? new Date(data.timestamp) : new Date(),
        },
      });
    }

    const id = this.getServerId(data);

    if (op.type === SyncOperationType.UPDATE) {
      const updates: Record<string, unknown> = {};
      if (data.mood != null) updates.mood = this.normalizeMoodType(data.mood);
      if (data.note != null) updates.note = typeof data.note === 'string' ? data.note : null;
      if (data.context != null) updates.context = this.normalizeMoodContext(data.context);
      if (data.factors != null) updates.factors = Array.isArray(data.factors) ? (data.factors as string[]) : [];
      if (data.timestamp != null) updates.timestamp = typeof data.timestamp === 'string' ? new Date(data.timestamp) : new Date();

      const result = await this.prisma.moodEntry.updateMany({
        where: { id, userId },
        data: updates,
      });

      if (result.count === 0) {
        throw new Error('Mood entry not found');
      }

      return this.prisma.moodEntry.findUnique({ where: { id } });
    }

    if (op.type === SyncOperationType.DELETE) {
      const result = await this.prisma.moodEntry.updateMany({
        where: { id, userId },
        data: { deletedAt: new Date() },
      });

      if (result.count === 0) {
        throw new Error('Mood entry not found');
      }

      return { id, deletedAt: true };
    }

    throw new Error(`Unsupported mood operation: ${op.type}`);
  }

  private async handleJournalSync(userId: string, op: SyncOperationDto) {
    const data = (op.data ?? {}) as Record<string, unknown>;

    if (op.type === SyncOperationType.CREATE) {
      if (typeof data.content !== 'string' || !data.content) {
        throw new Error('Missing journal content');
      }

      return this.prisma.journalEntry.create({
        data: {
          userId,
          title: typeof data.title === 'string' ? data.title : undefined,
          content: data.content,
          promptId: typeof data.promptId === 'string' ? data.promptId : undefined,
          moodEntryId: typeof data.moodEntryId === 'string' ? data.moodEntryId : undefined,
          tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
          isEncrypted: typeof data.isEncrypted === 'boolean' ? data.isEncrypted : false,
          isLocked:
            typeof data.isLocked === 'boolean'
              ? data.isLocked
              : typeof data.isPrivate === 'boolean'
                ? data.isPrivate
                : false,
        },
      });
    }

    const id = this.getServerId(data);

    if (op.type === SyncOperationType.UPDATE) {
      const updates: Record<string, unknown> = {};
      if (data.title != null) updates.title = typeof data.title === 'string' ? data.title : null;
      if (data.content != null) {
        if (typeof data.content !== 'string' || !data.content) throw new Error('Invalid journal content');
        updates.content = data.content;
      }
      if (data.promptId != null) updates.promptId = typeof data.promptId === 'string' ? data.promptId : null;
      if (data.moodEntryId != null) updates.moodEntryId = typeof data.moodEntryId === 'string' ? data.moodEntryId : null;
      if (data.tags != null) updates.tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
      if (data.isEncrypted != null) updates.isEncrypted = typeof data.isEncrypted === 'boolean' ? data.isEncrypted : false;
      if (data.isLocked != null) updates.isLocked = typeof data.isLocked === 'boolean' ? data.isLocked : false;
      if (data.isPrivate != null) updates.isLocked = typeof data.isPrivate === 'boolean' ? data.isPrivate : false;

      const result = await this.prisma.journalEntry.updateMany({
        where: { id, userId },
        data: updates,
      });

      if (result.count === 0) {
        throw new Error('Journal entry not found');
      }

      return this.prisma.journalEntry.findUnique({ where: { id } });
    }

    if (op.type === SyncOperationType.DELETE) {
      const result = await this.prisma.journalEntry.updateMany({
        where: { id, userId },
        data: { deletedAt: new Date() },
      });

      if (result.count === 0) {
        throw new Error('Journal entry not found');
      }

      return { id, deletedAt: true };
    }

    throw new Error(`Unsupported journal operation: ${op.type}`);
  }
}

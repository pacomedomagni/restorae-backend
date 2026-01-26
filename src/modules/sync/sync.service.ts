import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BatchSyncDto, SyncEntity, SyncOperationType } from './dto/batch-sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private prisma: PrismaService) {}

  async processBatch(userId: string, dto: BatchSyncDto) {
    const results = [];
    
    // Process sequentially to maintain order dependencies
    // Alternatively, use prisma.$transaction if logic allows, but separate actions might vary
    
    for (const op of dto.operations) {
      try {
        const result = await this.processOperation(userId, op);
        results.push({ id: op.id, success: true, result });
      } catch (error) {
        this.logger.error(`Failed to process operation ${op.id}`, error);
        results.push({ id: op.id, success: false, error: error.message });
      }
    }

    return { results };
  }

  private async processOperation(userId: string, op: any) {
    switch (op.entity) {
      case SyncEntity.MOOD:
        return this.handleMoodSync(userId, op);
      case SyncEntity.JOURNAL:
        return this.handleJournalSync(userId, op);
      // Add other handlers
      default:
        this.logger.warn(`Unknown entity type: ${op.entity}`);
        return null;
    }
  }

  private async handleMoodSync(userId: string, op: any) {
    if (op.type === SyncOperationType.CREATE) {
      return this.prisma.moodEntry.create({
        data: {
          ...op.data,
          userId,
        },
      });
    }
    // Handle other mood ops if necessary
  }

  private async handleJournalSync(userId: string, op: any) {
     if (op.type === SyncOperationType.CREATE) {
      return this.prisma.journalEntry.create({
        data: {
          ...op.data,
          userId,
        },
      });
    }
  }
}

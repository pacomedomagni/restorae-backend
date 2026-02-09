import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { MoodType, MoodContext } from '@prisma/client';
import { SyncService } from './sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BatchSyncDto,
  SyncEntity,
  SyncOperationType,
  SyncOperationDto,
} from './dto/batch-sync.dto';

// ---------------------------------------------------------------------------
// Suppress logger output during tests
// ---------------------------------------------------------------------------
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-123';

function buildMoodEntry(overrides: Record<string, any> = {}) {
  return {
    id: 'mood-1',
    userId: TEST_USER_ID,
    mood: MoodType.GOOD,
    note: 'Feeling good',
    context: MoodContext.MANUAL,
    factors: ['sleep'],
    timestamp: new Date('2026-02-08T10:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildJournalEntry(overrides: Record<string, any> = {}) {
  return {
    id: 'journal-1',
    userId: TEST_USER_ID,
    title: 'My Day',
    content: 'Had a great day',
    promptId: null,
    moodEntryId: null,
    tags: ['gratitude'],
    isEncrypted: false,
    isLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildOp(overrides: Partial<SyncOperationDto> = {}): SyncOperationDto {
  return {
    id: 'op-1',
    type: SyncOperationType.CREATE,
    entity: SyncEntity.MOOD,
    data: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('SyncService', () => {
  let service: SyncService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // processBatch – empty batch
  // =========================================================================
  describe('processBatch with empty operations', () => {
    it('should return empty results array for an empty batch', async () => {
      const dto: BatchSyncDto = { operations: [] };

      const result = await service.processBatch(TEST_USER_ID, dto);

      expect(result).toEqual({ results: [] });
    });
  });

  // =========================================================================
  // Mood sync – CREATE
  // =========================================================================
  describe('mood sync – CREATE', () => {
    it('should create a mood entry with all fields', async () => {
      const op = buildOp({
        id: 'op-mood-create',
        entity: SyncEntity.MOOD,
        type: SyncOperationType.CREATE,
        data: {
          mood: 'GOOD',
          note: 'Feeling happy',
          context: 'MORNING',
          factors: ['exercise', 'sleep'],
          timestamp: '2026-02-08T08:00:00Z',
        },
      });

      const created = buildMoodEntry({
        mood: MoodType.GOOD,
        note: 'Feeling happy',
        context: MoodContext.MORNING,
      });
      prisma.moodEntry.create.mockResolvedValue(created as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(prisma.moodEntry.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          mood: MoodType.GOOD,
          note: 'Feeling happy',
          context: MoodContext.MORNING,
          factors: ['exercise', 'sleep'],
          timestamp: new Date('2026-02-08T08:00:00Z'),
        },
      });
    });

    it('should default context to MANUAL when not provided', async () => {
      const op = buildOp({
        entity: SyncEntity.MOOD,
        type: SyncOperationType.CREATE,
        data: { mood: 'CALM' },
      });

      prisma.moodEntry.create.mockResolvedValue(buildMoodEntry() as any);

      await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(prisma.moodEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          context: MoodContext.MANUAL,
        }),
      });
    });

    it('should fail with invalid mood type', async () => {
      const op = buildOp({
        entity: SyncEntity.MOOD,
        type: SyncOperationType.CREATE,
        data: { mood: 'INVALID_MOOD' },
      });

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Invalid mood');
    });
  });

  // =========================================================================
  // Mood sync – UPDATE
  // =========================================================================
  describe('mood sync – UPDATE', () => {
    it('should update an existing mood entry', async () => {
      const op = buildOp({
        id: 'op-mood-update',
        entity: SyncEntity.MOOD,
        type: SyncOperationType.UPDATE,
        data: {
          serverId: 'mood-1',
          mood: 'ENERGIZED',
          note: 'Updated note',
        },
      });

      prisma.moodEntry.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.moodEntry.findUnique.mockResolvedValue(
        buildMoodEntry({ mood: MoodType.ENERGIZED, note: 'Updated note' }) as any,
      );

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(true);
      expect(prisma.moodEntry.updateMany).toHaveBeenCalledWith({
        where: { id: 'mood-1', userId: TEST_USER_ID },
        data: expect.objectContaining({
          mood: MoodType.ENERGIZED,
          note: 'Updated note',
        }),
      });
    });

    it('should fail when mood entry to update is not found', async () => {
      const op = buildOp({
        entity: SyncEntity.MOOD,
        type: SyncOperationType.UPDATE,
        data: { serverId: 'nonexistent', mood: 'GOOD' },
      });

      prisma.moodEntry.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Mood entry not found');
    });
  });

  // =========================================================================
  // Mood sync – DELETE
  // =========================================================================
  describe('mood sync – DELETE', () => {
    it('should soft-delete a mood entry by setting deletedAt', async () => {
      const op = buildOp({
        entity: SyncEntity.MOOD,
        type: SyncOperationType.DELETE,
        data: { serverId: 'mood-1' },
      });

      prisma.moodEntry.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(true);
      expect(result.results[0].result).toEqual({ id: 'mood-1', deletedAt: true });
      expect(prisma.moodEntry.updateMany).toHaveBeenCalledWith({
        where: { id: 'mood-1', userId: TEST_USER_ID },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should fail when mood entry to delete is not found', async () => {
      const op = buildOp({
        entity: SyncEntity.MOOD,
        type: SyncOperationType.DELETE,
        data: { serverId: 'nonexistent' },
      });

      prisma.moodEntry.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Mood entry not found');
    });
  });

  // =========================================================================
  // Journal sync – CREATE
  // =========================================================================
  describe('journal sync – CREATE', () => {
    it('should create a journal entry with all fields', async () => {
      const op = buildOp({
        id: 'op-journal-create',
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.CREATE,
        data: {
          title: 'Gratitude Entry',
          content: 'Today I am grateful for...',
          tags: ['gratitude', 'daily'],
          isEncrypted: false,
          isLocked: true,
          promptId: 'prompt-1',
          moodEntryId: 'mood-1',
        },
      });

      const created = buildJournalEntry({
        title: 'Gratitude Entry',
        content: 'Today I am grateful for...',
        isLocked: true,
      });
      prisma.journalEntry.create.mockResolvedValue(created as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(true);
      expect(prisma.journalEntry.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          title: 'Gratitude Entry',
          content: 'Today I am grateful for...',
          promptId: 'prompt-1',
          moodEntryId: 'mood-1',
          tags: ['gratitude', 'daily'],
          isEncrypted: false,
          isLocked: true,
        },
      });
    });

    it('should fail when journal content is missing', async () => {
      const op = buildOp({
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.CREATE,
        data: { title: 'No content' },
      });

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Missing journal content');
    });

    it('should fail when journal content is an empty string', async () => {
      const op = buildOp({
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.CREATE,
        data: { content: '' },
      });

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Missing journal content');
    });
  });

  // =========================================================================
  // Journal sync – UPDATE
  // =========================================================================
  describe('journal sync – UPDATE', () => {
    it('should update an existing journal entry', async () => {
      const op = buildOp({
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.UPDATE,
        data: {
          serverId: 'journal-1',
          content: 'Updated content',
          tags: ['updated'],
        },
      });

      prisma.journalEntry.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.journalEntry.findUnique.mockResolvedValue(
        buildJournalEntry({ content: 'Updated content', tags: ['updated'] }) as any,
      );

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(true);
      expect(prisma.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { id: 'journal-1', userId: TEST_USER_ID },
        data: expect.objectContaining({
          content: 'Updated content',
          tags: ['updated'],
        }),
      });
    });

    it('should fail when journal entry to update is not found', async () => {
      const op = buildOp({
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.UPDATE,
        data: { serverId: 'nonexistent', content: 'Updated' },
      });

      prisma.journalEntry.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Journal entry not found');
    });
  });

  // =========================================================================
  // Journal sync – DELETE
  // =========================================================================
  describe('journal sync – DELETE', () => {
    it('should soft-delete a journal entry', async () => {
      const op = buildOp({
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.DELETE,
        data: { serverId: 'journal-1' },
      });

      prisma.journalEntry.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(true);
      expect(result.results[0].result).toEqual({ id: 'journal-1', deletedAt: true });
    });
  });

  // =========================================================================
  // Unsupported entity
  // =========================================================================
  describe('unsupported entity', () => {
    it('should fail for an unsupported sync entity', async () => {
      const op = buildOp({
        entity: 'unknown_entity' as SyncEntity,
        type: SyncOperationType.CREATE,
        data: {},
      });

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('Unsupported sync entity');
    });
  });

  // =========================================================================
  // Batch with mixed results
  // =========================================================================
  describe('batch with mixed operations', () => {
    it('should process multiple operations and report individual results', async () => {
      const ops: SyncOperationDto[] = [
        buildOp({
          id: 'op-1',
          entity: SyncEntity.MOOD,
          type: SyncOperationType.CREATE,
          data: { mood: 'GOOD' },
        }),
        buildOp({
          id: 'op-2',
          entity: SyncEntity.MOOD,
          type: SyncOperationType.CREATE,
          data: { mood: 'INVALID' },
        }),
        buildOp({
          id: 'op-3',
          entity: SyncEntity.JOURNAL,
          type: SyncOperationType.CREATE,
          data: { content: 'Hello world' },
        }),
      ];

      prisma.moodEntry.create.mockResolvedValue(buildMoodEntry() as any);
      prisma.journalEntry.create.mockResolvedValue(buildJournalEntry() as any);

      const result = await service.processBatch(TEST_USER_ID, { operations: ops });

      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].id).toBe('op-1');
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].id).toBe('op-2');
      expect(result.results[2].success).toBe(true);
      expect(result.results[2].id).toBe('op-3');
    });
  });

  // =========================================================================
  // Missing serverId on UPDATE/DELETE
  // =========================================================================
  describe('missing serverId', () => {
    it('should fail when update operation has no serverId', async () => {
      const op = buildOp({
        entity: SyncEntity.MOOD,
        type: SyncOperationType.UPDATE,
        data: { mood: 'CALM' },
      });

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Missing serverId');
    });

    it('should fail when delete operation has no serverId', async () => {
      const op = buildOp({
        entity: SyncEntity.JOURNAL,
        type: SyncOperationType.DELETE,
        data: {},
      });

      const result = await service.processBatch(TEST_USER_ID, { operations: [op] });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe('Missing serverId');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { JournalService } from './journal.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

describe('JournalService', () => {
  let service: JournalService;
  let prisma: DeepMockProxy<PrismaService>;

  const userId = 'user-123';

  const baseJournalEntry = {
    id: 'entry-1',
    userId,
    title: 'My Journal Entry',
    content: 'Today was a good day.',
    promptId: null,
    moodEntryId: null,
    tags: ['gratitude', 'reflection'],
    isEncrypted: false,
    isLocked: false,
    createdAt: new Date('2026-02-08T10:00:00Z'),
    updatedAt: new Date('2026-02-08T10:00:00Z'),
    deletedAt: null,
  };

  const baseEntryWithMood = {
    ...baseJournalEntry,
    moodEntry: {
      id: 'mood-1',
      userId,
      mood: 'GOOD',
      note: 'Feeling great',
      context: 'MANUAL',
      factors: [],
      timestamp: new Date('2026-02-08T10:00:00Z'),
      createdAt: new Date('2026-02-08T10:00:00Z'),
      updatedAt: new Date('2026-02-08T10:00:00Z'),
      deletedAt: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
      ],
    }).compile();

    service = module.get<JournalService>(JournalService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    it('should create a journal entry with all fields provided', async () => {
      const dto: CreateJournalEntryDto = {
        title: 'My Journal Entry',
        content: 'Today was a good day.',
        promptId: 'prompt-1',
        moodEntryId: 'mood-1',
        tags: ['gratitude', 'reflection'],
        isEncrypted: true,
        isLocked: true,
      };

      const expectedEntry = {
        ...baseJournalEntry,
        promptId: 'prompt-1',
        moodEntryId: 'mood-1',
        isEncrypted: true,
        isLocked: true,
      };

      prisma.journalEntry.create.mockResolvedValue(expectedEntry);

      const result = await service.create(userId, dto);

      expect(prisma.journalEntry.create).toHaveBeenCalledWith({
        data: {
          userId,
          title: 'My Journal Entry',
          content: 'Today was a good day.',
          promptId: 'prompt-1',
          moodEntryId: 'mood-1',
          tags: ['gratitude', 'reflection'],
          isEncrypted: true,
          isLocked: true,
        },
      });
      expect(result).toEqual(expectedEntry);
    });

    it('should default tags to empty array when not provided', async () => {
      const dto: CreateJournalEntryDto = {
        content: 'Simple entry without tags.',
      };

      prisma.journalEntry.create.mockResolvedValue({
        ...baseJournalEntry,
        title: undefined as any,
        tags: [],
      });

      await service.create(userId, dto);

      expect(prisma.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tags: [],
        }),
      });
    });

    it('should default isEncrypted and isLocked to false when not provided', async () => {
      const dto: CreateJournalEntryDto = {
        content: 'Simple entry.',
      };

      prisma.journalEntry.create.mockResolvedValue({
        ...baseJournalEntry,
        isEncrypted: false,
        isLocked: false,
      });

      await service.create(userId, dto);

      expect(prisma.journalEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isEncrypted: false,
          isLocked: false,
        }),
      });
    });
  });

  // =========================================================================
  // findAll
  // =========================================================================
  describe('findAll', () => {
    it('should return paginated journal entries with default limit and offset', async () => {
      const entries = [baseEntryWithMood, { ...baseEntryWithMood, id: 'entry-2' }];
      prisma.journalEntry.findMany.mockResolvedValue(entries);

      const result = await service.findAll(userId);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: { moodEntry: true },
      });
      expect(result).toHaveLength(2);
    });

    it('should return paginated results with custom limit and offset', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([baseEntryWithMood]);

      const result = await service.findAll(userId, 10, 20);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
        include: { moodEntry: true },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no entries exist', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });

    it('should exclude soft-deleted entries', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      await service.findAll(userId);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  // =========================================================================
  // findOne
  // =========================================================================
  describe('findOne', () => {
    it('should return a journal entry when found', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(baseEntryWithMood);

      const result = await service.findOne(userId, 'entry-1');

      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId, deletedAt: null },
        include: { moodEntry: true },
      });
      expect(result).toEqual(baseEntryWithMood);
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with correct message', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'nonexistent')).rejects.toThrow(
        'Journal entry not found',
      );
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('update', () => {
    it('should update a journal entry after verifying it exists', async () => {
      const dto: UpdateJournalEntryDto = {
        title: 'Updated Title',
        content: 'Updated content.',
        tags: ['updated'],
        isLocked: true,
      };

      const updatedEntry = {
        ...baseJournalEntry,
        title: 'Updated Title',
        content: 'Updated content.',
        tags: ['updated'],
        isLocked: true,
      };

      prisma.journalEntry.findFirst.mockResolvedValue(baseEntryWithMood);
      prisma.journalEntry.update.mockResolvedValue(updatedEntry);

      const result = await service.update(userId, 'entry-1', dto);

      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId, deletedAt: null },
        include: { moodEntry: true },
      });
      expect(prisma.journalEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          title: 'Updated Title',
          content: 'Updated content.',
          tags: ['updated'],
          isLocked: true,
        },
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, 'nonexistent', { content: 'test' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // delete (soft delete)
  // =========================================================================
  describe('delete', () => {
    it('should soft delete by setting deletedAt timestamp', async () => {
      const deletedEntry = {
        ...baseJournalEntry,
        deletedAt: new Date(),
      };

      prisma.journalEntry.findFirst.mockResolvedValue(baseEntryWithMood);
      prisma.journalEntry.update.mockResolvedValue(deletedEntry);

      const result = await service.delete(userId, 'entry-1');

      expect(prisma.journalEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.delete(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // restore
  // =========================================================================
  describe('restore', () => {
    it('should restore a soft-deleted entry by setting deletedAt to null', async () => {
      const deletedEntry = {
        ...baseJournalEntry,
        deletedAt: new Date('2026-02-07T10:00:00Z'),
      };
      const restoredEntry = {
        ...baseJournalEntry,
        deletedAt: null,
      };

      prisma.journalEntry.findFirst.mockResolvedValue(deletedEntry);
      prisma.journalEntry.update.mockResolvedValue(restoredEntry);

      const result = await service.restore(userId, 'entry-1');

      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId, deletedAt: { not: null } },
      });
      expect(prisma.journalEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: { deletedAt: null },
      });
      expect(result.deletedAt).toBeNull();
    });

    it('should throw NotFoundException when entry is not found or not deleted', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(service.restore(userId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.restore(userId, 'nonexistent')).rejects.toThrow(
        'Entry not found or not deleted',
      );

      expect(prisma.journalEntry.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // permanentDelete
  // =========================================================================
  describe('permanentDelete', () => {
    it('should permanently delete an entry', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(baseJournalEntry);
      prisma.journalEntry.delete.mockResolvedValue(baseJournalEntry);

      const result = await service.permanentDelete(userId, 'entry-1');

      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entry-1', userId },
      });
      expect(prisma.journalEntry.delete).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
      });
      expect(result).toEqual(baseJournalEntry);
    });

    it('should throw NotFoundException when entry is not found', async () => {
      prisma.journalEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.permanentDelete(userId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.permanentDelete(userId, 'nonexistent'),
      ).rejects.toThrow('Entry not found');

      expect(prisma.journalEntry.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // search
  // =========================================================================
  describe('search', () => {
    it('should search entries by title, content, and tags', async () => {
      const entries = [baseJournalEntry];
      prisma.journalEntry.findMany.mockResolvedValue(entries);

      const result = await service.search(userId, 'good');

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
          isLocked: false,
          OR: [
            { title: { contains: 'good', mode: 'insensitive' } },
            { content: { contains: 'good', mode: 'insensitive' } },
            { tags: { has: 'good' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(entries);
    });

    it('should exclude locked entries from search results', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      await service.search(userId, 'secret');

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isLocked: false,
          }),
        }),
      );
    });

    it('should return empty array when no matches found', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      const result = await service.search(userId, 'nonexistent-term');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // findByTag
  // =========================================================================
  describe('findByTag', () => {
    it('should return entries matching the given tag', async () => {
      const entries = [baseJournalEntry];
      prisma.journalEntry.findMany.mockResolvedValue(entries);

      const result = await service.findByTag(userId, 'gratitude');

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: null,
          tags: { has: 'gratitude' },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(entries);
    });

    it('should return empty array when no entries have the tag', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      const result = await service.findByTag(userId, 'nonexistent-tag');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // findByMood
  // =========================================================================
  describe('findByMood', () => {
    it('should return entries associated with a mood entry', async () => {
      const entries = [baseJournalEntry];
      prisma.journalEntry.findMany.mockResolvedValue(entries);

      const result = await service.findByMood(userId, 'mood-1');

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          moodEntryId: 'mood-1',
          deletedAt: null,
        },
      });
      expect(result).toEqual(entries);
    });

    it('should return empty array when no entries match the mood', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      const result = await service.findByMood(userId, 'mood-nonexistent');

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getDeleted
  // =========================================================================
  describe('getDeleted', () => {
    it('should return entries deleted within the last 30 days', async () => {
      const deletedEntry = {
        ...baseJournalEntry,
        deletedAt: new Date('2026-02-05T10:00:00Z'),
      };

      prisma.journalEntry.findMany.mockResolvedValue([deletedEntry]);

      const result = await service.getDeleted(userId);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          deletedAt: {
            not: null,
            gte: expect.any(Date),
          },
        },
        orderBy: { deletedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].deletedAt).toBeDefined();
    });

    it('should return empty array when no deleted entries exist', async () => {
      prisma.journalEntry.findMany.mockResolvedValue([]);

      const result = await service.getDeleted(userId);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getRecentEntries
  // =========================================================================
  describe('getRecentEntries', () => {
    it('should return recent entries with default limit of 10', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => ({
        ...baseJournalEntry,
        id: `entry-${i}`,
      }));
      prisma.journalEntry.findMany.mockResolvedValue(entries);

      const result = await service.getRecentEntries(userId);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toHaveLength(10);
    });

    it('should return recent entries with custom limit', async () => {
      const entries = [baseJournalEntry];
      prisma.journalEntry.findMany.mockResolvedValue(entries);

      const result = await service.getRecentEntries(userId, 5);

      expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      expect(result).toHaveLength(1);
    });
  });
});

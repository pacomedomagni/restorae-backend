import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ContentType, ContentStatus } from '@prisma/client';
import { ContentService } from './content.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ContentService', () => {
  let service: ContentService;
  let prisma: DeepMockProxy<PrismaService>;

  // A free, published content item with locale and audio
  const baseContentItem = {
    id: 'content-1',
    type: ContentType.BREATHING,
    slug: 'box-breathing',
    name: 'Box Breathing',
    description: 'A calming breathing technique',
    data: { inhale: 4, hold: 4, exhale: 4 },
    category: 'relaxation',
    tags: ['calm', 'beginner'],
    bestFor: 'anxiety',
    duration: '5 min',
    icon: 'lungs',
    imageUrl: null,
    videoUrl: null,
    isPremium: false,
    order: 1,
    status: ContentStatus.PUBLISHED,
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    audioFileId: 'audio-1',
    locales: [
      {
        id: 'locale-1',
        contentItemId: 'content-1',
        locale: 'en',
        name: 'Box Breathing',
        description: 'A calming breathing technique',
        data: { instructions: 'Breathe in for 4 seconds...' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    audioFile: {
      id: 'audio-1',
      name: 'box-breathing-audio',
      description: 'Guided audio',
      url: 'https://cdn.example.com/audio/box-breathing.mp3',
      duration: 300,
      fileSize: 5000000,
      mimeType: 'audio/mpeg',
      uploadedBy: 'admin-1',
      createdAt: new Date(),
    },
  };

  /** Factory that returns a fresh premium content item each time (avoids mutation across tests). */
  const makePremiumContentItem = () => ({
    ...baseContentItem,
    id: 'content-2',
    slug: 'advanced-breathing',
    name: 'Advanced Breathing',
    isPremium: true,
    locales: [
      {
        ...baseContentItem.locales[0],
        id: 'locale-2',
        contentItemId: 'content-2',
        name: 'Advanced Breathing',
      },
    ],
    audioFile: {
      ...baseContentItem.audioFile,
      id: 'audio-2',
      url: 'https://cdn.example.com/audio/advanced-breathing.mp3',
    },
  });

  const contentItemWithoutLocale = {
    ...baseContentItem,
    id: 'content-3',
    slug: 'grounding-54321',
    name: 'Grounding 5-4-3-2-1',
    type: ContentType.GROUNDING,
    locales: [],
    audioFile: null,
    audioFileId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
      ],
    }).compile();

    service = module.get<ContentService>(ContentService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // getContent
  // =========================================================================
  describe('getContent', () => {
    it('should return all published content without type filter', async () => {
      prisma.contentItem.findMany.mockResolvedValue([baseContentItem as any]);

      const result = await service.getContent();

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          status: ContentStatus.PUBLISHED,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should filter by content type when type is provided', async () => {
      prisma.contentItem.findMany.mockResolvedValue([baseContentItem as any]);

      await service.getContent('breathing');

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          status: ContentStatus.PUBLISHED,
          type: ContentType.BREATHING,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
    });

    it('should filter by isPremium when provided', async () => {
      prisma.contentItem.findMany.mockResolvedValue([]);

      await service.getContent(undefined, 'en', false);

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          status: ContentStatus.PUBLISHED,
          isPremium: false,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
    });

    it('should scrub audio URL for premium content when userTier is FREE', async () => {
      prisma.contentItem.findMany.mockResolvedValue([makePremiumContentItem() as any]);

      const result = await service.getContent(undefined, 'en', undefined, 'FREE');

      expect(result).toHaveLength(1);
      expect(result[0].audioFile!.url).toBeNull();
    });

    it('should keep audio URL for premium content when userTier is PREMIUM', async () => {
      prisma.contentItem.findMany.mockResolvedValue([makePremiumContentItem() as any]);

      const result = await service.getContent(undefined, 'en', undefined, 'PREMIUM');

      expect(result).toHaveLength(1);
      expect(result[0].audioFile!.url).toBe(
        'https://cdn.example.com/audio/advanced-breathing.mp3',
      );
    });

    it('should merge locale data over base item fields', async () => {
      prisma.contentItem.findMany.mockResolvedValue([baseContentItem as any]);

      const result = await service.getContent();

      expect(result[0].name).toBe('Box Breathing');
      expect(result[0].description).toBe('A calming breathing technique');
      // Locale data should be merged into data
      expect(result[0].data).toEqual(
        expect.objectContaining({
          inhale: 4,
          hold: 4,
          exhale: 4,
          instructions: 'Breathe in for 4 seconds...',
        }),
      );
      // locales field should be stripped
      expect(result[0].locales).toBeUndefined();
    });

    it('should return item without locale merge when no locale data exists', async () => {
      prisma.contentItem.findMany.mockResolvedValue([
        contentItemWithoutLocale as any,
      ]);

      const result = await service.getContent();

      expect(result[0].name).toBe('Grounding 5-4-3-2-1');
      // locales key should not exist in the result when stripped
      expect(result[0]).not.toHaveProperty('locales');
    });

    it('should not scrub audio URL for free content regardless of tier', async () => {
      prisma.contentItem.findMany.mockResolvedValue([baseContentItem as any]);

      const result = await service.getContent(undefined, 'en', undefined, 'FREE');

      expect(result[0].audioFile!.url).toBe(
        'https://cdn.example.com/audio/box-breathing.mp3',
      );
    });

    it('should handle invalid content type string gracefully', async () => {
      prisma.contentItem.findMany.mockResolvedValue([]);

      await service.getContent('INVALID_TYPE');

      // The where should not include a type since it won't match any enum
      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          status: ContentStatus.PUBLISHED,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
    });
  });

  // =========================================================================
  // getBreathingPatterns
  // =========================================================================
  describe('getBreathingPatterns', () => {
    it('should call getByType with BREATHING type', async () => {
      prisma.contentItem.findMany.mockResolvedValue([baseContentItem as any]);

      const result = await service.getBreathingPatterns('en', 'FREE');

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          type: ContentType.BREATHING,
          status: ContentStatus.PUBLISHED,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // getGroundingTechniques
  // =========================================================================
  describe('getGroundingTechniques', () => {
    it('should call getByType with GROUNDING type', async () => {
      prisma.contentItem.findMany.mockResolvedValue([
        contentItemWithoutLocale as any,
      ]);

      const result = await service.getGroundingTechniques('en', 'FREE');

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          type: ContentType.GROUNDING,
          status: ContentStatus.PUBLISHED,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // getFocusSessions
  // =========================================================================
  describe('getFocusSessions', () => {
    it('should call getByType with FOCUS type', async () => {
      const focusItem = {
        ...baseContentItem,
        type: ContentType.FOCUS,
      };
      prisma.contentItem.findMany.mockResolvedValue([focusItem as any]);

      const result = await service.getFocusSessions('en', 'PREMIUM');

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          type: ContentType.FOCUS,
          status: ContentStatus.PUBLISHED,
        },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // =========================================================================
  // getBySlug
  // =========================================================================
  describe('getBySlug', () => {
    it('should return a content item by slug', async () => {
      prisma.contentItem.findUnique.mockResolvedValue(baseContentItem as any);

      const result = await service.getBySlug('box-breathing');

      expect(prisma.contentItem.findUnique).toHaveBeenCalledWith({
        where: { slug: 'box-breathing' },
        include: {
          locales: { where: { locale: 'en' } },
          audioFile: true,
        },
      });
      expect(result.name).toBe('Box Breathing');
    });

    it('should throw NotFoundException when slug is not found', async () => {
      prisma.contentItem.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug('nonexistent-slug')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getBySlug('nonexistent-slug')).rejects.toThrow(
        'Content not found',
      );
    });

    it('should scrub audio URL for premium content when user is FREE tier', async () => {
      prisma.contentItem.findUnique.mockResolvedValue(makePremiumContentItem() as any);

      const result = await service.getBySlug('advanced-breathing', 'en', 'FREE');

      expect(result!.audioFile!.url).toBeNull();
    });

    it('should keep audio URL for premium content when user is PREMIUM tier', async () => {
      prisma.contentItem.findUnique.mockResolvedValue(makePremiumContentItem() as any);

      const result = await service.getBySlug(
        'advanced-breathing',
        'en',
        'PREMIUM',
      );

      expect(result!.audioFile!.url).toBe(
        'https://cdn.example.com/audio/advanced-breathing.mp3',
      );
    });

    it('should use specified locale', async () => {
      prisma.contentItem.findUnique.mockResolvedValue(baseContentItem as any);

      await service.getBySlug('box-breathing', 'es');

      expect(prisma.contentItem.findUnique).toHaveBeenCalledWith({
        where: { slug: 'box-breathing' },
        include: {
          locales: { where: { locale: 'es' } },
          audioFile: true,
        },
      });
    });
  });

  // =========================================================================
  // getFreeContentIds
  // =========================================================================
  describe('getFreeContentIds', () => {
    it('should return slugs of all free published content', async () => {
      prisma.contentItem.findMany.mockResolvedValue([
        { slug: 'box-breathing' } as any,
        { slug: 'grounding-54321' } as any,
      ]);

      const result = await service.getFreeContentIds();

      expect(prisma.contentItem.findMany).toHaveBeenCalledWith({
        where: {
          isPremium: false,
          status: ContentStatus.PUBLISHED,
        },
        select: { slug: true },
      });
      expect(result).toEqual(['box-breathing', 'grounding-54321']);
    });

    it('should return empty array when no free content exists', async () => {
      prisma.contentItem.findMany.mockResolvedValue([]);

      const result = await service.getFreeContentIds();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Premium gating across getByType
  // =========================================================================
  describe('premium gating via getByType', () => {
    it('should scrub audio URL on premium items for FREE tier in getByType', async () => {
      prisma.contentItem.findMany.mockResolvedValue([makePremiumContentItem() as any]);

      const result = await service.getBreathingPatterns('en', 'FREE');

      expect(result[0].audioFile!.url).toBeNull();
    });

    it('should preserve audio URL on premium items for PREMIUM tier in getByType', async () => {
      prisma.contentItem.findMany.mockResolvedValue([makePremiumContentItem() as any]);

      const result = await service.getBreathingPatterns('en', 'PREMIUM');

      expect(result[0].audioFile!.url).toBe(
        'https://cdn.example.com/audio/advanced-breathing.mp3',
      );
    });

    it('should not scrub audio URL for free items regardless of tier', async () => {
      prisma.contentItem.findMany.mockResolvedValue([baseContentItem as any]);

      const result = await service.getBreathingPatterns('en', 'FREE');

      expect(result[0].audioFile!.url).toBe(
        'https://cdn.example.com/audio/box-breathing.mp3',
      );
    });

    it('should handle items without audioFile gracefully when premium gating', async () => {
      const premiumNoAudio = {
        ...contentItemWithoutLocale,
        isPremium: true,
      };
      prisma.contentItem.findMany.mockResolvedValue([premiumNoAudio as any]);

      const result = await service.getGroundingTechniques('en', 'FREE');

      // Should not throw, audioFile is null so scrubbing block is skipped
      expect(result).toHaveLength(1);
      expect(result[0].audioFile).toBeNull();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  ContentStatus,
  StoryMood,
  StoryCategory,
} from '@prisma/client';
import { StoriesService } from './stories.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StoriesService', () => {
  let service: StoriesService;
  let prisma: DeepMockProxy<PrismaService>;

  const userId = 'user-123';

  const baseStory = {
    id: 'story-1',
    slug: 'moonlit-meadow',
    title: 'The Moonlit Meadow',
    subtitle: 'A peaceful journey',
    description: 'Drift into peaceful slumber...',
    narrator: 'Sarah Williams',
    duration: 30,
    audioUrl: 'https://cdn.example.com/stories/moonlit.mp3',
    artworkUrl: 'https://cdn.example.com/artwork/moonlit.jpg',
    category: StoryCategory.NATURE,
    tags: ['nature', 'peaceful'],
    isPremium: false,
    mood: StoryMood.CALM,
    backgroundSound: 'ambient-rain-001',
    order: 1,
    status: ContentStatus.PUBLISHED,
    listenCount: 42,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    locales: [
      {
        id: 'locale-1',
        storyId: 'story-1',
        locale: 'en',
        title: 'The Moonlit Meadow',
        subtitle: 'A peaceful journey',
        description: 'Drift into peaceful slumber...',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const premiumStory = {
    ...baseStory,
    id: 'story-2',
    slug: 'enchanted-forest',
    title: 'The Enchanted Forest',
    isPremium: true,
    audioUrl: 'https://cdn.example.com/stories/enchanted.mp3',
    locales: [
      {
        id: 'locale-2',
        storyId: 'story-2',
        locale: 'en',
        title: 'The Enchanted Forest',
        subtitle: 'A magical adventure',
        description: 'Enter the enchanted forest...',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const storyWithoutLocale = {
    ...baseStory,
    id: 'story-3',
    slug: 'ocean-waves',
    title: 'Ocean Waves',
    subtitle: null,
    locales: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // getAll (findAll)
  // =========================================================================
  describe('getAll', () => {
    it('should return all published stories', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([baseStory as any]);

      const result = await service.getAll();

      expect(prisma.bedtimeStory.findMany).toHaveBeenCalledWith({
        where: { status: ContentStatus.PUBLISHED },
        include: {
          locales: { where: { locale: 'en' } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });
      expect(result).toHaveLength(1);
    });

    it('should scrub audioUrl for premium stories when userTier is FREE', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([premiumStory as any]);

      const result = await service.getAll('en', 'FREE');

      expect((result[0] as any).audioUrl).toBeNull();
    });

    it('should keep audioUrl for premium stories when userTier is PREMIUM', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([premiumStory as any]);

      const result = await service.getAll('en', 'PREMIUM');

      expect((result[0] as any).audioUrl).toBe(
        'https://cdn.example.com/stories/enchanted.mp3',
      );
    });

    it('should not scrub audioUrl for free stories regardless of tier', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([baseStory as any]);

      const result = await service.getAll('en', 'FREE');

      expect((result[0] as any).audioUrl).toBe(
        'https://cdn.example.com/stories/moonlit.mp3',
      );
    });

    it('should merge locale data over base story fields', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([baseStory as any]);

      const result = await service.getAll();

      expect(result[0].title).toBe('The Moonlit Meadow');
      expect(result[0].subtitle).toBe('A peaceful journey');
      expect(result[0].description).toBe('Drift into peaceful slumber...');
    });

    it('should use base fields when no locale data exists', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([
        storyWithoutLocale as any,
      ]);

      const result = await service.getAll();

      expect(result[0].title).toBe('Ocean Waves');
      expect(result[0].subtitle).toBeNull();
    });

    it('should return empty array when no stories exist', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });

    it('should use specified locale', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([]);

      await service.getAll('es');

      expect(prisma.bedtimeStory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            locales: { where: { locale: 'es' } },
          },
        }),
      );
    });
  });

  // =========================================================================
  // getBySlug (findBySlug)
  // =========================================================================
  describe('getBySlug', () => {
    it('should return a story by slug', async () => {
      prisma.bedtimeStory.findUnique.mockResolvedValue(baseStory as any);

      const result = await service.getBySlug('moonlit-meadow');

      expect(prisma.bedtimeStory.findUnique).toHaveBeenCalledWith({
        where: { slug: 'moonlit-meadow' },
        include: {
          locales: { where: { locale: 'en' } },
        },
      });
      expect(result.title).toBe('The Moonlit Meadow');
    });

    it('should throw NotFoundException when story is not found', async () => {
      prisma.bedtimeStory.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug('nonexistent-slug')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getBySlug('nonexistent-slug')).rejects.toThrow(
        'Story not found',
      );
    });

    it('should scrub audioUrl for premium story when user is FREE tier', async () => {
      prisma.bedtimeStory.findUnique.mockResolvedValue(premiumStory as any);

      const result = await service.getBySlug('enchanted-forest', 'en', 'FREE');

      expect((result as any).audioUrl).toBeNull();
    });

    it('should keep audioUrl for premium story when user is PREMIUM tier', async () => {
      prisma.bedtimeStory.findUnique.mockResolvedValue(premiumStory as any);

      const result = await service.getBySlug(
        'enchanted-forest',
        'en',
        'PREMIUM',
      );

      expect((result as any).audioUrl).toBe(
        'https://cdn.example.com/stories/enchanted.mp3',
      );
    });

    it('should merge locale data for single story', async () => {
      prisma.bedtimeStory.findUnique.mockResolvedValue(premiumStory as any);

      const result = await service.getBySlug(
        'enchanted-forest',
        'en',
        'PREMIUM',
      );

      expect(result.title).toBe('The Enchanted Forest');
      expect(result.subtitle).toBe('A magical adventure');
    });
  });

  // =========================================================================
  // getFavorites
  // =========================================================================
  describe('getFavorites', () => {
    it('should return user favorite stories with favorited flag', async () => {
      const mockFavorites = [
        {
          id: 'fav-1',
          userId,
          storyId: 'story-1',
          createdAt: new Date(),
          story: baseStory,
        },
      ];

      (prisma as any).userStoryFavorite = {
        findMany: jest.fn().mockResolvedValue(mockFavorites),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      };

      const result = await service.getFavorites(userId, 'en');

      expect((prisma as any).userStoryFavorite.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          story: {
            include: {
              locales: { where: { locale: 'en' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].favorited).toBe(true);
      expect(result[0].title).toBe('The Moonlit Meadow');
    });

    it('should return empty array when user has no favorites', async () => {
      (prisma as any).userStoryFavorite = {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      };

      const result = await service.getFavorites(userId);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // toggleFavorite (addFavorite / removeFavorite)
  // =========================================================================
  describe('toggleFavorite', () => {
    it('should add a favorite when it does not exist', async () => {
      (prisma as any).userStoryFavorite = {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'fav-new',
          userId,
          storyId: 'story-1',
          createdAt: new Date(),
        }),
        delete: jest.fn(),
        findMany: jest.fn(),
      };

      const result = await service.toggleFavorite(userId, 'story-1');

      expect((prisma as any).userStoryFavorite.findUnique).toHaveBeenCalledWith({
        where: {
          userId_storyId: { userId, storyId: 'story-1' },
        },
      });
      expect((prisma as any).userStoryFavorite.create).toHaveBeenCalledWith({
        data: { userId, storyId: 'story-1' },
      });
      expect(result).toEqual({ favorited: true });
    });

    it('should remove a favorite when it already exists', async () => {
      const existingFavorite = {
        id: 'fav-existing',
        userId,
        storyId: 'story-1',
        createdAt: new Date(),
      };

      (prisma as any).userStoryFavorite = {
        findUnique: jest.fn().mockResolvedValue(existingFavorite),
        delete: jest.fn().mockResolvedValue(existingFavorite),
        create: jest.fn(),
        findMany: jest.fn(),
      };

      const result = await service.toggleFavorite(userId, 'story-1');

      expect((prisma as any).userStoryFavorite.delete).toHaveBeenCalledWith({
        where: { id: 'fav-existing' },
      });
      expect((prisma as any).userStoryFavorite.create).not.toHaveBeenCalled();
      expect(result).toEqual({ favorited: false });
    });
  });

  // =========================================================================
  // getFreeStoryIds
  // =========================================================================
  describe('getFreeStoryIds', () => {
    it('should return ids and slugs of free published stories', async () => {
      const freeStories = [
        { id: 'story-1', slug: 'moonlit-meadow' },
        { id: 'story-3', slug: 'ocean-waves' },
      ];

      prisma.bedtimeStory.findMany.mockResolvedValue(freeStories as any);

      const result = await service.getFreeStoryIds();

      expect(prisma.bedtimeStory.findMany).toHaveBeenCalledWith({
        where: {
          isPremium: false,
          status: ContentStatus.PUBLISHED,
        },
        select: { id: true, slug: true },
      });
      expect(result).toEqual(freeStories);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no free stories exist', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([]);

      const result = await service.getFreeStoryIds();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // Premium gating
  // =========================================================================
  describe('premium gating', () => {
    it('should scrub audioUrl on premium stories for FREE tier in getAll', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([
        baseStory as any,
        premiumStory as any,
      ]);

      const result = await service.getAll('en', 'FREE');

      // Free story should keep audioUrl
      expect((result[0] as any).audioUrl).toBe(
        'https://cdn.example.com/stories/moonlit.mp3',
      );
      // Premium story should have scrubbed audioUrl
      expect((result[1] as any).audioUrl).toBeNull();
    });

    it('should preserve all audioUrls for PREMIUM tier', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([
        baseStory as any,
        premiumStory as any,
      ]);

      const result = await service.getAll('en', 'PREMIUM');

      expect((result[0] as any).audioUrl).toBe(
        'https://cdn.example.com/stories/moonlit.mp3',
      );
      expect((result[1] as any).audioUrl).toBe(
        'https://cdn.example.com/stories/enchanted.mp3',
      );
    });
  });

  // =========================================================================
  // getByCategory
  // =========================================================================
  describe('getByCategory', () => {
    it('should return stories filtered by category', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([baseStory as any]);

      const result = await service.getByCategory(StoryCategory.NATURE);

      expect(prisma.bedtimeStory.findMany).toHaveBeenCalledWith({
        where: {
          status: ContentStatus.PUBLISHED,
          category: StoryCategory.NATURE,
        },
        include: {
          locales: { where: { locale: 'en' } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });
      expect(result).toHaveLength(1);
    });

    it('should apply premium gating by category', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([premiumStory as any]);

      const result = await service.getByCategory(
        StoryCategory.NATURE,
        'en',
        'FREE',
      );

      expect((result[0] as any).audioUrl).toBeNull();
    });
  });

  // =========================================================================
  // getByMood
  // =========================================================================
  describe('getByMood', () => {
    it('should return stories filtered by mood', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([baseStory as any]);

      const result = await service.getByMood(StoryMood.CALM);

      expect(prisma.bedtimeStory.findMany).toHaveBeenCalledWith({
        where: {
          status: ContentStatus.PUBLISHED,
          mood: StoryMood.CALM,
        },
        include: {
          locales: { where: { locale: 'en' } },
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      });
      expect(result).toHaveLength(1);
    });

    it('should apply premium gating by mood', async () => {
      prisma.bedtimeStory.findMany.mockResolvedValue([premiumStory as any]);

      const result = await service.getByMood(StoryMood.CALM, 'en', 'FREE');

      expect((result[0] as any).audioUrl).toBeNull();
    });
  });

  // =========================================================================
  // getCategories
  // =========================================================================
  describe('getCategories', () => {
    it('should return all story categories with formatted names', async () => {
      const result = await service.getCategories();

      expect(result).toEqual(
        expect.arrayContaining([
          { key: 'NATURE', name: 'Nature' },
          { key: 'TRAVEL', name: 'Travel' },
          { key: 'FANTASY', name: 'Fantasy' },
          { key: 'MEDITATION', name: 'Meditation' },
          { key: 'SOUNDSCAPES', name: 'Soundscapes' },
          { key: 'CLASSICS', name: 'Classics' },
        ]),
      );
      expect(result).toHaveLength(Object.values(StoryCategory).length);
    });
  });

  // =========================================================================
  // trackPlay
  // =========================================================================
  describe('trackPlay', () => {
    it('should increment listen count for a story', async () => {
      prisma.bedtimeStory.update.mockResolvedValue({
        ...baseStory,
        listenCount: 43,
      } as any);

      await service.trackPlay('story-1', userId);

      expect(prisma.bedtimeStory.update).toHaveBeenCalledWith({
        where: { id: 'story-1' },
        data: {
          listenCount: { increment: 1 },
        },
      });
    });

    it('should work without a userId', async () => {
      prisma.bedtimeStory.update.mockResolvedValue(baseStory as any);

      await service.trackPlay('story-1');

      expect(prisma.bedtimeStory.update).toHaveBeenCalledWith({
        where: { id: 'story-1' },
        data: {
          listenCount: { increment: 1 },
        },
      });
    });
  });
});

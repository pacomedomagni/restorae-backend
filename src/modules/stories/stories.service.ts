import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, StoryMood, StoryCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoryDto, UpdateStoryDto } from './dto/story.dto';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  // Get all stories for mobile app (with premium gating)
  async getAll(locale = 'en', userTier = 'FREE') {
    const stories = await this.prisma.bedtimeStory.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
      },
      include: {
        locales: {
          where: { locale },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return stories.map((story) => {
      const merged = this.mergeLocale(story, locale);

      // Scrub premium content for free users
      if (story.isPremium && userTier === 'FREE') {
        return {
          ...merged,
          audioUrl: null,
        };
      }

      return merged;
    });
  }

  // Get stories by category (enum)
  async getByCategory(category: StoryCategory, locale = 'en', userTier = 'FREE') {
    const stories = await this.prisma.bedtimeStory.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        category,
      },
      include: {
        locales: {
          where: { locale },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return stories.map((story) => {
      const merged = this.mergeLocale(story, locale);

      if (story.isPremium && userTier === 'FREE') {
        return {
          ...merged,
          audioUrl: null,
        };
      }

      return merged;
    });
  }

  // Get stories by mood
  async getByMood(mood: StoryMood, locale = 'en', userTier = 'FREE') {
    const stories = await this.prisma.bedtimeStory.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        mood,
      },
      include: {
        locales: {
          where: { locale },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return stories.map((story) => {
      const merged = this.mergeLocale(story, locale);

      if (story.isPremium && userTier === 'FREE') {
        return {
          ...merged,
          audioUrl: null,
        };
      }

      return merged;
    });
  }

  // Get single story by slug
  async getBySlug(slug: string, locale = 'en', userTier = 'FREE') {
    const story = await this.prisma.bedtimeStory.findUnique({
      where: { slug },
      include: {
        locales: {
          where: { locale },
        },
      },
    });

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const merged = this.mergeLocale(story, locale);

    if (story.isPremium && userTier === 'FREE') {
      return {
        ...merged,
        audioUrl: null,
      };
    }

    return merged;
  }

  // Get all categories (enum values)
  async getCategories() {
    return Object.values(StoryCategory).map((category) => ({
      key: category,
      name: this.formatCategoryName(category),
    }));
  }

  // Get free story IDs for gating
  async getFreeStoryIds() {
    const freeStories = await this.prisma.bedtimeStory.findMany({
      where: {
        isPremium: false,
        status: ContentStatus.PUBLISHED,
      },
      select: { id: true, slug: true },
    });

    return freeStories;
  }

  // Track story play (for analytics)
  async trackPlay(storyId: string, _userId?: string) {
    await this.prisma.bedtimeStory.update({
      where: { id: storyId },
      data: {
        listenCount: { increment: 1 },
      },
    });

    // If user is logged in, could also track in user activity
  }

  // ==================== ADMIN METHODS ====================

  // Admin: Create story
  async create(dto: CreateStoryDto) {
    const { locales, ...data } = dto;

    return this.prisma.bedtimeStory.create({
      data: {
        ...data,
        locales: locales
          ? {
              create: locales.map((l) => ({
                locale: l.locale,
                title: l.title,
                subtitle: l.subtitle || null,
                description: l.description || dto.description, // Use main description if not provided
              })),
            }
          : undefined,
      },
      include: {
        locales: true,
      },
    });
  }

  // Admin: Update story
  async update(id: string, dto: UpdateStoryDto) {
    const { locales, ...data } = dto;

    // Update main story data
    const story = await this.prisma.bedtimeStory.update({
      where: { id },
      data,
      include: {
        locales: true,
      },
    });

    // Update locales if provided
    if (locales) {
      for (const l of locales) {
        await this.prisma.bedtimeStoryLocale.upsert({
          where: {
            storyId_locale: { storyId: id, locale: l.locale },
          },
          update: {
            title: l.title,
            subtitle: l.subtitle || null,
            description: l.description || story.description,
          },
          create: {
            storyId: id,
            locale: l.locale,
            title: l.title,
            subtitle: l.subtitle || null,
            description: l.description || story.description,
          },
        });
      }
    }

    return story;
  }

  // Admin: Delete story
  async delete(id: string) {
    // Locales are deleted automatically via onDelete: Cascade
    return this.prisma.bedtimeStory.delete({
      where: { id },
    });
  }

  // Admin: Get all stories (including drafts)
  async getAllAdmin() {
    return this.prisma.bedtimeStory.findMany({
      include: {
        locales: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Toggle story favorite for user
  async toggleFavorite(userId: string, storyId: string) {
    const existing = await (this.prisma as any).userStoryFavorite.findUnique({
      where: {
        userId_storyId: { userId, storyId },
      },
    });

    if (existing) {
      await (this.prisma as any).userStoryFavorite.delete({
        where: { id: existing.id },
      });
      return { favorited: false };
    }

    await (this.prisma as any).userStoryFavorite.create({
      data: { userId, storyId },
    });
    return { favorited: true };
  }

  // Get user's favorite stories
  async getFavorites(userId: string, locale = 'en') {
    const favorites = await (this.prisma as any).userStoryFavorite.findMany({
      where: { userId },
      include: {
        story: {
          include: {
            locales: {
              where: { locale },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return favorites.map((fav: any) => ({
      ...this.mergeLocale(fav.story, locale),
      favorited: true,
    }));
  }

  // Helper: Merge locale data into story
  private mergeLocale(story: any, _locale: string) {
    const localeData = story.locales?.[0];

    return {
      ...story,
      title: localeData?.title || story.title,
      subtitle: localeData?.subtitle || story.subtitle,
      description: localeData?.description || story.description,
    };
  }

  // Helper: Format category enum to readable name
  private formatCategoryName(category: StoryCategory): string {
    return category
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

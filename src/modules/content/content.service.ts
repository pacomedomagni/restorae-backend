import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentType, ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  // Get all content of a type (for mobile app)
  async getByType(type: ContentType, locale = 'en', userTier = 'FREE') {
    const items = await this.prisma.contentItem.findMany({
      where: {
        type,
        status: ContentStatus.PUBLISHED,
      },
      include: {
        locales: {
          where: { locale },
        },
        audioFile: true,
      },
      orderBy: { order: 'asc' },
    });

    return items.map((item) => {
      const merged = this.mergeLocale(item, locale);
      
      // Scrub premium content for free users
      if (item.isPremium && userTier === 'FREE') {
        if (merged.audioFile) {
          merged.audioFile.url = null; // Scrub URL
        }
        // Add other scrubbing logic here if needed
      }
      
      return merged;
    });
  }

  // Get single content item
  async getBySlug(slug: string, locale = 'en', userTier = 'FREE') {
    const item = await this.prisma.contentItem.findUnique({
      where: { slug },
      include: {
        locales: {
          where: { locale },
        },
        audioFile: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Content not found');
    }

    const merged = this.mergeLocale(item, locale);

    // Scrub premium content for free users
    if (item.isPremium && userTier === 'FREE') {
      if (merged.audioFile) {
        merged.audioFile.url = null;
      }
    }

    return merged;
  }

  // Get breathing patterns
  async getBreathingPatterns(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.BREATHING, locale, userTier);
  }

  // Get grounding techniques
  async getGroundingTechniques(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.GROUNDING, locale, userTier);
  }

  // Get reset exercises
  async getResetExercises(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.RESET, locale, userTier);
  }

  // Get focus sessions
  async getFocusSessions(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.FOCUS, locale, userTier);
  }

  // Get SOS presets
  async getSosPresets(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.SOS, locale, userTier);
  }

  // Get situational guides
  async getSituationalGuides(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.SITUATIONAL, locale, userTier);
  }

  // Get journal prompts
  async getJournalPrompts(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.PROMPT, locale, userTier);
  }

  // Get morning rituals
  async getMorningRituals(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.MORNING_RITUAL, locale, userTier);
  }

  // Get evening rituals
  async getEveningRituals(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.EVENING_RITUAL, locale, userTier);
  }

  // Get ambient sounds
  async getAmbientSounds(locale = 'en', userTier = 'FREE') {
    return this.getByType(ContentType.AMBIENT_SOUND, locale, userTier);
  }

  // Get all free content IDs (for premium gating)
  async getFreeContentIds(): Promise<string[]> {
    const items = await this.prisma.contentItem.findMany({
      where: {
        isPremium: false,
        status: ContentStatus.PUBLISHED,
      },
      select: { slug: true },
    });
    return items.map((i) => i.slug);
  }

  // Merge localized fields
  private mergeLocale(item: any, locale: string) {
    const localeData = item.locales?.[0];
    if (localeData) {
      return {
        ...item,
        name: localeData.name || item.name,
        description: localeData.description || item.description,
        data: { ...item.data, ...localeData.data },
        locales: undefined,
      };
    }
    const { locales, ...rest } = item;
    return rest;
  }
}

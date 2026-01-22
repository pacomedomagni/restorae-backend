import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentType, ContentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  // Get all content of a type (for mobile app)
  async getByType(type: ContentType, locale = 'en', includePremium = false) {
    const items = await this.prisma.contentItem.findMany({
      where: {
        type,
        status: ContentStatus.PUBLISHED,
        ...(includePremium ? {} : {}), // Don't filter, let client handle gating
      },
      include: {
        locales: {
          where: { locale },
        },
        audioFile: true,
      },
      orderBy: { order: 'asc' },
    });

    return items.map((item) => this.mergeLocale(item, locale));
  }

  // Get single content item
  async getBySlug(slug: string, locale = 'en') {
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

    return this.mergeLocale(item, locale);
  }

  // Get breathing patterns
  async getBreathingPatterns(locale = 'en') {
    return this.getByType(ContentType.BREATHING, locale);
  }

  // Get grounding techniques
  async getGroundingTechniques(locale = 'en') {
    return this.getByType(ContentType.GROUNDING, locale);
  }

  // Get reset exercises
  async getResetExercises(locale = 'en') {
    return this.getByType(ContentType.RESET, locale);
  }

  // Get focus sessions
  async getFocusSessions(locale = 'en') {
    return this.getByType(ContentType.FOCUS, locale);
  }

  // Get SOS presets
  async getSosPresets(locale = 'en') {
    return this.getByType(ContentType.SOS, locale);
  }

  // Get situational guides
  async getSituationalGuides(locale = 'en') {
    return this.getByType(ContentType.SITUATIONAL, locale);
  }

  // Get journal prompts
  async getJournalPrompts(locale = 'en') {
    return this.getByType(ContentType.PROMPT, locale);
  }

  // Get morning rituals
  async getMorningRituals(locale = 'en') {
    return this.getByType(ContentType.MORNING_RITUAL, locale);
  }

  // Get evening rituals
  async getEveningRituals(locale = 'en') {
    return this.getByType(ContentType.EVENING_RITUAL, locale);
  }

  // Get ambient sounds
  async getAmbientSounds(locale = 'en') {
    return this.getByType(ContentType.AMBIENT_SOUND, locale);
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

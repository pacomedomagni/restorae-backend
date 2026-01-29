import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { OptionalJwtAuthGuard } from '../../modules/auth/guards/optional-jwt-auth.guard';

@ApiTags('content')
@Controller('content')
@UseGuards(OptionalJwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
  constructor(private contentService: ContentService) {}

  private getUserTier(req: any): string {
    return req.user?.subscription?.tier || 'FREE';
  }

  @Get()
  @ApiOperation({ summary: 'Get content by type (generic endpoint)' })
  @ApiQuery({ name: 'type', required: false, description: 'Content type filter' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'isPremium', required: false })
  getContent(
    @Query('type') type?: string,
    @Query('locale') locale = 'en',
    @Query('isPremium') isPremium?: boolean,
    @Req() req?: any,
  ) {
    return this.contentService.getContent(type, locale, isPremium, this.getUserTier(req));
  }

  @Get('breathing')
  @ApiOperation({ summary: 'Get breathing patterns' })
  @ApiQuery({ name: 'locale', required: false })
  getBreathingPatterns(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getBreathingPatterns(locale, this.getUserTier(req));
  }

  @Get('grounding')
  @ApiOperation({ summary: 'Get grounding techniques' })
  @ApiQuery({ name: 'locale', required: false })
  getGroundingTechniques(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getGroundingTechniques(locale, this.getUserTier(req));
  }

  @Get('reset')
  @ApiOperation({ summary: 'Get reset exercises' })
  @ApiQuery({ name: 'locale', required: false })
  getResetExercises(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getResetExercises(locale, this.getUserTier(req));
  }

  @Get('focus')
  @ApiOperation({ summary: 'Get focus sessions' })
  @ApiQuery({ name: 'locale', required: false })
  getFocusSessions(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getFocusSessions(locale, this.getUserTier(req));
  }

  @Get('sos')
  @ApiOperation({ summary: 'Get SOS presets' })
  @ApiQuery({ name: 'locale', required: false })
  getSosPresets(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getSosPresets(locale, this.getUserTier(req));
  }

  @Get('situational')
  @ApiOperation({ summary: 'Get situational guides' })
  @ApiQuery({ name: 'locale', required: false })
  getSituationalGuides(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getSituationalGuides(locale, this.getUserTier(req));
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Get journal prompts' })
  @ApiQuery({ name: 'locale', required: false })
  getJournalPrompts(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getJournalPrompts(locale, this.getUserTier(req));
  }

  @Get('rituals/morning')
  @ApiOperation({ summary: 'Get morning rituals' })
  @ApiQuery({ name: 'locale', required: false })
  getMorningRituals(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getMorningRituals(locale, this.getUserTier(req));
  }

  @Get('rituals/evening')
  @ApiOperation({ summary: 'Get evening rituals' })
  @ApiQuery({ name: 'locale', required: false })
  getEveningRituals(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getEveningRituals(locale, this.getUserTier(req));
  }

  @Get('sounds')
  @ApiOperation({ summary: 'Get ambient sounds' })
  @ApiQuery({ name: 'locale', required: false })
  getAmbientSounds(@Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getAmbientSounds(locale, this.getUserTier(req));
  }

  @Get('free-ids')
  @ApiOperation({ summary: 'Get free content IDs for gating' })
  getFreeContentIds() {
    return this.contentService.getFreeContentIds();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get content by slug' })
  @ApiQuery({ name: 'locale', required: false })
  getBySlug(@Param('slug') slug: string, @Query('locale') locale = 'en', @Req() req: any) {
    return this.contentService.getBySlug(slug, locale, this.getUserTier(req));
  }
}

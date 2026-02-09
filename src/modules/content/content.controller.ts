import { Controller, Get, Param, Query, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { OptionalJwtAuthGuard } from '../../modules/auth/guards/optional-jwt-auth.guard';
import { OptionalAuthRequest } from '../../common/types/user-payload.interface';

@ApiTags('content')
@Controller('content')
@UseGuards(OptionalJwtAuthGuard)
@UseInterceptors(CacheInterceptor)
@CacheTTL(300) // 5 minutes
@ApiBearerAuth()
export class ContentController {
  constructor(private contentService: ContentService) {}

  private getUserTier(req: OptionalAuthRequest): string {
    return req.user?.subscription?.tier || 'FREE';
  }

  @Get()
  @ApiOperation({ summary: 'Get content by type (generic endpoint)' })
  @ApiResponse({ status: 200, description: 'Content retrieved' })
  @ApiQuery({ name: 'type', required: false, description: 'Content type filter' })
  @ApiQuery({ name: 'locale', required: false })
  @ApiQuery({ name: 'isPremium', required: false })
  getContent(
    @Req() req: OptionalAuthRequest,
    @Query('type') type?: string,
    @Query('locale') locale = 'en',
    @Query('isPremium') isPremium?: boolean,
  ) {
    return this.contentService.getContent(type, locale, isPremium, this.getUserTier(req));
  }

  @Get('breathing')
  @ApiOperation({ summary: 'Get breathing patterns' })
  @ApiResponse({ status: 200, description: 'Patterns retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getBreathingPatterns(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getBreathingPatterns(locale, this.getUserTier(req));
  }

  @Get('grounding')
  @ApiOperation({ summary: 'Get grounding techniques' })
  @ApiResponse({ status: 200, description: 'Techniques retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getGroundingTechniques(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getGroundingTechniques(locale, this.getUserTier(req));
  }

  @Get('reset')
  @ApiOperation({ summary: 'Get reset exercises' })
  @ApiResponse({ status: 200, description: 'Exercises retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getResetExercises(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getResetExercises(locale, this.getUserTier(req));
  }

  @Get('focus')
  @ApiOperation({ summary: 'Get focus sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getFocusSessions(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getFocusSessions(locale, this.getUserTier(req));
  }

  @Get('sos')
  @ApiOperation({ summary: 'Get SOS presets' })
  @ApiResponse({ status: 200, description: 'Presets retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getSosPresets(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getSosPresets(locale, this.getUserTier(req));
  }

  @Get('situational')
  @ApiOperation({ summary: 'Get situational guides' })
  @ApiResponse({ status: 200, description: 'Guides retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getSituationalGuides(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getSituationalGuides(locale, this.getUserTier(req));
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Get journal prompts' })
  @ApiResponse({ status: 200, description: 'Prompts retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getJournalPrompts(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getJournalPrompts(locale, this.getUserTier(req));
  }

  @Get('rituals/morning')
  @ApiOperation({ summary: 'Get morning rituals' })
  @ApiResponse({ status: 200, description: 'Rituals retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getMorningRituals(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getMorningRituals(locale, this.getUserTier(req));
  }

  @Get('rituals/evening')
  @ApiOperation({ summary: 'Get evening rituals' })
  @ApiResponse({ status: 200, description: 'Rituals retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getEveningRituals(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getEveningRituals(locale, this.getUserTier(req));
  }

  @Get('sounds')
  @ApiOperation({ summary: 'Get ambient sounds' })
  @ApiResponse({ status: 200, description: 'Sounds retrieved' })
  @ApiQuery({ name: 'locale', required: false })
  getAmbientSounds(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getAmbientSounds(locale, this.getUserTier(req));
  }

  @Get('free-ids')
  @ApiOperation({ summary: 'Get free content IDs for gating' })
  @ApiResponse({ status: 200, description: 'Free IDs retrieved' })
  getFreeContentIds() {
    return this.contentService.getFreeContentIds();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get content by slug' })
  @ApiResponse({ status: 200, description: 'Content retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiQuery({ name: 'locale', required: false })
  getBySlug(@Param('slug') slug: string, @Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.contentService.getBySlug(slug, locale, this.getUserTier(req));
  }
}

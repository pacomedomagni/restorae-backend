import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private contentService: ContentService) {}

  @Get('breathing')
  @ApiOperation({ summary: 'Get breathing patterns' })
  @ApiQuery({ name: 'locale', required: false })
  getBreathingPatterns(@Query('locale') locale = 'en') {
    return this.contentService.getBreathingPatterns(locale);
  }

  @Get('grounding')
  @ApiOperation({ summary: 'Get grounding techniques' })
  @ApiQuery({ name: 'locale', required: false })
  getGroundingTechniques(@Query('locale') locale = 'en') {
    return this.contentService.getGroundingTechniques(locale);
  }

  @Get('reset')
  @ApiOperation({ summary: 'Get reset exercises' })
  @ApiQuery({ name: 'locale', required: false })
  getResetExercises(@Query('locale') locale = 'en') {
    return this.contentService.getResetExercises(locale);
  }

  @Get('focus')
  @ApiOperation({ summary: 'Get focus sessions' })
  @ApiQuery({ name: 'locale', required: false })
  getFocusSessions(@Query('locale') locale = 'en') {
    return this.contentService.getFocusSessions(locale);
  }

  @Get('sos')
  @ApiOperation({ summary: 'Get SOS presets' })
  @ApiQuery({ name: 'locale', required: false })
  getSosPresets(@Query('locale') locale = 'en') {
    return this.contentService.getSosPresets(locale);
  }

  @Get('situational')
  @ApiOperation({ summary: 'Get situational guides' })
  @ApiQuery({ name: 'locale', required: false })
  getSituationalGuides(@Query('locale') locale = 'en') {
    return this.contentService.getSituationalGuides(locale);
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Get journal prompts' })
  @ApiQuery({ name: 'locale', required: false })
  getJournalPrompts(@Query('locale') locale = 'en') {
    return this.contentService.getJournalPrompts(locale);
  }

  @Get('rituals/morning')
  @ApiOperation({ summary: 'Get morning rituals' })
  @ApiQuery({ name: 'locale', required: false })
  getMorningRituals(@Query('locale') locale = 'en') {
    return this.contentService.getMorningRituals(locale);
  }

  @Get('rituals/evening')
  @ApiOperation({ summary: 'Get evening rituals' })
  @ApiQuery({ name: 'locale', required: false })
  getEveningRituals(@Query('locale') locale = 'en') {
    return this.contentService.getEveningRituals(locale);
  }

  @Get('sounds')
  @ApiOperation({ summary: 'Get ambient sounds' })
  @ApiQuery({ name: 'locale', required: false })
  getAmbientSounds(@Query('locale') locale = 'en') {
    return this.contentService.getAmbientSounds(locale);
  }

  @Get('free-ids')
  @ApiOperation({ summary: 'Get free content IDs for gating' })
  getFreeContentIds() {
    return this.contentService.getFreeContentIds();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get content by slug' })
  @ApiQuery({ name: 'locale', required: false })
  getBySlug(@Param('slug') slug: string, @Query('locale') locale = 'en') {
    return this.contentService.getBySlug(slug, locale);
  }
}

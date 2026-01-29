import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { StoryMood, StoryCategory } from '@prisma/client';
import { StoriesService } from './stories.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStoryDto, UpdateStoryDto } from './dto/story.dto';

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  private getUserTier(req: any): string {
    return req.user?.subscription?.tier || 'FREE';
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bedtime stories' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  getAll(@Query('locale') locale = 'en', @Req() req: any) {
    return this.storiesService.getAll(locale, this.getUserTier(req));
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all story categories' })
  getCategories() {
    return this.storiesService.getCategories();
  }

  @Get('category/:category')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stories by category' })
  @ApiParam({ name: 'category', enum: StoryCategory })
  @ApiQuery({ name: 'locale', required: false })
  getByCategory(
    @Param('category') category: StoryCategory,
    @Query('locale') locale = 'en',
    @Req() req: any,
  ) {
    return this.storiesService.getByCategory(category, locale, this.getUserTier(req));
  }

  @Get('mood/:mood')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stories by mood' })
  @ApiParam({ name: 'mood', enum: StoryMood })
  @ApiQuery({ name: 'locale', required: false })
  getByMood(
    @Param('mood') mood: StoryMood,
    @Query('locale') locale = 'en',
    @Req() req: any,
  ) {
    return this.storiesService.getByMood(mood, locale, this.getUserTier(req));
  }

  @Get('free-ids')
  @ApiOperation({ summary: 'Get free story IDs for premium gating' })
  getFreeStoryIds() {
    return this.storiesService.getFreeStoryIds();
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get story by slug' })
  @ApiParam({ name: 'slug', example: 'moonlit-meadow' })
  @ApiQuery({ name: 'locale', required: false })
  getBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
    @Req() req: any,
  ) {
    return this.storiesService.getBySlug(slug, locale, this.getUserTier(req));
  }

  // ==================== AUTH REQUIRED ENDPOINTS ====================

  @Post(':id/play')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track story play' })
  trackPlay(@Param('id') id: string, @Req() req: any) {
    return this.storiesService.trackPlay(id, req.user?.id);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle story favorite' })
  toggleFavorite(@CurrentUser() user: any, @Param('id') id: string) {
    return this.storiesService.toggleFavorite(user.id, id);
  }

  @Get('user/favorites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user\'s favorite stories' })
  @ApiQuery({ name: 'locale', required: false })
  getFavorites(
    @CurrentUser() user: any,
    @Query('locale') locale = 'en',
  ) {
    return this.storiesService.getFavorites(user.id, locale);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all stories including drafts' })
  getAllAdmin() {
    return this.storiesService.getAllAdmin();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new story' })
  create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update story' })
  update(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete story' })
  delete(@Param('id') id: string) {
    return this.storiesService.delete(id);
  }
}

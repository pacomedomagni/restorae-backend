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
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { StoryMood, StoryCategory } from '@prisma/client';
import { StoriesService } from './stories.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateStoryDto, UpdateStoryDto } from './dto/story.dto';
import { UserPayload, OptionalAuthRequest } from '../../common/types/user-payload.interface';

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  private getUserTier(req: OptionalAuthRequest): string {
    return req.user?.subscription?.tier || 'FREE';
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bedtime stories' })
  @ApiResponse({ status: 200, description: 'Stories returned' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  getAll(@Query('locale') locale = 'en', @Req() req: OptionalAuthRequest) {
    return this.storiesService.getAll(locale, this.getUserTier(req));
  }

  @Get('categories')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800) // 30 minutes
  @ApiOperation({ summary: 'Get all story categories' })
  @ApiResponse({ status: 200, description: 'Categories returned' })
  getCategories() {
    return this.storiesService.getCategories();
  }

  @Get('category/:category')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stories by category' })
  @ApiResponse({ status: 200, description: 'Stories returned' })
  @ApiParam({ name: 'category', enum: StoryCategory })
  @ApiQuery({ name: 'locale', required: false })
  getByCategory(
    @Param('category') category: StoryCategory,
    @Query('locale') locale = 'en',
    @Req() req: OptionalAuthRequest,
  ) {
    return this.storiesService.getByCategory(category, locale, this.getUserTier(req));
  }

  @Get('mood/:mood')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get stories by mood' })
  @ApiResponse({ status: 200, description: 'Stories returned' })
  @ApiParam({ name: 'mood', enum: StoryMood })
  @ApiQuery({ name: 'locale', required: false })
  getByMood(
    @Param('mood') mood: StoryMood,
    @Query('locale') locale = 'en',
    @Req() req: OptionalAuthRequest,
  ) {
    return this.storiesService.getByMood(mood, locale, this.getUserTier(req));
  }

  @Get('free-ids')
  @ApiOperation({ summary: 'Get free story IDs for premium gating' })
  @ApiResponse({ status: 200, description: 'Free IDs returned' })
  getFreeStoryIds() {
    return this.storiesService.getFreeStoryIds();
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get story by slug' })
  @ApiResponse({ status: 200, description: 'Story returned' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'slug', example: 'moonlit-meadow' })
  @ApiQuery({ name: 'locale', required: false })
  getBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale = 'en',
    @Req() req: OptionalAuthRequest,
  ) {
    return this.storiesService.getBySlug(slug, locale, this.getUserTier(req));
  }

  // ==================== AUTH REQUIRED ENDPOINTS ====================

  @Post(':id/play')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track story play' })
  @ApiResponse({ status: 201, description: 'Play tracked' })
  @ApiResponse({ status: 404, description: 'Not found' })
  trackPlay(@Param('id') id: string, @Req() req: OptionalAuthRequest) {
    return this.storiesService.trackPlay(id, req.user?.id);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle story favorite' })
  @ApiResponse({ status: 201, description: 'Favorite toggled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  toggleFavorite(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.storiesService.toggleFavorite(user.id, id);
  }

  @Get('user/favorites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user\'s favorite stories' })
  @ApiResponse({ status: 200, description: 'Favorites returned' })
  @ApiQuery({ name: 'locale', required: false })
  getFavorites(
    @CurrentUser() user: UserPayload,
    @Query('locale') locale = 'en',
  ) {
    return this.storiesService.getFavorites(user.id, locale);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all stories including drafts' })
  @ApiResponse({ status: 200, description: 'All stories returned' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getAllAdmin() {
    return this.storiesService.getAllAdmin();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new story' })
  @ApiResponse({ status: 201, description: 'Story created' })
  create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update story' })
  @ApiResponse({ status: 200, description: 'Story updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Param('id') id: string, @Body() dto: UpdateStoryDto) {
    return this.storiesService.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete story' })
  @ApiResponse({ status: 200, description: 'Story deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  delete(@Param('id') id: string) {
    return this.storiesService.delete(id);
  }
}

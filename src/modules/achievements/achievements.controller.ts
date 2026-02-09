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
import { AchievementCategory } from '@prisma/client';
import { AchievementsService } from './achievements.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateAchievementDto, UpdateAchievementDto } from './dto/achievement.dto';
import { TrackSessionDto, UpdateProgressDto } from './dto/track-session.dto';
import { AuthenticatedRequest, OptionalAuthRequest } from '../../common/types/user-payload.interface';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private achievementsService: AchievementsService) {}

  // ==================== PUBLIC/USER ENDPOINTS ====================

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all achievements with unlock status' })
  @ApiResponse({ status: 200, description: 'Achievements retrieved' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  getAll(@Req() req: OptionalAuthRequest, @Query('locale') locale = 'en') {
    return this.achievementsService.getAll(req.user?.id, locale);
  }

  @Get('category/:category')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get achievements by category' })
  @ApiResponse({ status: 200, description: 'Achievements retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'category', enum: AchievementCategory })
  getByCategory(@Param('category') category: AchievementCategory, @Req() req: OptionalAuthRequest) {
    return this.achievementsService.getByCategory(category, req.user?.id);
  }

  @Get('user/unlocked')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user unlocked achievements' })
  @ApiResponse({ status: 200, description: 'Achievements retrieved' })
  getUserAchievements(@Req() req: AuthenticatedRequest) {
    return this.achievementsService.getUserAchievements(req.user.id);
  }

  @Get('user/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user progress including level and XP' })
  @ApiResponse({ status: 200, description: 'Progress retrieved' })
  getUserProgress(@Req() req: AuthenticatedRequest) {
    return this.achievementsService.getUserProgress(req.user.id);
  }

  @Get('user/level')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user level and XP' })
  @ApiResponse({ status: 200, description: 'Level retrieved' })
  getUserLevel(@Req() req: AuthenticatedRequest) {
    return this.achievementsService.getUserLevel(req.user.id);
  }

  @Get('leaderboard')
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get achievements leaderboard' })
  @ApiResponse({ status: 200, description: 'Leaderboard retrieved' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getLeaderboard(@Query('limit') limit = 10) {
    return this.achievementsService.getLeaderboard(Number(limit));
  }

  // ==================== GAMIFICATION TRIGGERS ====================

  @Post('track/streak')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user streak (call daily)' })
  @ApiResponse({ status: 201, description: 'Streak updated' })
  updateStreak(@Req() req: AuthenticatedRequest) {
    return this.achievementsService.updateStreak(req.user.id);
  }

  @Post('track/session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track session completion for achievements' })
  @ApiResponse({ status: 201, description: 'Session tracked' })
  trackSessionComplete(
    @Req() req: AuthenticatedRequest,
    @Body() data: TrackSessionDto,
  ) {
    return this.achievementsService.trackSessionComplete(
      req.user.id,
      data.durationMinutes,
      data.sessionType,
    );
  }

  @Post('unlock/:slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually unlock an achievement by slug' })
  @ApiResponse({ status: 201, description: 'Achievement unlocked' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'slug', example: 'first-breath' })
  unlockAchievement(@Param('slug') slug: string, @Req() req: AuthenticatedRequest) {
    return this.achievementsService.unlockBySlug(req.user.id, slug);
  }

  @Post('progress/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update achievement progress' })
  @ApiResponse({ status: 201, description: 'Progress updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'key', example: 'first-breath' })
  updateProgress(
    @Param('key') key: string,
    @Body() data: UpdateProgressDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.achievementsService.updateProgress(req.user.id, key, data.progress);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all achievements' })
  @ApiResponse({ status: 200, description: 'Achievements retrieved' })
  getAllAdmin() {
    return this.achievementsService.getAllAdmin();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get achievement by ID' })
  @ApiResponse({ status: 200, description: 'Achievement retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getById(@Param('id') id: string) {
    return this.achievementsService.getById(id);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new achievement' })
  @ApiResponse({ status: 201, description: 'Achievement created' })
  create(@Body() dto: CreateAchievementDto) {
    return this.achievementsService.create(dto);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update achievement' })
  @ApiResponse({ status: 200, description: 'Achievement updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Param('id') id: string, @Body() dto: UpdateAchievementDto) {
    return this.achievementsService.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete achievement' })
  @ApiResponse({ status: 200, description: 'Achievement deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  delete(@Param('id') id: string) {
    return this.achievementsService.delete(id);
  }
}

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
import { AchievementCategory } from '@prisma/client';
import { AchievementsService } from './achievements.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateAchievementDto, UpdateAchievementDto } from './dto/achievement.dto';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
  constructor(private achievementsService: AchievementsService) {}

  // ==================== PUBLIC/USER ENDPOINTS ====================

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all achievements with unlock status' })
  @ApiQuery({ name: 'locale', required: false, example: 'en' })
  getAll(@Req() req: any, @Query('locale') locale = 'en') {
    return this.achievementsService.getAll(req.user?.id, locale);
  }

  @Get('category/:category')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get achievements by category' })
  @ApiParam({ name: 'category', enum: AchievementCategory })
  getByCategory(@Param('category') category: AchievementCategory, @Req() req: any) {
    return this.achievementsService.getByCategory(category, req.user?.id);
  }

  @Get('user/unlocked')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user unlocked achievements' })
  getUserAchievements(@Req() req: any) {
    return this.achievementsService.getUserAchievements(req.user.id);
  }

  @Get('user/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user progress including level and XP' })
  getUserProgress(@Req() req: any) {
    return this.achievementsService.getUserProgress(req.user.id);
  }

  @Get('user/level')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user level and XP' })
  getUserLevel(@Req() req: any) {
    return this.achievementsService.getUserLevel(req.user.id);
  }

  @Get('leaderboard')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get achievements leaderboard' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getLeaderboard(@Query('limit') limit = 10) {
    return this.achievementsService.getLeaderboard(Number(limit));
  }

  // ==================== GAMIFICATION TRIGGERS ====================

  @Post('track/streak')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user streak (call daily)' })
  updateStreak(@Req() req: any) {
    return this.achievementsService.updateStreak(req.user.id);
  }

  @Post('track/session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track session completion for achievements' })
  trackSessionComplete(
    @Req() req: any,
    @Body() data: { durationMinutes: number; sessionType: string },
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
  @ApiParam({ name: 'slug', example: 'first-breath' })
  unlockAchievement(@Param('slug') slug: string, @Req() req: any) {
    return this.achievementsService.unlockBySlug(req.user.id, slug);
  }

  @Post('progress/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update achievement progress' })
  @ApiParam({ name: 'key', example: 'first-breath' })
  updateProgress(
    @Param('key') key: string,
    @Body() data: { progress: number },
    @Req() req: any,
  ) {
    return this.achievementsService.updateProgress(req.user.id, key, data.progress);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all achievements' })
  getAllAdmin() {
    return this.achievementsService.getAllAdmin();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get achievement by ID' })
  getById(@Param('id') id: string) {
    return this.achievementsService.getById(id);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create new achievement' })
  create(@Body() dto: CreateAchievementDto) {
    return this.achievementsService.create(dto);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update achievement' })
  update(@Param('id') id: string, @Body() dto: UpdateAchievementDto) {
    return this.achievementsService.update(id, dto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete achievement' })
  delete(@Param('id') id: string) {
    return this.achievementsService.delete(id);
  }
}

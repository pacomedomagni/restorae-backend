import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CoachMarksService } from './coach-marks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuthenticatedRequest } from '../../common/types/user-payload.interface';
import { CreateCoachMarkDto, UpdateCoachMarkDto } from './dto/coach-mark.dto';

@ApiTags('coach-marks')
@Controller('coach-marks')
export class CoachMarksController {
  constructor(private coachMarksService: CoachMarksService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800)
  @ApiOperation({ summary: 'Get all active coach marks' })
  @ApiResponse({ status: 200, description: 'Coach marks retrieved' })
  getAll() {
    return this.coachMarksService.getAll();
  }

  @Get('screen/:screen')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800)
  @ApiOperation({ summary: 'Get coach marks for a specific screen' })
  @ApiResponse({ status: 200, description: 'Coach marks retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'screen', example: 'HomeScreen' })
  getByScreen(@Param('screen') screen: string) {
    return this.coachMarksService.getByScreen(screen);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get a coach mark by key' })
  @ApiResponse({ status: 200, description: 'Coach mark retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'key', example: 'home-for-you' })
  getByKey(@Param('key') key: string) {
    return this.coachMarksService.getByKey(key);
  }

  // ==================== USER ENDPOINTS ====================

  @Get('user/seen')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coach marks the user has seen' })
  @ApiResponse({ status: 200, description: 'Seen marks retrieved' })
  getSeenCoachMarks(@Req() req: AuthenticatedRequest) {
    return this.coachMarksService.getSeenCoachMarks(req.user.id);
  }

  @Post('user/seen/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a coach mark as seen by user' })
  @ApiResponse({ status: 201, description: 'Marked as seen' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiParam({ name: 'key', example: 'home-for-you' })
  markAsSeen(@Param('key') key: string, @Req() req: AuthenticatedRequest) {
    return this.coachMarksService.markAsSeen(req.user.id, key);
  }

  @Post('user/reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset all seen coach marks for user (re-onboarding)' })
  @ApiResponse({ status: 201, description: 'Seen marks reset' })
  resetSeenCoachMarks(@Req() req: AuthenticatedRequest) {
    return this.coachMarksService.resetSeenCoachMarks(req.user.id);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all coach marks' })
  @ApiResponse({ status: 200, description: 'Coach marks retrieved' })
  getAllAdmin() {
    return this.coachMarksService.getAllAdmin();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create coach mark' })
  @ApiResponse({ status: 201, description: 'Coach mark created' })
  create(
    @Body() data: CreateCoachMarkDto,
  ) {
    return this.coachMarksService.create(data);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update coach mark' })
  @ApiResponse({ status: 200, description: 'Coach mark updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @Param('id') id: string,
    @Body() data: UpdateCoachMarkDto,
  ) {
    return this.coachMarksService.update(id, data);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete coach mark' })
  @ApiResponse({ status: 200, description: 'Coach mark deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  delete(@Param('id') id: string) {
    return this.coachMarksService.delete(id);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CoachMarksService } from './coach-marks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('coach-marks')
@Controller('coach-marks')
export class CoachMarksController {
  constructor(private coachMarksService: CoachMarksService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get()
  @ApiOperation({ summary: 'Get all active coach marks' })
  getAll() {
    return this.coachMarksService.getAll();
  }

  @Get('screen/:screen')
  @ApiOperation({ summary: 'Get coach marks for a specific screen' })
  @ApiParam({ name: 'screen', example: 'HomeScreen' })
  getByScreen(@Param('screen') screen: string) {
    return this.coachMarksService.getByScreen(screen);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Get a coach mark by key' })
  @ApiParam({ name: 'key', example: 'home-for-you' })
  getByKey(@Param('key') key: string) {
    return this.coachMarksService.getByKey(key);
  }

  // ==================== USER ENDPOINTS ====================

  @Get('user/seen')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coach marks the user has seen' })
  getSeenCoachMarks(@Req() req: any) {
    return this.coachMarksService.getSeenCoachMarks(req.user.id);
  }

  @Post('user/seen/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a coach mark as seen by user' })
  @ApiParam({ name: 'key', example: 'home-for-you' })
  markAsSeen(@Param('key') key: string, @Req() req: any) {
    return this.coachMarksService.markAsSeen(req.user.id, key);
  }

  @Post('user/reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset all seen coach marks for user (re-onboarding)' })
  resetSeenCoachMarks(@Req() req: any) {
    return this.coachMarksService.resetSeenCoachMarks(req.user.id);
  }

  // ==================== ADMIN ENDPOINTS ====================

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get all coach marks' })
  getAllAdmin() {
    return this.coachMarksService.getAllAdmin();
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Create coach mark' })
  create(
    @Body()
    data: {
      key: string;
      screen: string;
      targetId: string;
      title: string;
      description: string;
      position?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.coachMarksService.create(data);
  }

  @Put('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update coach mark' })
  update(
    @Param('id') id: string,
    @Body()
    data: Partial<{
      key: string;
      screen: string;
      targetId: string;
      title: string;
      description: string;
      position: string;
      order: number;
      isActive: boolean;
    }>,
  ) {
    return this.coachMarksService.update(id, data);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete coach mark' })
  delete(@Param('id') id: string) {
    return this.coachMarksService.delete(id);
  }
}

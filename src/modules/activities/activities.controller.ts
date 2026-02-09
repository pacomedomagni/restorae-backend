import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateActivityLogDto, CreateActivityLogBatchDto } from './dto/create-activity-log.dto';
import { UserPayload } from '../../common/types/user-payload.interface';

@ApiTags('activities')
@Controller('activities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @Post('log')
  @ApiOperation({ summary: 'Log a completed activity' })
  @ApiResponse({ status: 201, description: 'Activity logged' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  logActivity(@CurrentUser() user: UserPayload, @Body() dto: CreateActivityLogDto) {
    return this.activitiesService.logActivity(user.id, dto);
  }

  @Post('log/batch')
  @ApiOperation({ summary: 'Log multiple activities in batch' })
  @ApiResponse({ status: 201, description: 'Batch logged' })
  logActivitiesBatch(@CurrentUser() user: UserPayload, @Body() dto: CreateActivityLogBatchDto) {
    return this.activitiesService.logActivitiesBatch(user.id, dto.activities);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get activity statistics' })
  @ApiResponse({ status: 200, description: 'Activity statistics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getStats(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.activitiesService.getStats(user.id, startDate, endDate);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get activity history' })
  @ApiResponse({ status: 200, description: 'Paginated history' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getHistory(
    @CurrentUser() user: UserPayload,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.activitiesService.getHistory(user.id, {
      category,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      startDate,
      endDate,
    });
  }
}

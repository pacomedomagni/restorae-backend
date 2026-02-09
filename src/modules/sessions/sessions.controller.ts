import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSessionDto, SessionMode } from './dto/create-session.dto';
import { UpdateSessionDto, UpdateActivityDto, SessionStatus } from './dto/update-session.dto';
import { UserPayload } from '../../common/types/user-payload.interface';

@ApiTags('sessions')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new session' })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@CurrentUser() user: UserPayload, @Body() dto: CreateSessionDto) {
    return this.sessionsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get session history' })
  @ApiResponse({ status: 200, description: 'Session history returned' })
  @ApiQuery({ name: 'mode', required: false, enum: SessionMode })
  @ApiQuery({ name: 'status', required: false, enum: SessionStatus })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('mode') mode?: SessionMode,
    @Query('status') status?: SessionStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.sessionsService.findAll(user.id, {
      mode,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      startDate,
      endDate,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get session statistics' })
  @ApiResponse({ status: 200, description: 'Statistics returned' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getStats(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.sessionsService.getStats(user.id, startDate, endDate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session by ID' })
  @ApiResponse({ status: 200, description: 'Session returned' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.sessionsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update session status' })
  @ApiResponse({ status: 200, description: 'Session updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(user.id, id, dto);
  }

  @Patch(':sessionId/activities/:activityId')
  @ApiOperation({ summary: 'Update an activity within a session' })
  @ApiResponse({ status: 200, description: 'Activity updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateActivity(
    @CurrentUser() user: UserPayload,
    @Param('sessionId') sessionId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.sessionsService.updateActivity(user.id, sessionId, activityId, dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MoodService } from './mood.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMoodEntryDto } from './dto/create-mood-entry.dto';
import { UpdateMoodEntryDto } from './dto/update-mood-entry.dto';
import { UserPayload } from '../../common/types/user-payload.interface';
import {
  MoodEntryResponseDto,
  MoodStatsResponseDto,
  WeeklyGoalResponseDto,
} from '../../common/dto/responses.dto';

@ApiTags('mood')
@Controller('mood')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MoodController {
  constructor(private moodService: MoodService) {}

  @Post()
  @ApiOperation({ summary: 'Create mood entry' })
  @ApiResponse({ status: 201, description: 'Mood entry created', type: MoodEntryResponseDto })
  create(@CurrentUser() user: UserPayload, @Body() dto: CreateMoodEntryDto) {
    return this.moodService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all mood entries' })
  @ApiResponse({ status: 200, description: 'Mood entries', type: [MoodEntryResponseDto] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    return this.moodService.findAll(user.id, limit, offset);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get mood statistics' })
  @ApiResponse({ status: 200, description: 'Mood statistics', type: MoodStatsResponseDto })
  getStats(@CurrentUser() user: UserPayload) {
    return this.moodService.getStats(user.id);
  }

  @Get('goal')
  @ApiOperation({ summary: 'Get weekly goal' })
  @ApiResponse({ status: 200, description: 'Weekly goal', type: WeeklyGoalResponseDto })
  getWeeklyGoal(@CurrentUser() user: UserPayload) {
    return this.moodService.getWeeklyGoal(user.id);
  }

  @Patch('goal')
  @ApiOperation({ summary: 'Set weekly goal target' })
  @ApiResponse({ status: 200, description: 'Goal updated', type: WeeklyGoalResponseDto })
  setWeeklyGoalTarget(
    @CurrentUser() user: UserPayload,
    @Body('targetDays') targetDays: number,
  ) {
    return this.moodService.setWeeklyGoalTarget(user.id, targetDays);
  }

  @Get('range')
  @ApiOperation({ summary: 'Get entries by date range' })
  @ApiResponse({ status: 200, description: 'Mood entries in range', type: [MoodEntryResponseDto] })
  @ApiQuery({ name: 'start', required: true })
  @ApiQuery({ name: 'end', required: true })
  findByRange(
    @CurrentUser() user: UserPayload,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.moodService.findByDateRange(user.id, new Date(start), new Date(end));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mood entry by ID' })
  @ApiResponse({ status: 200, description: 'Mood entry', type: MoodEntryResponseDto })
  @ApiResponse({ status: 404, description: 'Mood entry not found' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.moodService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mood entry' })
  @ApiResponse({ status: 200, description: 'Mood entry updated', type: MoodEntryResponseDto })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMoodEntryDto,
  ) {
    return this.moodService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete mood entry' })
  @ApiResponse({ status: 200, description: 'Mood entry deleted' })
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.moodService.delete(user.id, id);
  }
}

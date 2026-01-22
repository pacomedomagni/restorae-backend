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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MoodService } from './mood.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMoodEntryDto } from './dto/create-mood-entry.dto';
import { UpdateMoodEntryDto } from './dto/update-mood-entry.dto';

@ApiTags('mood')
@Controller('mood')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MoodController {
  constructor(private moodService: MoodService) {}

  @Post()
  @ApiOperation({ summary: 'Create mood entry' })
  create(@CurrentUser() user: any, @Body() dto: CreateMoodEntryDto) {
    return this.moodService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all mood entries' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    return this.moodService.findAll(user.id, limit, offset);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get mood statistics' })
  getStats(@CurrentUser() user: any) {
    return this.moodService.getStats(user.id);
  }

  @Get('goal')
  @ApiOperation({ summary: 'Get weekly goal' })
  getWeeklyGoal(@CurrentUser() user: any) {
    return this.moodService.getWeeklyGoal(user.id);
  }

  @Patch('goal')
  @ApiOperation({ summary: 'Set weekly goal target' })
  setWeeklyGoalTarget(
    @CurrentUser() user: any,
    @Body('targetDays') targetDays: number,
  ) {
    return this.moodService.setWeeklyGoalTarget(user.id, targetDays);
  }

  @Get('range')
  @ApiOperation({ summary: 'Get entries by date range' })
  @ApiQuery({ name: 'start', required: true })
  @ApiQuery({ name: 'end', required: true })
  findByRange(
    @CurrentUser() user: any,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.moodService.findByDateRange(user.id, new Date(start), new Date(end));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mood entry by ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.moodService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mood entry' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateMoodEntryDto,
  ) {
    return this.moodService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete mood entry' })
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.moodService.delete(user.id, id);
  }
}

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
import { RitualsService } from './rituals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRitualDto } from './dto/create-ritual.dto';
import { UpdateRitualDto } from './dto/update-ritual.dto';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { UserPayload } from '../../common/types/user-payload.interface';

@ApiTags('rituals')
@Controller('rituals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RitualsController {
  constructor(private ritualsService: RitualsService) {}

  @Post()
  @ApiOperation({ summary: 'Create custom ritual' })
  @ApiResponse({ status: 201, description: 'Ritual created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@CurrentUser() user: UserPayload, @Body() dto: CreateRitualDto) {
    return this.ritualsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all rituals' })
  @ApiResponse({ status: 200, description: 'Rituals returned' })
  @ApiQuery({ name: 'includeArchived', required: false })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('includeArchived') includeArchived = false,
  ) {
    return this.ritualsService.findAll(user.id, includeArchived);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today\'s rituals' })
  @ApiResponse({ status: 200, description: 'Today rituals returned' })
  getTodayRituals(@CurrentUser() user: UserPayload) {
    return this.ritualsService.getTodayRituals(user.id);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get favorite rituals' })
  @ApiResponse({ status: 200, description: 'Favorites returned' })
  getFavorites(@CurrentUser() user: UserPayload) {
    return this.ritualsService.getFavorites(user.id);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Get completion streak' })
  @ApiResponse({ status: 200, description: 'Streak returned' })
  getStreak(@CurrentUser() user: UserPayload) {
    return this.ritualsService.getStreak(user.id);
  }

  @Get('weekly-rate')
  @ApiOperation({ summary: 'Get weekly completion rate' })
  @ApiResponse({ status: 200, description: 'Weekly rate returned' })
  getWeeklyRate(@CurrentUser() user: UserPayload) {
    return this.ritualsService.getWeeklyCompletionRate(user.id);
  }

  @Get('completions')
  @ApiOperation({ summary: 'Get completions' })
  @ApiResponse({ status: 200, description: 'Completions returned' })
  @ApiQuery({ name: 'ritualId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getCompletions(
    @CurrentUser() user: UserPayload,
    @Query('ritualId') ritualId?: string,
    @Query('limit') limit = 30,
  ) {
    return this.ritualsService.getCompletions(user.id, ritualId, limit);
  }

  @Post('completions')
  @ApiOperation({ summary: 'Record completion' })
  @ApiResponse({ status: 201, description: 'Completion recorded' })
  recordCompletion(@CurrentUser() user: UserPayload, @Body() dto: CreateCompletionDto) {
    return this.ritualsService.recordCompletion(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ritual by ID' })
  @ApiResponse({ status: 200, description: 'Ritual returned' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.ritualsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ritual' })
  @ApiResponse({ status: 200, description: 'Ritual updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRitualDto,
  ) {
    return this.ritualsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ritual' })
  @ApiResponse({ status: 200, description: 'Ritual deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.ritualsService.delete(user.id, id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive ritual' })
  @ApiResponse({ status: 201, description: 'Ritual archived' })
  @ApiResponse({ status: 404, description: 'Not found' })
  archive(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.ritualsService.archive(user.id, id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive ritual' })
  @ApiResponse({ status: 201, description: 'Ritual unarchived' })
  @ApiResponse({ status: 404, description: 'Not found' })
  unarchive(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.ritualsService.unarchive(user.id, id);
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Toggle favorite' })
  @ApiResponse({ status: 201, description: 'Favorite toggled' })
  @ApiResponse({ status: 404, description: 'Not found' })
  toggleFavorite(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.ritualsService.toggleFavorite(user.id, id);
  }
}

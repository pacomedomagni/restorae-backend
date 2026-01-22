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
import { RitualsService } from './rituals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateRitualDto } from './dto/create-ritual.dto';
import { UpdateRitualDto } from './dto/update-ritual.dto';
import { CreateCompletionDto } from './dto/create-completion.dto';

@ApiTags('rituals')
@Controller('rituals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RitualsController {
  constructor(private ritualsService: RitualsService) {}

  @Post()
  @ApiOperation({ summary: 'Create custom ritual' })
  create(@CurrentUser() user: any, @Body() dto: CreateRitualDto) {
    return this.ritualsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all rituals' })
  @ApiQuery({ name: 'includeArchived', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('includeArchived') includeArchived = false,
  ) {
    return this.ritualsService.findAll(user.id, includeArchived);
  }

  @Get('today')
  @ApiOperation({ summary: 'Get today\'s rituals' })
  getTodayRituals(@CurrentUser() user: any) {
    return this.ritualsService.getTodayRituals(user.id);
  }

  @Get('favorites')
  @ApiOperation({ summary: 'Get favorite rituals' })
  getFavorites(@CurrentUser() user: any) {
    return this.ritualsService.getFavorites(user.id);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Get completion streak' })
  getStreak(@CurrentUser() user: any) {
    return this.ritualsService.getStreak(user.id);
  }

  @Get('weekly-rate')
  @ApiOperation({ summary: 'Get weekly completion rate' })
  getWeeklyRate(@CurrentUser() user: any) {
    return this.ritualsService.getWeeklyCompletionRate(user.id);
  }

  @Get('completions')
  @ApiOperation({ summary: 'Get completions' })
  @ApiQuery({ name: 'ritualId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getCompletions(
    @CurrentUser() user: any,
    @Query('ritualId') ritualId?: string,
    @Query('limit') limit = 30,
  ) {
    return this.ritualsService.getCompletions(user.id, ritualId, limit);
  }

  @Post('completions')
  @ApiOperation({ summary: 'Record completion' })
  recordCompletion(@CurrentUser() user: any, @Body() dto: CreateCompletionDto) {
    return this.ritualsService.recordCompletion(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ritual by ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ritualsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ritual' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateRitualDto,
  ) {
    return this.ritualsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ritual' })
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ritualsService.delete(user.id, id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive ritual' })
  archive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ritualsService.archive(user.id, id);
  }

  @Post(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive ritual' })
  unarchive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ritualsService.unarchive(user.id, id);
  }

  @Post(':id/favorite')
  @ApiOperation({ summary: 'Toggle favorite' })
  toggleFavorite(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ritualsService.toggleFavorite(user.id, id);
  }
}

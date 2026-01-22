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
import { JournalService } from './journal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';

@ApiTags('journal')
@Controller('journal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JournalController {
  constructor(private journalService: JournalService) {}

  @Post()
  @ApiOperation({ summary: 'Create journal entry' })
  create(@CurrentUser() user: any, @Body() dto: CreateJournalEntryDto) {
    return this.journalService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all journal entries' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.journalService.findAll(user.id, limit, offset);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search journal entries' })
  @ApiQuery({ name: 'q', required: true })
  search(@CurrentUser() user: any, @Query('q') query: string) {
    return this.journalService.search(user.id, query);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent entries' })
  @ApiQuery({ name: 'limit', required: false })
  getRecent(@CurrentUser() user: any, @Query('limit') limit = 10) {
    return this.journalService.getRecentEntries(user.id, limit);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get deleted entries (recoverable)' })
  getDeleted(@CurrentUser() user: any) {
    return this.journalService.getDeleted(user.id);
  }

  @Get('tag/:tag')
  @ApiOperation({ summary: 'Get entries by tag' })
  findByTag(@CurrentUser() user: any, @Param('tag') tag: string) {
    return this.journalService.findByTag(user.id, tag);
  }

  @Get('mood/:moodId')
  @ApiOperation({ summary: 'Get entries by mood' })
  findByMood(@CurrentUser() user: any, @Param('moodId') moodId: string) {
    return this.journalService.findByMood(user.id, moodId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journalService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update journal entry' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete journal entry' })
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journalService.delete(user.id, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore deleted entry' })
  restore(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journalService.restore(user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete entry' })
  permanentDelete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.journalService.permanentDelete(user.id, id);
  }
}

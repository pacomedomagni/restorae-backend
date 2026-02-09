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
import { JournalService } from './journal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { UserPayload } from '../../common/types/user-payload.interface';
import { JournalEntryResponseDto } from '../../common/dto/responses.dto';

@ApiTags('journal')
@Controller('journal')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JournalController {
  constructor(private journalService: JournalService) {}

  @Post()
  @ApiOperation({ summary: 'Create journal entry' })
  @ApiResponse({ status: 201, description: 'Journal entry created', type: JournalEntryResponseDto })
  create(@CurrentUser() user: UserPayload, @Body() dto: CreateJournalEntryDto) {
    return this.journalService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all journal entries' })
  @ApiResponse({ status: 200, description: 'Journal entries', type: [JournalEntryResponseDto] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.journalService.findAll(user.id, limit, offset);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search journal entries' })
  @ApiResponse({ status: 200, description: 'Search results', type: [JournalEntryResponseDto] })
  @ApiQuery({ name: 'q', required: true })
  search(@CurrentUser() user: UserPayload, @Query('q') query: string) {
    return this.journalService.search(user.id, query);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent entries' })
  @ApiResponse({ status: 200, description: 'Recent entries', type: [JournalEntryResponseDto] })
  @ApiQuery({ name: 'limit', required: false })
  getRecent(@CurrentUser() user: UserPayload, @Query('limit') limit = 10) {
    return this.journalService.getRecentEntries(user.id, limit);
  }

  @Get('deleted')
  @ApiOperation({ summary: 'Get deleted entries (recoverable)' })
  @ApiResponse({ status: 200, description: 'Deleted entries', type: [JournalEntryResponseDto] })
  getDeleted(@CurrentUser() user: UserPayload) {
    return this.journalService.getDeleted(user.id);
  }

  @Get('tag/:tag')
  @ApiOperation({ summary: 'Get entries by tag' })
  @ApiResponse({ status: 200, description: 'Entries by tag', type: [JournalEntryResponseDto] })
  findByTag(@CurrentUser() user: UserPayload, @Param('tag') tag: string) {
    return this.journalService.findByTag(user.id, tag);
  }

  @Get('mood/:moodId')
  @ApiOperation({ summary: 'Get entries by mood' })
  @ApiResponse({ status: 200, description: 'Entries by mood', type: [JournalEntryResponseDto] })
  findByMood(@CurrentUser() user: UserPayload, @Param('moodId') moodId: string) {
    return this.journalService.findByMood(user.id, moodId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get journal entry by ID' })
  @ApiResponse({ status: 200, description: 'Journal entry', type: JournalEntryResponseDto })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  findOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.journalService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update journal entry' })
  @ApiResponse({ status: 200, description: 'Entry updated', type: JournalEntryResponseDto })
  update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    return this.journalService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete journal entry' })
  @ApiResponse({ status: 200, description: 'Entry soft deleted' })
  delete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.journalService.delete(user.id, id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore deleted entry' })
  @ApiResponse({ status: 200, description: 'Entry restored', type: JournalEntryResponseDto })
  restore(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.journalService.restore(user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete entry' })
  @ApiResponse({ status: 200, description: 'Entry permanently deleted' })
  permanentDelete(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.journalService.permanentDelete(user.id, id);
  }
}

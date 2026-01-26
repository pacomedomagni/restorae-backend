import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('batch')
  @ApiOperation({ summary: 'Process a batch of offline operations' })
  async batchSync(@Req() req: any, @Body() dto: BatchSyncDto) {
    return this.syncService.processBatch(req.user.id, dto);
  }
}

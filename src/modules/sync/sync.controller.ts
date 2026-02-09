import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { AuthenticatedRequest } from '../../common/types/user-payload.interface';

@ApiTags('sync')
@Controller('sync')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('batch')
  @ApiOperation({ summary: 'Process a batch of offline operations' })
  @ApiResponse({ status: 201, description: 'Batch processed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async batchSync(@Req() req: AuthenticatedRequest, @Body() dto: BatchSyncDto) {
    return this.syncService.processBatch(req.user.id, dto);
  }
}

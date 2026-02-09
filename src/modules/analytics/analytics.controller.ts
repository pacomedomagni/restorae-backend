import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AnalyticsService, AnalyticsBatch } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

class TrackEventsDto implements AnalyticsBatch {
  events: Array<{
    name: string;
    properties?: Record<string, any>;
    timestamp?: string;
  }>;
  userId?: string;
  anonymousId?: string;
  userProperties?: Record<string, any>;
  deviceInfo?: {
    platform?: string;
    platformVersion?: string;
    deviceModel?: string;
    appVersion?: string;
  };
}

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Receive analytics events from mobile app
   * Public endpoint - uses anonymousId for tracking
   */
  @Post('events')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track analytics events from mobile app' })
  @ApiResponse({ status: 200, description: 'Events tracked' })
  async trackEvents(@Body() dto: TrackEventsDto): Promise<{ received: number }> {
    return this.analyticsService.trackEvents(dto);
  }

  /**
   * Get event counts (admin only in production)
   */
  @Get('events/counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'ANALYST')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event counts by category' })
  @ApiResponse({ status: 200, description: 'Event counts returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getEventCounts() {
    return this.analyticsService.getEventCounts();
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('admin/analytics')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'ANALYST')
@ApiBearerAuth()
export class AdminAnalyticsController {
  constructor(
    private adminService: AdminService,
    private prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard stats' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('content')
  @ApiOperation({ summary: 'Get content stats' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  getContentStats() {
    return this.adminService.getContentStats();
  }

  @Get('mood-trends')
  @ApiOperation({ summary: 'Get aggregate mood trends' })
  @ApiResponse({ status: 200, description: 'Trends retrieved' })
  async getMoodTrends(@Query('days') days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const entries = await this.prisma.moodEntry.groupBy({
      by: ['mood'],
      where: {
        deletedAt: null,
        timestamp: { gte: since },
      },
      _count: true,
    });

    return entries;
  }

  @Get('tool-usage')
  @ApiOperation({ summary: 'Get tool usage stats' })
  @ApiResponse({ status: 200, description: 'Usage retrieved' })
  async getToolUsage() {
    const [ritualCompletions, contentViews] = await Promise.all([
      this.prisma.ritualCompletion.count(),
      // Would need event tracking for actual content views
      0,
    ]);

    return { ritualCompletions, contentViews };
  }

  @Get('retention')
  @ApiOperation({ summary: 'Get retention cohorts' })
  @ApiResponse({ status: 200, description: 'Retention retrieved' })
  async getRetention() {
    // Simplified retention calculation
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeWeek, activeMonth] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.device.count({
        where: { lastActiveAt: { gte: weekAgo } },
      }),
      this.prisma.device.count({
        where: { lastActiveAt: { gte: monthAgo } },
      }),
    ]);

    return {
      totalUsers,
      weeklyActive: activeWeek,
      monthlyActive: activeMonth,
      weeklyRetention: totalUsers > 0 ? ((activeWeek / totalUsers) * 100).toFixed(2) : 0,
      monthlyRetention: totalUsers > 0 ? ((activeMonth / totalUsers) * 100).toFixed(2) : 0,
    };
  }

  @Get('feedback')
  @ApiOperation({ summary: 'Get recent feedback' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved' })
  getRecentFeedback(@Query('limit') limit = 10) {
    return this.adminService.getRecentFeedback(limit);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  getAuditLogs(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.adminService.getAuditLogs(limit, offset);
  }
}

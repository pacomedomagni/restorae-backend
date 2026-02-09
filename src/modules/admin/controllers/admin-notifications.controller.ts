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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { NotificationsService } from '../../notifications/notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateCampaignDto, UpdateCampaignDto, SendTestNotificationDto, CreateSegmentDto, UpdateSegmentDto } from '../dto/admin-notifications.dto';

@ApiTags('admin/notifications')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminNotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private prisma: PrismaService,
  ) {}

  @Get('campaigns')
  @ApiOperation({ summary: 'List notification campaigns' })
  @ApiResponse({ status: 200, description: 'Campaigns retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listCampaigns(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    const campaigns = await this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: {
        segment: true,
        _count: {
          select: { logs: true },
        },
      },
    });

    const total = await this.prisma.notificationCampaign.count();

    return { campaigns, total };
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get campaign details' })
  @ApiResponse({ status: 200, description: 'Campaign retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getCampaign(@Param('id') id: string) {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id },
      include: {
        segment: true,
        logs: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { logs: true },
        },
      },
    });

    if (!campaign) {
      return { error: 'Campaign not found' };
    }

    return campaign;
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Create notification campaign' })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  async createCampaign(
    @CurrentUser() admin: { id: string },
    @Body() body: CreateCampaignDto,
  ) {
    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        title: body.title,
        body: body.body,
        segmentId: body.segmentId,
        data: body.data as Prisma.InputJsonValue,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        timezone: body.timezone,
        createdBy: admin.id,
      },
    });

    return campaign;
  }

  @Post('campaigns/:id/send')
  @ApiOperation({ summary: 'Send campaign immediately' })
  @ApiResponse({ status: 201, description: 'Campaign sent' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async sendCampaign(
    @Param('id') id: string,
  ) {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id },
      include: { segment: true },
    });

    if (!campaign) {
      return { error: 'Campaign not found' };
    }

    // Determine target users based on segment
    let userIds: string[] = [];
    
    if (campaign.segment) {
      // Parse segment rules and get matching users
      const rules = campaign.segment.rules as Record<string, unknown>;
      userIds = await this.getUsersFromSegment(rules);
    } else {
      // Send to all users with push tokens
      const users = await this.prisma.device.findMany({
        where: { pushToken: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      });
      userIds = users.map(u => u.userId);
    }

    // Send notifications
    let sentCount = 0;
    for (const userId of userIds) {
      try {
        await this.notificationsService.sendToUser(
          userId,
          campaign.title,
          campaign.body,
          (campaign.data as Record<string, string>) || {},
        );
        
        // Create log entry
        await this.prisma.notificationLog.create({
          data: {
            campaignId: id,
            userId,
            title: campaign.title,
            body: campaign.body,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        
        sentCount++;
      } catch (error) {
        // Log failure
        await this.prisma.notificationLog.create({
          data: {
            campaignId: id,
            userId,
            title: campaign.title,
            body: campaign.body,
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    // Update campaign stats
    await this.prisma.notificationCampaign.update({
      where: { id },
      data: {
        sentAt: new Date(),
        sentCount,
      },
    });

    return { success: true, sentCount, totalTargeted: userIds.length };
  }

  private async getUsersFromSegment(rules: Record<string, unknown>): Promise<string[]> {
    // Parse segment rules to build Prisma query
    const where: Record<string, unknown> = { isActive: true };
    
    if (rules.subscriptionTier) {
      where.subscription = { tier: rules.subscriptionTier };
    }
    
    if (rules.inactiveDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(rules.inactiveDays));
      where.updatedAt = { lt: cutoff };
    }
    
    if (rules.hasCompletedOnboarding !== undefined) {
      where.onboardingCompleted = rules.hasCompletedOnboarding;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    return users.map(u => u.id);
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiResponse({ status: 200, description: 'Campaign updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateCampaign(
    @Param('id') id: string,
    @Body() body: UpdateCampaignDto,
  ) {
    return this.prisma.notificationCampaign.update({
      where: { id },
      data: {
        ...body,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      },
    });
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiResponse({ status: 200, description: 'Campaign deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteCampaign(@Param('id') id: string) {
    // Delete associated logs first
    await this.prisma.notificationLog.deleteMany({
      where: { campaignId: id },
    });

    return this.prisma.notificationCampaign.delete({
      where: { id },
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification stats' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getStats() {
    const [totalSent, totalDelivered, totalOpened, recentCampaigns] = await Promise.all([
      this.prisma.notificationLog.count({ where: { status: 'SENT' } }),
      this.prisma.notificationLog.count({ where: { status: 'DELIVERED' } }),
      this.prisma.notificationLog.count({ where: { NOT: { openedAt: null } } }),
      this.prisma.notificationCampaign.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent * 100) : 0;
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered * 100) : 0;

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      recentCampaigns,
      deliveryRate: Math.round(deliveryRate * 10) / 10,
      openRate: Math.round(openRate * 10) / 10,
    };
  }

  @Post('send-test')
  @ApiOperation({ summary: 'Send test notification' })
  @ApiResponse({ status: 201, description: 'Test notification sent' })
  async sendTest(
    @Body() body: SendTestNotificationDto,
  ) {
    await this.notificationsService.sendToUser(
      body.userId,
      body.title,
      body.body,
      { isTest: 'true' },
    );

    return { success: true };
  }

  // =========================================================================
  // SEGMENTS
  // =========================================================================

  @Get('segments')
  @ApiOperation({ summary: 'List segments' })
  @ApiResponse({ status: 200, description: 'Segments retrieved' })
  async listSegments() {
    return this.prisma.segment.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { campaigns: true },
        },
      },
    });
  }

  @Post('segments')
  @ApiOperation({ summary: 'Create segment' })
  @ApiResponse({ status: 201, description: 'Segment created' })
  async createSegment(
    @Body() body: CreateSegmentDto,
  ) {
    return this.prisma.segment.create({
      data: body as unknown as Prisma.SegmentCreateInput,
    });
  }

  @Patch('segments/:id')
  @ApiOperation({ summary: 'Update segment' })
  @ApiResponse({ status: 200, description: 'Segment updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateSegment(
    @Param('id') id: string,
    @Body() body: UpdateSegmentDto,
  ) {
    return this.prisma.segment.update({
      where: { id },
      data: body as unknown as Prisma.SegmentUpdateInput,
    });
  }

  @Delete('segments/:id')
  @ApiOperation({ summary: 'Delete segment' })
  @ApiResponse({ status: 200, description: 'Segment deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteSegment(@Param('id') id: string) {
    return this.prisma.segment.delete({
      where: { id },
    });
  }

  @Get('segments/:id/preview')
  @ApiOperation({ summary: 'Preview segment users count' })
  @ApiResponse({ status: 200, description: 'Segment preview retrieved' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async previewSegment(@Param('id') id: string) {
    const segment = await this.prisma.segment.findUnique({
      where: { id },
    });

    if (!segment) {
      return { error: 'Segment not found' };
    }

    const userIds = await this.getUsersFromSegment(segment.rules as Record<string, unknown>);
    return { count: userIds.length };
  }
}

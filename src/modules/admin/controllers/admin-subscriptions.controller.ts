import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionTier } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('admin/subscriptions')
@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminSubscriptionsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List subscriptions' })
  async list(
    @Query('tier') tier?: SubscriptionTier,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.prisma.subscription.findMany({
      where: tier ? { tier } : {},
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        entitlements: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get subscription stats' })
  async getStats() {
    const [total, free, premium, lifetime, trialing] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({ where: { tier: 'FREE' } }),
      this.prisma.subscription.count({ where: { tier: 'PREMIUM' } }),
      this.prisma.subscription.count({ where: { tier: 'LIFETIME' } }),
      this.prisma.subscription.count({ where: { isTrialing: true } }),
    ]);

    return {
      total,
      free,
      premium,
      lifetime,
      trialing,
      conversionRate: total > 0 ? (((premium + lifetime) / total) * 100).toFixed(2) : 0,
    };
  }

  @Patch(':userId/tier')
  @ApiOperation({ summary: 'Update subscription tier' })
  async updateTier(
    @Param('userId') userId: string,
    @Body() body: { tier: SubscriptionTier },
  ) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: body.tier,
        isTrialing: false,
      },
    });
  }

  @Post(':userId/grant-premium')
  @ApiOperation({ summary: 'Grant premium (admin)' })
  async grantPremium(
    @Param('userId') userId: string,
    @Body() body: { durationDays?: number },
  ) {
    const expiresAt = body.durationDays
      ? new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: SubscriptionTier.PREMIUM,
        isTrialing: false,
        currentPeriodEnd: expiresAt,
      },
    });
  }

  @Post(':userId/revoke-premium')
  @ApiOperation({ summary: 'Revoke premium' })
  async revokePremium(@Param('userId') userId: string) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        currentPeriodEnd: null,
      },
    });
  }

  @Post(':userId/grant-lifetime')
  @ApiOperation({ summary: 'Grant lifetime' })
  async grantLifetime(@Param('userId') userId: string) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: SubscriptionTier.LIFETIME,
        isTrialing: false,
      },
    });
  }
}

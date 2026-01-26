import { Controller, Get, Post, Body, UseGuards, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private subscriptionsService: SubscriptionsService,
    private configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription status' })
  getSubscription(@CurrentUser() user: any) {
    return this.subscriptionsService.getSubscription(user.id);
  }

  @Post('trial')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start free trial' })
  startTrial(@CurrentUser() user: any) {
    return this.subscriptionsService.startTrial(user.id);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate receipt' })
  validateReceipt(
    @CurrentUser() user: any,
    @Body() body: { receiptData: string; platform: 'ios' | 'android'; productId?: string },
  ) {
    return this.subscriptionsService.validateReceipt(
      user.id,
      body.receiptData,
      body.platform,
      body.productId,
    );
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore purchases' })
  restorePurchases(@CurrentUser() user: any) {
    return this.subscriptionsService.restorePurchases(user.id);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  cancelSubscription(@CurrentUser() user: any) {
    return this.subscriptionsService.cancelSubscription(user.id);
  }

  @Get('access/:featureId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check feature access' })
  checkAccess(@CurrentUser() user: any, @Param('featureId') featureId: string) {
    return this.subscriptionsService.checkFeatureAccess(user.id, featureId);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'RevenueCat webhook' })
  handleWebhook(@Body() event: any, @Headers('authorization') authorization?: string) {
    const secret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (secret) {
      const token = authorization?.replace(/^Bearer\s+/i, '').trim();
      if (!token || token !== secret) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
    return this.subscriptionsService.handleWebhook(event);
  }
}

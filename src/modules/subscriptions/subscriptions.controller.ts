import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get subscription status' })
  getSubscription(@CurrentUser() user: any) {
    return this.subscriptionsService.getSubscription(user.id);
  }

  @Post('trial')
  @ApiOperation({ summary: 'Start free trial' })
  startTrial(@CurrentUser() user: any) {
    return this.subscriptionsService.startTrial(user.id);
  }

  @Post('validate')
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
  @ApiOperation({ summary: 'Restore purchases' })
  restorePurchases(@CurrentUser() user: any) {
    return this.subscriptionsService.restorePurchases(user.id);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancelSubscription(@CurrentUser() user: any) {
    return this.subscriptionsService.cancelSubscription(user.id);
  }

  @Get('access/:featureId')
  @ApiOperation({ summary: 'Check feature access' })
  checkAccess(@CurrentUser() user: any, @Param('featureId') featureId: string) {
    return this.subscriptionsService.checkFeatureAccess(user.id, featureId);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'RevenueCat webhook' })
  handleWebhook(@Body() event: any) {
    return this.subscriptionsService.handleWebhook(event);
  }
}

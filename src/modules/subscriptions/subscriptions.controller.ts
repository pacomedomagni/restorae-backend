import { Controller, Get, Post, Body, UseGuards, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../../common/types/user-payload.interface';
import {
  SubscriptionResponseDto,
  FeatureAccessResponseDto,
  MessageResponseDto,
} from '../../common/dto/responses.dto';
import { ValidateReceiptDto } from './dto/subscription.dto';

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
  @ApiResponse({ status: 200, description: 'Subscription status', type: SubscriptionResponseDto })
  getSubscription(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.getSubscription(user.id);
  }

  @Post('trial')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start free trial' })
  @ApiResponse({ status: 201, description: 'Trial started', type: SubscriptionResponseDto })
  @ApiResponse({ status: 409, description: 'Trial already used' })
  startTrial(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.startTrial(user.id);
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate receipt' })
  @ApiResponse({ status: 201, description: 'Receipt validated', type: SubscriptionResponseDto })
  validateReceipt(
    @CurrentUser() user: UserPayload,
    @Body() body: ValidateReceiptDto,
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
  @ApiResponse({ status: 201, description: 'Purchases restored', type: SubscriptionResponseDto })
  restorePurchases(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.restorePurchases(user.id);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 201, description: 'Subscription cancelled', type: MessageResponseDto })
  cancelSubscription(@CurrentUser() user: UserPayload) {
    return this.subscriptionsService.cancelSubscription(user.id);
  }

  @Get('access/:featureId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check feature access' })
  @ApiResponse({ status: 200, description: 'Feature access status', type: FeatureAccessResponseDto })
  checkAccess(@CurrentUser() user: UserPayload, @Param('featureId') featureId: string) {
    return this.subscriptionsService.checkFeatureAccess(user.id, featureId);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'RevenueCat webhook' })
  handleWebhook(@Body() event: { type: string; app_user_id: string; product_id?: string; expiration_at_ms?: number }, @Headers('authorization') authorization?: string) {
    const secret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (secret) {
      const token = authorization?.replace(/^Bearer\s+/i, '').trim();
      const tokenBuf = Buffer.from(token || '');
      const secretBuf = Buffer.from(secret);
      if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
    return this.subscriptionsService.handleWebhook(event);
  }
}

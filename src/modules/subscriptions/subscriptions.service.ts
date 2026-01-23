import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RevenueCatService } from './revenuecat.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private revenueCat: RevenueCatService,
  ) {}

  async getSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { entitlements: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return {
      ...subscription,
      isPremium: subscription.tier !== SubscriptionTier.FREE,
      isActive: this.isSubscriptionActive(subscription),
    };
  }

  async startTrial(userId: string, durationDays = 7) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check if user already had a trial
    if (subscription.trialStartedAt) {
      throw new BadRequestException('Trial already used');
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + durationDays);

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: SubscriptionTier.PREMIUM,
        isTrialing: true,
        trialStartedAt: new Date(),
        trialEndsAt,
      },
    });
  }

  async validateReceipt(
    userId: string,
    receiptData: string,
    platform: 'ios' | 'android',
    productId?: string
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Get RevenueCat app user ID (use our userId or their stored ID)
    const revenueCatId = subscription.revenuecatId || userId;

    // Validate with RevenueCat
    const result = await this.revenueCat.validateReceipt(
      revenueCatId,
      receiptData,
      platform,
      productId
    );

    if (!result.isValid) {
      throw new BadRequestException('Invalid receipt');
    }

    // Determine subscription tier
    let tier: SubscriptionTier = SubscriptionTier.PREMIUM;
    if (result.entitlements?.includes('lifetime')) {
      tier = SubscriptionTier.LIFETIME;
    }

    // Update subscription
    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        tier,
        isTrialing: false,
        productId: result.productId,
        receiptData: { receipt: receiptData, platform },
        currentPeriodStart: new Date(),
        currentPeriodEnd: result.expiresAt,
        revenuecatId: revenueCatId,
        cancelledAt: null,
      },
    });

    // Grant premium entitlement
    await this.prisma.entitlement.upsert({
      where: {
        subscriptionId_featureId: {
          subscriptionId: subscription.id,
          featureId: 'premium',
        },
      },
      update: {
        expiresAt: result.expiresAt,
        source: 'purchase',
      },
      create: {
        subscriptionId: subscription.id,
        featureId: 'premium',
        source: 'purchase',
        expiresAt: result.expiresAt,
      },
    });

    return {
      success: true,
      subscription: updated,
      productId: result.productId,
      expiresAt: result.expiresAt,
    };
  }

  async restorePurchases(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const revenueCatId = subscription.revenuecatId || userId;

    // Restore from RevenueCat
    const result = await this.revenueCat.restorePurchases(revenueCatId);

    if (!result.isValid) {
      return {
        restored: false,
        subscription,
        message: 'No purchases found to restore',
      };
    }

    // Determine tier
    let tier: SubscriptionTier = SubscriptionTier.PREMIUM;
    if (result.entitlements?.includes('lifetime')) {
      tier = SubscriptionTier.LIFETIME;
    }

    // Update subscription
    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        tier,
        isTrialing: false,
        productId: result.productId,
        currentPeriodEnd: result.expiresAt,
        cancelledAt: null,
      },
    });

    return {
      restored: true,
      subscription: updated,
      message: 'Purchases restored successfully',
    };
  }

  async cancelSubscription(userId: string) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        cancelledAt: new Date(),
      },
    });
  }

  async checkFeatureAccess(userId: string, featureId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { entitlements: true },
    });

    if (!subscription) return false;

    // Premium or lifetime users have all access
    if (subscription.tier === SubscriptionTier.LIFETIME) return true;
    if (subscription.tier === SubscriptionTier.PREMIUM && this.isSubscriptionActive(subscription)) {
      return true;
    }

    // Check specific entitlements
    const hasEntitlement = subscription.entitlements.some(
      (e) => e.featureId === featureId && (!e.expiresAt || e.expiresAt > new Date()),
    );

    return hasEntitlement;
  }

  async grantEntitlement(userId: string, featureId: string, source: string, expiresAt?: Date) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.entitlement.upsert({
      where: {
        subscriptionId_featureId: {
          subscriptionId: subscription.id,
          featureId,
        },
      },
      update: {
        expiresAt,
        source,
      },
      create: {
        subscriptionId: subscription.id,
        featureId,
        source,
        expiresAt,
      },
    });
  }

  async revokeEntitlement(userId: string, featureId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return this.prisma.entitlement.deleteMany({
      where: {
        subscriptionId: subscription.id,
        featureId,
      },
    });
  }

  // Admin: Grant premium to user
  async adminGrantPremium(userId: string, durationDays?: number) {
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      : undefined;

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: durationDays ? SubscriptionTier.PREMIUM : SubscriptionTier.LIFETIME,
        isTrialing: false,
        currentPeriodEnd: expiresAt,
        cancelledAt: null,
      },
    });
  }

  // Admin: Revoke premium from user
  async adminRevokePremium(userId: string) {
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        currentPeriodEnd: null,
      },
    });
  }

  // RevenueCat Webhook handler
  async handleWebhook(event: any) {
    const { type, app_user_id, product_id, expiration_at_ms } = event;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: app_user_id },
          { subscription: { revenuecatId: app_user_id } },
        ],
      },
    });

    if (!user) {
      console.warn(`Webhook: User not found for RevenueCat ID ${app_user_id}`);
      return { received: true, processed: false };
    }

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: {
            tier: SubscriptionTier.PREMIUM,
            isTrialing: false,
            productId: product_id,
            currentPeriodEnd: expiration_at_ms ? new Date(expiration_at_ms) : null,
            cancelledAt: null,
          },
        });
        break;

      case 'CANCELLATION':
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: {
            cancelledAt: new Date(),
          },
        });
        break;

      case 'UNCANCELLATION':
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: {
            cancelledAt: null,
          },
        });
        break;

      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: {
            tier: SubscriptionTier.FREE,
            isTrialing: false,
          },
        });
        break;

      case 'NON_RENEWING_PURCHASE':
        // Lifetime purchase
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: {
            tier: SubscriptionTier.LIFETIME,
            isTrialing: false,
            cancelledAt: null,
          },
        });
        break;
    }

    return { received: true, processed: true };
  }

  private isSubscriptionActive(subscription: any): boolean {
    if (subscription.tier === SubscriptionTier.LIFETIME) return true;
    if (subscription.tier === SubscriptionTier.FREE) return false;

    // Check trial
    if (subscription.isTrialing && subscription.trialEndsAt) {
      return new Date(subscription.trialEndsAt) > new Date();
    }

    // Check period
    if (subscription.currentPeriodEnd) {
      return new Date(subscription.currentPeriodEnd) > new Date();
    }

    return false;
  }
}

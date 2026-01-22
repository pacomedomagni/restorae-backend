import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

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

  async validateReceipt(userId: string, receiptData: any) {
    // TODO: Integrate with RevenueCat API
    // For now, mock the validation
    
    // In production:
    // 1. Send receipt to RevenueCat
    // 2. Get entitlements
    // 3. Update subscription accordingly

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        tier: SubscriptionTier.PREMIUM,
        isTrialing: false,
        receiptData,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });
  }

  async restorePurchases(userId: string) {
    // TODO: Call RevenueCat to restore purchases
    // This would sync with the app store receipts

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    return {
      restored: false,
      subscription,
      message: 'No purchases found to restore',
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

  // RevenueCat Webhook handler
  async handleWebhook(event: any) {
    const { type, app_user_id, product_id, expiration_at_ms } = event;

    const user = await this.prisma.user.findFirst({
      where: {
        subscription: {
          revenuecatId: app_user_id,
        },
      },
    });

    if (!user) {
      console.warn(`Webhook: User not found for RevenueCat ID ${app_user_id}`);
      return;
    }

    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
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

      case 'EXPIRATION':
        await this.prisma.subscription.update({
          where: { userId: user.id },
          data: {
            tier: SubscriptionTier.FREE,
            isTrialing: false,
          },
        });
        break;
    }
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

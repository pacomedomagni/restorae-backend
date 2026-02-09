import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SubscriptionTier } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RevenueCatService } from './revenuecat.service';

const mockRevenueCat = {
  validateReceipt: jest.fn(),
  restorePurchases: jest.fn(),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
        {
          provide: RevenueCatService,
          useValue: mockRevenueCat,
        },
      ],
    }).compile();

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    service = module.get<SubscriptionsService>(SubscriptionsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getSubscription
  // ---------------------------------------------------------------------------
  describe('getSubscription', () => {
    const userId = 'user-123';

    it('should return the subscription with isPremium and isActive flags when found', async () => {
      const subscription = {
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.PREMIUM,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        cancelledAt: null,
        revenuecatId: null,
        platform: 'ios',
        productId: 'com.restorae.premium.monthly',
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        entitlements: [],
      };

      prisma.subscription.findUnique.mockResolvedValue(subscription as any);

      const result = await service.getSubscription(userId);

      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: { entitlements: true },
      });
      expect(result.isPremium).toBe(true);
      expect(result.isActive).toBe(true);
      expect(result.tier).toBe(SubscriptionTier.PREMIUM);
    });

    it('should return isPremium=false and isActive=false for a FREE subscription', async () => {
      const subscription = {
        id: 'sub-2',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        revenuecatId: null,
        platform: null,
        productId: null,
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        entitlements: [],
      };

      prisma.subscription.findUnique.mockResolvedValue(subscription as any);

      const result = await service.getSubscription(userId);

      expect(result.isPremium).toBe(false);
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when the subscription does not exist', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.getSubscription(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // startTrial
  // ---------------------------------------------------------------------------
  describe('startTrial', () => {
    const userId = 'user-123';

    it('should start a trial and set tier to PREMIUM with isTrialing=true', async () => {
      const subscription = {
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        revenuecatId: null,
        platform: null,
        productId: null,
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedSubscription = {
        ...subscription,
        tier: SubscriptionTier.PREMIUM,
        isTrialing: true,
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      prisma.subscription.findUnique.mockResolvedValue(subscription as any);
      prisma.subscription.update.mockResolvedValue(updatedSubscription as any);

      const result = await service.startTrial(userId);

      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          tier: SubscriptionTier.PREMIUM,
          isTrialing: true,
          trialStartedAt: expect.any(Date),
          trialEndsAt: expect.any(Date),
        }),
      });
      expect(result.tier).toBe(SubscriptionTier.PREMIUM);
      expect(result.isTrialing).toBe(true);
    });

    it('should accept a custom duration in days', async () => {
      const subscription = {
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        revenuecatId: null,
        platform: null,
        productId: null,
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.subscription.findUnique.mockResolvedValue(subscription as any);
      prisma.subscription.update.mockResolvedValue({
        ...subscription,
        tier: SubscriptionTier.PREMIUM,
        isTrialing: true,
      } as any);

      await service.startTrial(userId, 14);

      const updateCall = prisma.subscription.update.mock.calls[0][0];
      const trialEndsAt = (updateCall.data as any).trialEndsAt as Date;

      // The trial end date should be roughly 14 days from now
      const expectedMs = 14 * 24 * 60 * 60 * 1000;
      const diff = trialEndsAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(expectedMs - 5000);
      expect(diff).toBeLessThanOrEqual(expectedMs + 5000);
    });

    it('should throw BadRequestException when the user already had a trial', async () => {
      const subscription = {
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: new Date('2024-01-01'),
        trialEndsAt: new Date('2024-01-08'),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        revenuecatId: null,
        platform: null,
        productId: null,
        receiptData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.subscription.findUnique.mockResolvedValue(subscription as any);

      await expect(service.startTrial(userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the subscription does not exist', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.startTrial(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // validateReceipt
  // ---------------------------------------------------------------------------
  describe('validateReceipt', () => {
    const userId = 'user-123';
    const receiptData = 'mock-receipt-data';
    const platform = 'ios' as const;
    const productId = 'com.restorae.premium.monthly';

    const baseSubscription = {
      id: 'sub-1',
      userId,
      tier: SubscriptionTier.FREE,
      isTrialing: false,
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelledAt: null,
      revenuecatId: null,
      platform: null,
      productId: null,
      receiptData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should validate a receipt and set tier to PREMIUM', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      prisma.subscription.findUnique.mockResolvedValue(baseSubscription as any);
      mockRevenueCat.validateReceipt.mockResolvedValue({
        isValid: true,
        productId,
        expiresAt,
        entitlements: ['premium'],
      });

      const updatedSubscription = {
        ...baseSubscription,
        tier: SubscriptionTier.PREMIUM,
        productId,
        currentPeriodEnd: expiresAt,
      };
      prisma.subscription.update.mockResolvedValue(updatedSubscription as any);
      prisma.entitlement.upsert.mockResolvedValue({} as any);

      const result = await service.validateReceipt(
        userId,
        receiptData,
        platform,
        productId,
      );

      expect(result.success).toBe(true);
      expect(result.productId).toBe(productId);
      expect(result.expiresAt).toBe(expiresAt);

      expect(mockRevenueCat.validateReceipt).toHaveBeenCalledWith(
        userId,
        receiptData,
        platform,
        productId,
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          tier: SubscriptionTier.PREMIUM,
          isTrialing: false,
          productId,
          cancelledAt: null,
        }),
      });

      // Should upsert the premium entitlement
      expect(prisma.entitlement.upsert).toHaveBeenCalledWith({
        where: {
          subscriptionId_featureId: {
            subscriptionId: baseSubscription.id,
            featureId: 'premium',
          },
        },
        update: {
          expiresAt,
          source: 'purchase',
        },
        create: {
          subscriptionId: baseSubscription.id,
          featureId: 'premium',
          source: 'purchase',
          expiresAt,
        },
      });
    });

    it('should set tier to LIFETIME when entitlements include lifetime', async () => {
      prisma.subscription.findUnique.mockResolvedValue(baseSubscription as any);
      mockRevenueCat.validateReceipt.mockResolvedValue({
        isValid: true,
        productId: 'com.restorae.premium.lifetime',
        expiresAt: undefined,
        entitlements: ['premium', 'lifetime'],
      });

      const updatedSubscription = {
        ...baseSubscription,
        tier: SubscriptionTier.LIFETIME,
        productId: 'com.restorae.premium.lifetime',
      };
      prisma.subscription.update.mockResolvedValue(updatedSubscription as any);
      prisma.entitlement.upsert.mockResolvedValue({} as any);

      const result = await service.validateReceipt(
        userId,
        receiptData,
        platform,
        'com.restorae.premium.lifetime',
      );

      expect(result.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          tier: SubscriptionTier.LIFETIME,
        }),
      });
    });

    it('should throw BadRequestException when the receipt is invalid', async () => {
      prisma.subscription.findUnique.mockResolvedValue(baseSubscription as any);
      mockRevenueCat.validateReceipt.mockResolvedValue({
        isValid: false,
      });

      await expect(
        service.validateReceipt(userId, receiptData, platform, productId),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(prisma.entitlement.upsert).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the subscription does not exist', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.validateReceipt(userId, receiptData, platform, productId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use the stored revenuecatId if available', async () => {
      const subscriptionWithRcId = {
        ...baseSubscription,
        revenuecatId: 'rc-custom-id',
      };

      prisma.subscription.findUnique.mockResolvedValue(
        subscriptionWithRcId as any,
      );
      mockRevenueCat.validateReceipt.mockResolvedValue({
        isValid: true,
        productId,
        expiresAt: new Date(),
        entitlements: ['premium'],
      });
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.entitlement.upsert.mockResolvedValue({} as any);

      await service.validateReceipt(userId, receiptData, platform, productId);

      expect(mockRevenueCat.validateReceipt).toHaveBeenCalledWith(
        'rc-custom-id',
        receiptData,
        platform,
        productId,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // checkFeatureAccess
  // ---------------------------------------------------------------------------
  describe('checkFeatureAccess', () => {
    const userId = 'user-123';
    const featureId = 'advanced-breathing';

    it('should return true for a LIFETIME user regardless of entitlements', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.LIFETIME,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        entitlements: [],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(true);
    });

    it('should return true for an active PREMIUM user', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.PREMIUM,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelledAt: null,
        entitlements: [],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(true);
    });

    it('should return false for an expired PREMIUM user without specific entitlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.PREMIUM,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: new Date('2024-01-01'),
        currentPeriodEnd: new Date('2024-01-31'), // expired
        cancelledAt: null,
        entitlements: [],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(false);
    });

    it('should return true for a FREE user with a valid specific entitlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        entitlements: [
          {
            id: 'ent-1',
            subscriptionId: 'sub-1',
            featureId: 'advanced-breathing',
            grantedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // valid
            source: 'promo',
          },
        ],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(true);
    });

    it('should return true for a FREE user with a non-expiring entitlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        entitlements: [
          {
            id: 'ent-1',
            subscriptionId: 'sub-1',
            featureId: 'advanced-breathing',
            grantedAt: new Date(),
            expiresAt: null, // never expires
            source: 'admin',
          },
        ],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(true);
    });

    it('should return false for a FREE user without the requested entitlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        entitlements: [],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(false);
    });

    it('should return false for a FREE user with an expired entitlement', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
        isTrialing: false,
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        entitlements: [
          {
            id: 'ent-1',
            subscriptionId: 'sub-1',
            featureId: 'advanced-breathing',
            grantedAt: new Date('2024-01-01'),
            expiresAt: new Date('2024-01-08'), // expired
            source: 'promo',
          },
        ],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(false);
    });

    it('should return false when the subscription does not exist', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(false);
    });

    it('should return true for a trialing PREMIUM user with valid trial', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.PREMIUM,
        isTrialing: true,
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelledAt: null,
        entitlements: [],
      } as any);

      const result = await service.checkFeatureAccess(userId, featureId);

      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // cancelSubscription
  // ---------------------------------------------------------------------------
  describe('cancelSubscription', () => {
    it('should set cancelledAt on the subscription', async () => {
      const userId = 'user-123';
      prisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        userId,
        cancelledAt: new Date(),
      } as any);

      await service.cancelSubscription(userId);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          cancelledAt: expect.any(Date),
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // adminGrantPremium
  // ---------------------------------------------------------------------------
  describe('adminGrantPremium', () => {
    const userId = 'user-123';

    it('should set tier to PREMIUM when durationDays is provided', async () => {
      prisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.PREMIUM,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      } as any);

      await service.adminGrantPremium(userId, 30);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.PREMIUM,
          isTrialing: false,
          currentPeriodEnd: expect.any(Date),
          cancelledAt: null,
        },
      });

      const updateCall = prisma.subscription.update.mock.calls[0][0];
      const periodEnd = (updateCall.data as any).currentPeriodEnd as Date;
      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      const diff = periodEnd.getTime() - Date.now();
      expect(diff).toBeGreaterThan(expectedMs - 5000);
      expect(diff).toBeLessThanOrEqual(expectedMs + 5000);
    });

    it('should set tier to LIFETIME when durationDays is not provided', async () => {
      prisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.LIFETIME,
        currentPeriodEnd: null,
      } as any);

      await service.adminGrantPremium(userId);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.LIFETIME,
          isTrialing: false,
          currentPeriodEnd: undefined,
          cancelledAt: null,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // adminRevokePremium
  // ---------------------------------------------------------------------------
  describe('adminRevokePremium', () => {
    it('should set tier to FREE and clear period end', async () => {
      const userId = 'user-123';
      prisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        userId,
        tier: SubscriptionTier.FREE,
      } as any);

      await service.adminRevokePremium(userId);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.FREE,
          isTrialing: false,
          currentPeriodEnd: null,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // handleWebhook
  // ---------------------------------------------------------------------------
  describe('handleWebhook', () => {
    const userId = 'user-456';
    const appUserId = 'rc-user-789';
    const user = { id: userId, email: 'test@example.com' };

    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue(user as any);
    });

    it('should set tier to PREMIUM on INITIAL_PURCHASE', async () => {
      const expirationMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'INITIAL_PURCHASE',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: expirationMs,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.PREMIUM,
          isTrialing: false,
          productId: 'com.restorae.premium.monthly',
          currentPeriodEnd: new Date(expirationMs),
          cancelledAt: null,
        },
      });
    });

    it('should set tier to PREMIUM on RENEWAL', async () => {
      const expirationMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'RENEWAL',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: expirationMs,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          tier: SubscriptionTier.PREMIUM,
          isTrialing: false,
        }),
      });
    });

    it('should set tier to PREMIUM on PRODUCT_CHANGE', async () => {
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'PRODUCT_CHANGE',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.yearly',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          tier: SubscriptionTier.PREMIUM,
          productId: 'com.restorae.premium.yearly',
          currentPeriodEnd: null,
        }),
      });
    });

    it('should set cancelledAt on CANCELLATION', async () => {
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'CANCELLATION',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          cancelledAt: expect.any(Date),
        },
      });
    });

    it('should clear cancelledAt on UNCANCELLATION', async () => {
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'UNCANCELLATION',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          cancelledAt: null,
        },
      });
    });

    it('should set tier to FREE on EXPIRATION', async () => {
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'EXPIRATION',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.FREE,
          isTrialing: false,
        },
      });
    });

    it('should set tier to FREE on BILLING_ISSUE', async () => {
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'BILLING_ISSUE',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.FREE,
          isTrialing: false,
        },
      });
    });

    it('should set tier to LIFETIME on NON_RENEWING_PURCHASE', async () => {
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhook({
        type: 'NON_RENEWING_PURCHASE',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.lifetime',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          tier: SubscriptionTier.LIFETIME,
          isTrialing: false,
          cancelledAt: null,
        },
      });
    });

    it('should return processed=false when the user is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhook({
        type: 'INITIAL_PURCHASE',
        app_user_id: 'unknown-user',
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: undefined,
      });

      expect(result).toEqual({ received: true, processed: false });
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should look up the user by id or revenuecatId', async () => {
      prisma.user.findFirst.mockResolvedValue(user as any);
      prisma.subscription.update.mockResolvedValue({} as any);

      await service.handleWebhook({
        type: 'INITIAL_PURCHASE',
        app_user_id: appUserId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: undefined,
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: appUserId },
            { subscription: { revenuecatId: appUserId } },
          ],
        },
      });
    });
  });
});

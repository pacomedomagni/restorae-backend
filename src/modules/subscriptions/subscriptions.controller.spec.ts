/**
 * Subscriptions Controller Tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let subscriptionsService: jest.Mocked<SubscriptionsService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = { id: 'user-123', email: 'test@example.com', role: 'USER' };

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    tier: 'FREE' as const,
    isTrialing: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockSubscriptionsService = {
      getSubscription: jest.fn(),
      startTrial: jest.fn(),
      validateReceipt: jest.fn(),
      restorePurchases: jest.fn(),
      cancelSubscription: jest.fn(),
      checkFeatureAccess: jest.fn(),
      handleWebhook: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    subscriptionsService = module.get(SubscriptionsService);
    configService = module.get(ConfigService);
  });

  describe('getSubscription', () => {
    it('should return subscription status', async () => {
      subscriptionsService.getSubscription.mockResolvedValue(mockSubscription);

      const result = await controller.getSubscription(mockUser as any);

      expect(subscriptionsService.getSubscription).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('startTrial', () => {
    it('should start a free trial', async () => {
      const trialSubscription = { ...mockSubscription, tier: 'PREMIUM' as const, isTrialing: true };
      subscriptionsService.startTrial.mockResolvedValue(trialSubscription);

      const result = await controller.startTrial(mockUser as any);

      expect(subscriptionsService.startTrial).toHaveBeenCalledWith(mockUser.id);
      expect(result.isTrialing).toBe(true);
    });
  });

  describe('validateReceipt', () => {
    it('should validate receipt', async () => {
      const body = { receiptData: 'receipt', platform: 'ios', productId: 'premium' };
      subscriptionsService.validateReceipt.mockResolvedValue({ ...mockSubscription, tier: 'PREMIUM' as const });

      const result = await controller.validateReceipt(mockUser as any, body);

      expect(subscriptionsService.validateReceipt).toHaveBeenCalledWith(
        mockUser.id,
        body.receiptData,
        body.platform,
        body.productId,
      );
      expect(result.tier).toBe('PREMIUM');
    });
  });

  describe('checkAccess', () => {
    it('should check feature access', async () => {
      subscriptionsService.checkFeatureAccess.mockResolvedValue({ hasAccess: true, featureId: 'stories' });

      const result = await controller.checkAccess(mockUser as any, 'stories');

      expect(subscriptionsService.checkFeatureAccess).toHaveBeenCalledWith(mockUser.id, 'stories');
      expect(result.hasAccess).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    it('should process webhook with valid signature', async () => {
      const webhookSecret = 'test-secret';
      configService.get.mockReturnValue(webhookSecret);
      subscriptionsService.handleWebhook.mockResolvedValue({ success: true });

      const event = { type: 'INITIAL_PURCHASE', app_user_id: 'user-123' };

      const result = await controller.handleWebhook(event, `Bearer ${webhookSecret}`);

      expect(subscriptionsService.handleWebhook).toHaveBeenCalledWith(event);
      expect(result).toEqual({ success: true });
    });

    it('should reject webhook with invalid signature', async () => {
      configService.get.mockReturnValue('correct-secret');

      const event = { type: 'INITIAL_PURCHASE', app_user_id: 'user-123' };

      await expect(
        controller.handleWebhook(event, 'Bearer wrong-secret'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should allow webhook when no secret is configured', async () => {
      configService.get.mockReturnValue(undefined);
      subscriptionsService.handleWebhook.mockResolvedValue({ success: true });

      const event = { type: 'INITIAL_PURCHASE', app_user_id: 'user-123' };

      const result = await controller.handleWebhook(event, undefined);

      expect(subscriptionsService.handleWebhook).toHaveBeenCalledWith(event);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription', async () => {
      subscriptionsService.cancelSubscription.mockResolvedValue({ message: 'Cancelled' });

      const result = await controller.cancelSubscription(mockUser as any);

      expect(subscriptionsService.cancelSubscription).toHaveBeenCalledWith(mockUser.id);
      expect(result).toHaveProperty('message');
    });
  });

  describe('restorePurchases', () => {
    it('should restore purchases', async () => {
      subscriptionsService.restorePurchases.mockResolvedValue(mockSubscription);

      const result = await controller.restorePurchases(mockUser as any);

      expect(subscriptionsService.restorePurchases).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockSubscription);
    });
  });
});

/**
 * Subscriptions E2E Tests
 * 
 * Comprehensive end-to-end tests for subscription and payment flows.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('SubscriptionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let configService: ConfigService;
  let accessToken: string;
  let userId: string;

  const testUser = {
    email: 'subscription-test@restorae.com',
    password: 'SecurePassword123!',
    name: 'Subscription Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    await app.init();

    // Clean up and create test user
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);

    accessToken = response.body.accessToken;
    userId = response.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  describe('GET /api/v1/subscriptions', () => {
    it('should return subscription status for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tier');
      expect(response.body.tier).toBe('FREE');
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/subscriptions')
        .expect(401);
    });
  });

  describe('POST /api/v1/subscriptions/trial', () => {
    it('should start a free trial', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/trial')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.isTrialing).toBe(true);
      expect(response.body.tier).toBe('PREMIUM');
    });

    it('should not allow starting trial twice', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/trial')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);
    });
  });

  describe('POST /api/v1/subscriptions/validate', () => {
    it('should validate receipt data', async () => {
      // Reset subscription to FREE for this test
      await prisma.subscription.update({
        where: { userId },
        data: { tier: 'FREE', isTrialing: false },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          receiptData: 'mock-receipt-data',
          platform: 'ios',
          productId: 'com.restorae.premium.monthly',
        })
        .expect(201);

      expect(response.body).toHaveProperty('tier');
    });

    it('should reject invalid receipt data format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          receiptData: '',
          platform: 'ios',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/subscriptions/access/:featureId', () => {
    it('should check feature access for premium user', async () => {
      // Ensure user has premium
      await prisma.subscription.update({
        where: { userId },
        data: { tier: 'PREMIUM' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions/access/bedtime-stories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('hasAccess');
      expect(response.body.hasAccess).toBe(true);
    });

    it('should deny feature access for free user', async () => {
      await prisma.subscription.update({
        where: { userId },
        data: { tier: 'FREE' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/subscriptions/access/bedtime-stories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('hasAccess');
      expect(response.body.hasAccess).toBe(false);
    });
  });

  describe('POST /api/v1/subscriptions/webhook', () => {
    it('should process valid webhook with correct signature', async () => {
      const webhookSecret = configService.get<string>('REVENUECAT_WEBHOOK_SECRET') || 'test-secret';
      
      const webhookPayload = {
        type: 'INITIAL_PURCHASE',
        app_user_id: userId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .set('Authorization', `Bearer ${webhookSecret}`)
        .send(webhookPayload)
        .expect(201);
    });

    it('should reject webhook with invalid signature', async () => {
      // Only test if webhook secret is configured
      const webhookSecret = configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
      if (!webhookSecret) {
        return; // Skip test if no secret configured
      }

      const webhookPayload = {
        type: 'INITIAL_PURCHASE',
        app_user_id: userId,
      };

      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .set('Authorization', 'Bearer invalid-secret')
        .send(webhookPayload)
        .expect(401);
    });

    it('should handle subscription cancellation webhook', async () => {
      const webhookSecret = configService.get<string>('REVENUECAT_WEBHOOK_SECRET') || 'test-secret';
      
      const webhookPayload = {
        type: 'CANCELLATION',
        app_user_id: userId,
      };

      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .set('Authorization', `Bearer ${webhookSecret}`)
        .send(webhookPayload)
        .expect(201);
    });

    it('should handle subscription renewal webhook', async () => {
      const webhookSecret = configService.get<string>('REVENUECAT_WEBHOOK_SECRET') || 'test-secret';
      
      const webhookPayload = {
        type: 'RENEWAL',
        app_user_id: userId,
        product_id: 'com.restorae.premium.monthly',
        expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .set('Authorization', `Bearer ${webhookSecret}`)
        .send(webhookPayload)
        .expect(201);
    });
  });

  describe('POST /api/v1/subscriptions/cancel', () => {
    it('should cancel subscription', async () => {
      // Ensure user has subscription first
      await prisma.subscription.update({
        where: { userId },
        data: { tier: 'PREMIUM' },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/v1/subscriptions/restore', () => {
    it('should restore purchases', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/restore')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('tier');
    });
  });
});

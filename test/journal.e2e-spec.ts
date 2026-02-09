/**
 * Journal E2E Tests
 * 
 * Tests for journal functionality including XSS protection.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('JournalController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;
  let journalEntryId: string;

  const testUser = {
    email: 'journal-test@restorae.com',
    password: 'SecurePassword123!',
    name: 'Journal Test User',
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
    await prisma.journalEntry.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await app.close();
  });

  describe('POST /api/v1/journal', () => {
    it('should create a journal entry', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/journal')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'My First Entry',
          content: 'Today was a good day.',
          tags: ['gratitude', 'happiness'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('My First Entry');
      journalEntryId = response.body.id;
    });

    it('should sanitize XSS in journal content', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/journal')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '<script>alert("xss")</script>My Title',
          content: 'Hello<script>alert("xss")</script>World<img onerror="alert(1)" src="x">',
          tags: ['<script>bad</script>tag'],
        })
        .expect(201);

      // Verify XSS is sanitized
      expect(response.body.title).not.toContain('<script>');
      expect(response.body.content).not.toContain('<script>');
      expect(response.body.content).not.toContain('onerror');
    });

    it('should reject empty content', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/journal')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Title',
          content: '',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/journal', () => {
    it('should list journal entries', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/journal')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/journal?limit=1&offset=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.length).toBe(1);
    });
  });

  describe('GET /api/v1/journal/:id', () => {
    it('should get a single journal entry', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/journal/${journalEntryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(journalEntryId);
    });

    it('should return 404 for non-existent entry', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/journal/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/journal/:id', () => {
    it('should update a journal entry', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/journal/${journalEntryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content.',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
    });

    it('should sanitize XSS on update', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/journal/${journalEntryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Safe content<script>evil()</script>',
        })
        .expect(200);

      expect(response.body.content).not.toContain('<script>');
    });
  });

  describe('GET /api/v1/journal/search', () => {
    it('should search journal entries', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/journal/search?q=Updated')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('DELETE /api/v1/journal/:id', () => {
    it('should soft delete a journal entry', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/journal/${journalEntryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Entry should no longer appear in list
      const response = await request(app.getHttpServer())
        .get('/api/v1/journal')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const deletedEntry = response.body.find((e: { id: string }) => e.id === journalEntryId);
      expect(deletedEntry).toBeUndefined();
    });
  });
});

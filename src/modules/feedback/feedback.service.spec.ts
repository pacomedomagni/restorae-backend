import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { FeedbackType } from '@prisma/client';
import { FeedbackService } from './feedback.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-123';

function buildFeedback(overrides: Record<string, any> = {}) {
  return {
    id: 'feedback-1',
    userId: TEST_USER_ID,
    type: FeedbackType.BUG,
    subject: 'App crash',
    message: 'The app crashes when I open settings',
    email: 'test@example.com',
    status: 'OPEN',
    deviceInfo: { platform: 'ios', version: '1.0.0' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildFAQ(overrides: Record<string, any> = {}) {
  return {
    id: 'faq-1',
    question: 'How do I reset my password?',
    answer: 'Go to settings and tap "Reset Password".',
    category: 'account',
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('FeedbackService', () => {
  let service: FeedbackService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // submit
  // =========================================================================
  describe('submit', () => {
    it('should create feedback for an authenticated user', async () => {
      const data = {
        type: FeedbackType.BUG,
        subject: 'App crash',
        message: 'Crashes on settings page',
        email: 'test@example.com',
        deviceInfo: { platform: 'ios' },
      };

      const created = buildFeedback(data);
      prisma.feedback.create.mockResolvedValue(created as any);

      const result = await service.submit(TEST_USER_ID, data);

      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          type: FeedbackType.BUG,
          subject: 'App crash',
          message: 'Crashes on settings page',
          email: 'test@example.com',
          deviceInfo: { platform: 'ios' },
        },
      });
      expect(result.id).toBe('feedback-1');
      expect(result.type).toBe(FeedbackType.BUG);
    });

    it('should create feedback for an anonymous (null) user', async () => {
      const data = {
        type: FeedbackType.FEATURE_REQUEST,
        message: 'Add dark mode please',
      };

      const created = buildFeedback({ ...data, userId: null, subject: undefined, email: undefined, deviceInfo: undefined });
      prisma.feedback.create.mockResolvedValue(created as any);

      const result = await service.submit(null, data);

      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: {
          userId: null,
          type: FeedbackType.FEATURE_REQUEST,
          subject: undefined,
          message: 'Add dark mode please',
          email: undefined,
          deviceInfo: undefined,
        },
      });
      expect(result).toBeDefined();
    });

    it('should create feedback without optional fields', async () => {
      const data = {
        type: FeedbackType.GENERAL,
        message: 'General feedback',
      };

      prisma.feedback.create.mockResolvedValue(
        buildFeedback({ ...data, subject: undefined, email: undefined, deviceInfo: undefined }) as any,
      );

      const result = await service.submit(TEST_USER_ID, data);

      expect(prisma.feedback.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          type: FeedbackType.GENERAL,
          subject: undefined,
          message: 'General feedback',
          email: undefined,
          deviceInfo: undefined,
        },
      });
      expect(result).toBeDefined();
    });

    it('should handle each FeedbackType enum value', async () => {
      for (const feedbackType of Object.values(FeedbackType)) {
        prisma.feedback.create.mockResolvedValue(
          buildFeedback({ type: feedbackType }) as any,
        );

        const result = await service.submit(TEST_USER_ID, {
          type: feedbackType,
          message: `Feedback of type ${feedbackType}`,
        });

        expect(result.type).toBe(feedbackType);
      }
    });
  });

  // =========================================================================
  // getUserFeedback
  // =========================================================================
  describe('getUserFeedback', () => {
    it('should return all feedback for a user ordered by createdAt desc', async () => {
      const feedbacks = [
        buildFeedback({ id: 'f1', createdAt: new Date('2026-02-08') }),
        buildFeedback({ id: 'f2', createdAt: new Date('2026-02-07') }),
      ];
      prisma.feedback.findMany.mockResolvedValue(feedbacks as any);

      const result = await service.getUserFeedback(TEST_USER_ID);

      expect(prisma.feedback.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no feedback', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      const result = await service.getUserFeedback(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // updateStatus
  // =========================================================================
  describe('updateStatus', () => {
    it('should update the status of a feedback entry', async () => {
      const updated = buildFeedback({ status: 'IN_PROGRESS' });
      prisma.feedback.update.mockResolvedValue(updated as any);

      const result = await service.updateStatus('feedback-1', 'IN_PROGRESS');

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: 'feedback-1' },
        data: { status: 'IN_PROGRESS' },
      });
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should update status to RESOLVED', async () => {
      const updated = buildFeedback({ status: 'RESOLVED' });
      prisma.feedback.update.mockResolvedValue(updated as any);

      const result = await service.updateStatus('feedback-1', 'RESOLVED');

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: 'feedback-1' },
        data: { status: 'RESOLVED' },
      });
      expect(result.status).toBe('RESOLVED');
    });

    it('should update status to CLOSED', async () => {
      const updated = buildFeedback({ status: 'CLOSED' });
      prisma.feedback.update.mockResolvedValue(updated as any);

      const result = await service.updateStatus('feedback-1', 'CLOSED');

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: 'feedback-1' },
        data: { status: 'CLOSED' },
      });
      expect(result.status).toBe('CLOSED');
    });
  });

  // =========================================================================
  // getAllFeedback
  // =========================================================================
  describe('getAllFeedback', () => {
    it('should return paginated feedback with user info using defaults', async () => {
      const feedbacks = [
        buildFeedback({ user: { id: TEST_USER_ID, email: 'test@example.com', name: 'Test' } }),
      ];
      prisma.feedback.findMany.mockResolvedValue(feedbacks as any);

      const result = await service.getAllFeedback();

      expect(prisma.feedback.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should respect custom limit and offset', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.getAllFeedback(10, 20);

      expect(prisma.feedback.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });
    });

    it('should return empty array when no feedback exists', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      const result = await service.getAllFeedback();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getFAQs
  // =========================================================================
  describe('getFAQs', () => {
    it('should return active FAQs ordered by order ascending', async () => {
      const faqs = [
        buildFAQ({ order: 1 }),
        buildFAQ({ id: 'faq-2', order: 2, question: 'How do I export data?' }),
      ];
      prisma.fAQ.findMany.mockResolvedValue(faqs as any);

      const result = await service.getFAQs();

      expect(prisma.fAQ.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no active FAQs exist', async () => {
      prisma.fAQ.findMany.mockResolvedValue([]);

      const result = await service.getFAQs();

      expect(result).toEqual([]);
    });
  });
});

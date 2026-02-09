import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ===========================================================================
  // getDashboardStats
  // ===========================================================================
  describe('getDashboardStats', () => {
    it('should return all dashboard statistics with correct conversion rate', async () => {
      prisma.user.count.mockResolvedValue(200);
      prisma.device.count
        .mockResolvedValueOnce(50)   // activeToday (DAU)
        .mockResolvedValueOnce(150); // activeMonth (MAU)
      prisma.subscription.count.mockResolvedValue(40);
      prisma.moodEntry.count.mockResolvedValue(1200);
      prisma.journalEntry.count.mockResolvedValue(800);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalUsers: 200,
        dau: 50,
        mau: 150,
        premiumUsers: 40,
        conversionRate: '20.00',
        totalMoodEntries: 1200,
        totalJournalEntries: 800,
      });
    });

    it('should return 0 conversion rate when there are no users', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.device.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.subscription.count.mockResolvedValue(0);
      prisma.moodEntry.count.mockResolvedValue(0);
      prisma.journalEntry.count.mockResolvedValue(0);

      const result = await service.getDashboardStats();

      expect(result.conversionRate).toBe(0);
      expect(result.totalUsers).toBe(0);
      expect(result.dau).toBe(0);
      expect(result.mau).toBe(0);
    });

    it('should query users excluding soft-deleted records', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.device.count.mockResolvedValue(0);
      prisma.subscription.count.mockResolvedValue(0);
      prisma.moodEntry.count.mockResolvedValue(0);
      prisma.journalEntry.count.mockResolvedValue(0);

      await service.getDashboardStats();

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it('should query premium subscriptions excluding FREE tier', async () => {
      prisma.user.count.mockResolvedValue(10);
      prisma.device.count.mockResolvedValue(0);
      prisma.subscription.count.mockResolvedValue(3);
      prisma.moodEntry.count.mockResolvedValue(0);
      prisma.journalEntry.count.mockResolvedValue(0);

      await service.getDashboardStats();

      expect(prisma.subscription.count).toHaveBeenCalledWith({
        where: { tier: { not: 'FREE' } },
      });
    });

    it('should query mood and journal entries excluding soft-deleted', async () => {
      prisma.user.count.mockResolvedValue(5);
      prisma.device.count.mockResolvedValue(0);
      prisma.subscription.count.mockResolvedValue(0);
      prisma.moodEntry.count.mockResolvedValue(100);
      prisma.journalEntry.count.mockResolvedValue(50);

      await service.getDashboardStats();

      expect(prisma.moodEntry.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(prisma.journalEntry.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it('should calculate fractional conversion rate correctly', async () => {
      prisma.user.count.mockResolvedValue(3);
      prisma.device.count.mockResolvedValue(0);
      prisma.subscription.count.mockResolvedValue(1);
      prisma.moodEntry.count.mockResolvedValue(0);
      prisma.journalEntry.count.mockResolvedValue(0);

      const result = await service.getDashboardStats();

      // 1/3 * 100 = 33.33...
      expect(result.conversionRate).toBe('33.33');
    });
  });

  // ===========================================================================
  // getContentStats
  // ===========================================================================
  describe('getContentStats', () => {
    it('should return grouped content stats by type and status', async () => {
      const mockStats = [
        { type: 'BREATHING', status: 'PUBLISHED', _count: 5 },
        { type: 'BREATHING', status: 'DRAFT', _count: 2 },
        { type: 'GROUNDING', status: 'PUBLISHED', _count: 3 },
      ];

      (prisma.contentItem.groupBy as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getContentStats();

      expect(prisma.contentItem.groupBy).toHaveBeenCalledWith({
        by: ['type', 'status'],
        _count: true,
      });
      expect(result).toEqual(mockStats);
      expect(result).toHaveLength(3);
    });

    it('should return an empty array when no content items exist', async () => {
      (prisma.contentItem.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getContentStats();

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // getRecentFeedback
  // ===========================================================================
  describe('getRecentFeedback', () => {
    const mockFeedback = [
      {
        id: 'fb-1',
        userId: 'user-1',
        type: 'BUG',
        message: 'App crashes on launch',
        status: 'NEW',
        createdAt: new Date('2026-02-08T10:00:00Z'),
        user: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
      },
    ];

    it('should return recent feedback with default limit of 10', async () => {
      prisma.feedback.findMany.mockResolvedValue(mockFeedback as any);

      const result = await service.getRecentFeedback();

      expect(prisma.feedback.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });
      expect(result).toEqual(mockFeedback);
    });

    it('should accept a custom limit parameter', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.getRecentFeedback(5);

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should coerce string limit to number', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      // The service uses Number(limit) to handle string inputs
      await service.getRecentFeedback('20' as any);

      expect(prisma.feedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  // ===========================================================================
  // createAuditLog
  // ===========================================================================
  describe('createAuditLog', () => {
    it('should create an audit log with all fields', async () => {
      const auditData = {
        userId: 'user-1',
        adminId: 'admin-1',
        action: 'DISABLE_USER',
        resource: 'User',
        resourceId: 'user-1',
        oldValue: { isActive: true },
        newValue: { isActive: false },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const mockCreated = {
        id: 'audit-1',
        ...auditData,
        createdAt: new Date(),
      };

      prisma.auditLog.create.mockResolvedValue(mockCreated as any);

      const result = await service.createAuditLog(auditData);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: auditData,
      });
      expect(result).toEqual(mockCreated);
    });

    it('should create an audit log with only required fields', async () => {
      const minimalData = {
        adminId: 'admin-1',
        action: 'VIEW_DASHBOARD',
        resource: 'Dashboard',
      };

      const mockCreated = {
        id: 'audit-2',
        ...minimalData,
        userId: null,
        resourceId: null,
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      };

      prisma.auditLog.create.mockResolvedValue(mockCreated as any);

      const result = await service.createAuditLog(minimalData);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: minimalData,
      });
      expect(result.id).toBe('audit-2');
    });
  });

  // ===========================================================================
  // getAuditLogs
  // ===========================================================================
  describe('getAuditLogs', () => {
    const mockLogs = [
      {
        id: 'audit-1',
        adminId: 'admin-1',
        action: 'DISABLE_USER',
        resource: 'User',
        createdAt: new Date('2026-02-08T12:00:00Z'),
        user: { id: 'user-1', email: 'user@test.com', name: 'Test User' },
        admin: { id: 'admin-1', email: 'admin@test.com', name: 'Admin' },
      },
    ];

    it('should return audit logs with default limit 50 and offset 0', async () => {
      prisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.getAuditLogs();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
        include: {
          user: { select: { id: true, email: true, name: true } },
          admin: { select: { id: true, email: true, name: true } },
        },
      });
      expect(result).toEqual(mockLogs);
    });

    it('should apply custom limit and offset', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.getAuditLogs(10, 20);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should coerce string parameters to numbers', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      // The service uses Number(limit) and Number(offset) to handle string inputs
      await service.getAuditLogs('25' as any, '5' as any);

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 5,
        }),
      );
    });

    it('should include both user and admin relations', async () => {
      prisma.auditLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await service.getAuditLogs();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: { select: { id: true, email: true, name: true } },
            admin: { select: { id: true, email: true, name: true } },
          },
        }),
      );
      expect(result[0].user).toBeDefined();
      expect(result[0].admin).toBeDefined();
    });
  });
});

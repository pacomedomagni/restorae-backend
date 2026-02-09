import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-123';

function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: TEST_USER_ID,
    email: 'test@example.com',
    passwordHash: 'hashed-pw',
    name: 'Test User',
    timezone: 'America/New_York',
    locale: 'en',
    avatarUrl: null,
    isActive: true,
    onboardingCompleted: false,
    emailVerified: false,
    appleId: null,
    googleId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: { id: 'pref-1', theme: 'system' },
    subscription: { id: 'sub-1', tier: 'FREE' },
    ...overrides,
  };
}

function buildPreference(overrides: Record<string, any> = {}) {
  return {
    id: 'pref-1',
    userId: TEST_USER_ID,
    theme: 'system',
    soundsEnabled: true,
    hapticsEnabled: true,
    lockMethod: 'NONE',
    lockOnBackground: false,
    lockTimeout: 0,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    ...overrides,
  };
}

function buildDevice(overrides: Record<string, any> = {}) {
  return {
    id: 'dev-1',
    userId: TEST_USER_ID,
    deviceId: 'device-abc',
    platform: 'ios',
    pushToken: null,
    appVersion: '1.0.0',
    osVersion: '17.0',
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // findById
  // =========================================================================
  describe('findById', () => {
    it('should return user without passwordHash when found', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);

      const result = await service.findById(TEST_USER_ID);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        include: { preferences: true, subscription: true },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
      expect(result.preferences).toBeDefined();
      expect(result.subscription).toBeDefined();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent')).rejects.toThrow('User not found');
    });
  });

  // =========================================================================
  // updateProfile
  // =========================================================================
  describe('updateProfile', () => {
    it('should update profile fields and return user without passwordHash', async () => {
      const dto: UpdateProfileDto = {
        name: 'New Name',
        timezone: 'Europe/London',
        locale: 'fr',
        avatarUrl: 'https://example.com/avatar.png',
      };

      const updated = buildUser({ ...dto });
      prisma.user.update.mockResolvedValue(updated as any);

      const result = await service.updateProfile(TEST_USER_ID, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          name: 'New Name',
          timezone: 'Europe/London',
          locale: 'fr',
          avatarUrl: 'https://example.com/avatar.png',
        },
        include: { preferences: true, subscription: true },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.name).toBe('New Name');
    });

    it('should allow partial profile updates', async () => {
      const dto: UpdateProfileDto = { name: 'Only Name' };

      prisma.user.update.mockResolvedValue(
        buildUser({ name: 'Only Name' }) as any,
      );

      const result = await service.updateProfile(TEST_USER_ID, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          name: 'Only Name',
          timezone: undefined,
          locale: undefined,
          avatarUrl: undefined,
        },
        include: { preferences: true, subscription: true },
      });
      expect(result.name).toBe('Only Name');
    });
  });

  // =========================================================================
  // updatePreferences
  // =========================================================================
  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const dto: UpdatePreferencesDto = {
        theme: 'dark',
        soundsEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      };

      const updatedPref = buildPreference({ ...dto });
      prisma.preference.update.mockResolvedValue(updatedPref as any);

      const result = await service.updatePreferences(TEST_USER_ID, dto);

      expect(prisma.preference.update).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        data: dto,
      });
      expect(result.theme).toBe('dark');
      expect(result.quietHoursEnabled).toBe(true);
    });
  });

  // =========================================================================
  // completeOnboarding
  // =========================================================================
  describe('completeOnboarding', () => {
    it('should set onboardingCompleted to true', async () => {
      const updated = buildUser({ onboardingCompleted: true });
      prisma.user.update.mockResolvedValue(updated as any);

      const result = await service.completeOnboarding(TEST_USER_ID);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { onboardingCompleted: true },
      });
      expect(result.onboardingCompleted).toBe(true);
    });
  });

  // =========================================================================
  // getDevices
  // =========================================================================
  describe('getDevices', () => {
    it('should return devices ordered by lastActiveAt descending', async () => {
      const devices = [
        buildDevice({ deviceId: 'd1', lastActiveAt: new Date('2026-02-08') }),
        buildDevice({ deviceId: 'd2', lastActiveAt: new Date('2026-02-07') }),
      ];
      prisma.device.findMany.mockResolvedValue(devices as any);

      const result = await service.getDevices(TEST_USER_ID);

      expect(prisma.device.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { lastActiveAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no devices', async () => {
      prisma.device.findMany.mockResolvedValue([]);

      const result = await service.getDevices(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // removeDevice
  // =========================================================================
  describe('removeDevice', () => {
    it('should delete device matching userId and deviceId', async () => {
      prisma.device.deleteMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.removeDevice(TEST_USER_ID, 'device-abc');

      expect(prisma.device.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID, deviceId: 'device-abc' },
      });
      expect(result).toEqual({ count: 1 });
    });

    it('should return count 0 when device does not exist', async () => {
      prisma.device.deleteMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.removeDevice(TEST_USER_ID, 'nonexistent');

      expect(result).toEqual({ count: 0 });
    });
  });

  // =========================================================================
  // exportData
  // =========================================================================
  describe('exportData', () => {
    it('should return exported data without passwordHash and without locked journal entries', async () => {
      const user = buildUser({
        moodEntries: [
          { id: 'm1', mood: 'GOOD', timestamp: new Date(), deletedAt: null },
        ],
        journalEntries: [
          { id: 'j1', title: 'Open', content: 'public', tags: [], createdAt: new Date(), isLocked: false },
          { id: 'j2', title: 'Secret', content: 'private', tags: [], createdAt: new Date(), isLocked: true },
        ],
        customRituals: [],
        ritualCompletions: [],
        weeklyGoals: [],
      });

      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.exportData(TEST_USER_ID);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        include: {
          preferences: true,
          moodEntries: { where: { deletedAt: null } },
          journalEntries: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              content: true,
              tags: true,
              createdAt: true,
              isLocked: true,
            },
          },
          customRituals: { include: { steps: true } },
          ritualCompletions: true,
          weeklyGoals: true,
        },
      });

      // Locked journal entries should be filtered out
      expect(result.journalEntries).toHaveLength(1);
      expect(result.journalEntries[0].id).toBe('j1');
      // isLocked should be stripped from each returned entry
      expect(result.journalEntries[0]).not.toHaveProperty('isLocked');

      // Structure checks
      expect(result.exportedAt).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.moodEntries).toHaveLength(1);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.exportData('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.exportData('nonexistent')).rejects.toThrow('User not found');
    });
  });

  // =========================================================================
  // deleteAccount
  // =========================================================================
  describe('deleteAccount', () => {
    it('should soft-delete user, clear PII, and invalidate all sessions', async () => {
      prisma.user.update.mockResolvedValue({} as any);
      prisma.session.deleteMany.mockResolvedValue({ count: 3 } as any);

      const result = await service.deleteAccount(TEST_USER_ID);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
          email: null,
          name: null,
        },
      });
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
      expect(result).toEqual({ success: true });
    });

    it('should return success even when there are no sessions to delete', async () => {
      prisma.user.update.mockResolvedValue({} as any);
      prisma.session.deleteMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.deleteAccount(TEST_USER_ID);

      expect(result).toEqual({ success: true });
    });
  });
});

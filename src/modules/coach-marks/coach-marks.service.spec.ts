import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CoachMarksService } from './coach-marks.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-123';

function buildCoachMark(overrides: Record<string, any> = {}) {
  return {
    id: 'cm-1',
    key: 'sanctuary_mood_orbs',
    screen: 'sanctuary',
    targetId: 'mood-orbs-container',
    title: 'Track Your Mood',
    description: 'Tap an orb to log how you feel right now.',
    position: 'bottom',
    order: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildUser(overrides: Record<string, any> = {}) {
  return {
    preferences: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('CoachMarksService', () => {
  let service: CoachMarksService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachMarksService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get<CoachMarksService>(CoachMarksService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // getAll
  // =========================================================================
  describe('getAll', () => {
    it('should return active coach marks ordered by order ascending', async () => {
      const coachMarks = [
        buildCoachMark({ id: 'cm-1', order: 1 }),
        buildCoachMark({ id: 'cm-2', order: 2, key: 'sanctuary_offerings' }),
      ];
      prisma.coachMark.findMany.mockResolvedValue(coachMarks as any);

      const result = await service.getAll();

      expect(prisma.coachMark.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no active coach marks exist', async () => {
      prisma.coachMark.findMany.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getByScreen
  // =========================================================================
  describe('getByScreen', () => {
    it('should return active coach marks for the given screen', async () => {
      const coachMarks = [
        buildCoachMark({ screen: 'practice', key: 'practice_programs' }),
        buildCoachMark({ id: 'cm-2', screen: 'practice', key: 'practice_breathing', order: 2 }),
      ];
      prisma.coachMark.findMany.mockResolvedValue(coachMarks as any);

      const result = await service.getByScreen('practice');

      expect(prisma.coachMark.findMany).toHaveBeenCalledWith({
        where: { screen: 'practice', isActive: true },
        orderBy: { order: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no coach marks exist for the screen', async () => {
      prisma.coachMark.findMany.mockResolvedValue([]);

      const result = await service.getByScreen('nonexistent-screen');

      expect(prisma.coachMark.findMany).toHaveBeenCalledWith({
        where: { screen: 'nonexistent-screen', isActive: true },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getByKey
  // =========================================================================
  describe('getByKey', () => {
    it('should return a coach mark when found by key', async () => {
      const coachMark = buildCoachMark();
      prisma.coachMark.findUnique.mockResolvedValue(coachMark as any);

      const result = await service.getByKey('sanctuary_mood_orbs');

      expect(prisma.coachMark.findUnique).toHaveBeenCalledWith({
        where: { key: 'sanctuary_mood_orbs' },
      });
      expect(result).toEqual(coachMark);
    });

    it('should throw NotFoundException when coach mark is not found', async () => {
      prisma.coachMark.findUnique.mockResolvedValue(null);

      await expect(service.getByKey('nonexistent_key')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException with the correct message', async () => {
      prisma.coachMark.findUnique.mockResolvedValue(null);

      await expect(service.getByKey('missing_key')).rejects.toThrow(
        'Coach mark missing_key not found',
      );
    });
  });

  // =========================================================================
  // markAsSeen
  // =========================================================================
  describe('markAsSeen', () => {
    it('should add a key to the user seenCoachMarks array', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ preferences: { seenCoachMarks: [] } }) as any,
      );
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.markAsSeen(TEST_USER_ID, 'sanctuary_mood_orbs');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { preferences: true },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          preferences: {
            seenCoachMarks: ['sanctuary_mood_orbs'],
          },
        },
      });
      expect(result).toEqual({ success: true, key: 'sanctuary_mood_orbs' });
    });

    it('should not duplicate a key that is already in seenCoachMarks', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ preferences: { seenCoachMarks: ['sanctuary_mood_orbs'] } }) as any,
      );
      prisma.user.update.mockResolvedValue({} as any);

      await service.markAsSeen(TEST_USER_ID, 'sanctuary_mood_orbs');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          preferences: {
            seenCoachMarks: ['sanctuary_mood_orbs'],
          },
        },
      });
    });

    it('should append to existing seenCoachMarks without losing previous entries', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({
          preferences: {
            seenCoachMarks: ['sanctuary_mood_orbs', 'practice_programs'],
            otherPref: true,
          },
        }) as any,
      );
      prisma.user.update.mockResolvedValue({} as any);

      await service.markAsSeen(TEST_USER_ID, 'journey_stats');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          preferences: {
            seenCoachMarks: ['sanctuary_mood_orbs', 'practice_programs', 'journey_stats'],
            otherPref: true,
          },
        },
      });
    });

    it('should handle user with null preferences gracefully', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ preferences: null }) as any,
      );
      prisma.user.update.mockResolvedValue({} as any);

      await service.markAsSeen(TEST_USER_ID, 'sanctuary_mood_orbs');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          preferences: {
            seenCoachMarks: ['sanctuary_mood_orbs'],
          },
        },
      });
    });

    it('should handle user not found (null user) gracefully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({} as any);

      await service.markAsSeen(TEST_USER_ID, 'some_key');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          preferences: {
            seenCoachMarks: ['some_key'],
          },
        },
      });
    });
  });

  // =========================================================================
  // getSeenCoachMarks
  // =========================================================================
  describe('getSeenCoachMarks', () => {
    it('should return seenCoachMarks array from user preferences', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({
          preferences: { seenCoachMarks: ['sanctuary_mood_orbs', 'practice_programs'] },
        }) as any,
      );

      const result = await service.getSeenCoachMarks(TEST_USER_ID);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { preferences: true },
      });
      expect(result).toEqual(['sanctuary_mood_orbs', 'practice_programs']);
    });

    it('should return empty array when user has no preferences', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ preferences: null }) as any,
      );

      const result = await service.getSeenCoachMarks(TEST_USER_ID);

      expect(result).toEqual([]);
    });

    it('should return empty array when preferences exist but seenCoachMarks is not set', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ preferences: { theme: 'dark' } }) as any,
      );

      const result = await service.getSeenCoachMarks(TEST_USER_ID);

      expect(result).toEqual([]);
    });

    it('should return empty array when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getSeenCoachMarks(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // resetSeenCoachMarks
  // =========================================================================
  describe('resetSeenCoachMarks', () => {
    it('should remove seenCoachMarks from preferences while keeping other prefs', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({
          preferences: {
            seenCoachMarks: ['sanctuary_mood_orbs'],
            theme: 'dark',
            notifications: true,
          },
        }) as any,
      );
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.resetSeenCoachMarks(TEST_USER_ID);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          preferences: {
            theme: 'dark',
            notifications: true,
          },
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('should handle reset when preferences are null', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ preferences: null }) as any,
      );
      prisma.user.update.mockResolvedValue({} as any);

      const result = await service.resetSeenCoachMarks(TEST_USER_ID);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { preferences: {} },
      });
      expect(result).toEqual({ success: true });
    });
  });

  // =========================================================================
  // getAllAdmin
  // =========================================================================
  describe('getAllAdmin', () => {
    it('should return all coach marks ordered by screen then order', async () => {
      const coachMarks = [
        buildCoachMark({ screen: 'journey', order: 1 }),
        buildCoachMark({ id: 'cm-2', screen: 'journey', order: 2 }),
        buildCoachMark({ id: 'cm-3', screen: 'sanctuary', order: 1 }),
      ];
      prisma.coachMark.findMany.mockResolvedValue(coachMarks as any);

      const result = await service.getAllAdmin();

      expect(prisma.coachMark.findMany).toHaveBeenCalledWith({
        orderBy: [{ screen: 'asc' }, { order: 'asc' }],
      });
      expect(result).toHaveLength(3);
    });

    it('should include inactive coach marks', async () => {
      const coachMarks = [
        buildCoachMark({ isActive: true }),
        buildCoachMark({ id: 'cm-2', isActive: false }),
      ];
      prisma.coachMark.findMany.mockResolvedValue(coachMarks as any);

      const result = await service.getAllAdmin();

      // No where clause filtering by isActive
      expect(prisma.coachMark.findMany).toHaveBeenCalledWith({
        orderBy: [{ screen: 'asc' }, { order: 'asc' }],
      });
      expect(result).toHaveLength(2);
    });
  });

  // =========================================================================
  // create
  // =========================================================================
  describe('create', () => {
    it('should create a new coach mark with all fields', async () => {
      const data = {
        key: 'practice_focus',
        screen: 'practice',
        targetId: 'focus-section',
        title: 'Focus Timer',
        description: 'Start a focus session to boost productivity.',
        position: 'top',
        order: 3,
        isActive: true,
      };

      const created = buildCoachMark(data);
      prisma.coachMark.create.mockResolvedValue(created as any);

      const result = await service.create(data);

      expect(prisma.coachMark.create).toHaveBeenCalledWith({ data });
      expect(result.key).toBe('practice_focus');
      expect(result.screen).toBe('practice');
    });

    it('should create a coach mark with only required fields', async () => {
      const data = {
        key: 'you_settings',
        screen: 'you',
        targetId: 'settings-btn',
        title: 'Settings',
        description: 'Customize your experience.',
      };

      const created = buildCoachMark(data);
      prisma.coachMark.create.mockResolvedValue(created as any);

      const result = await service.create(data);

      expect(prisma.coachMark.create).toHaveBeenCalledWith({ data });
      expect(result.key).toBe('you_settings');
    });
  });

  // =========================================================================
  // update
  // =========================================================================
  describe('update', () => {
    it('should update a coach mark with partial data', async () => {
      const updateData = { title: 'Updated Title', order: 5 };
      const updated = buildCoachMark(updateData);
      prisma.coachMark.update.mockResolvedValue(updated as any);

      const result = await service.update('cm-1', updateData);

      expect(prisma.coachMark.update).toHaveBeenCalledWith({
        where: { id: 'cm-1' },
        data: updateData,
      });
      expect(result.title).toBe('Updated Title');
      expect(result.order).toBe(5);
    });

    it('should update isActive to deactivate a coach mark', async () => {
      const updateData = { isActive: false };
      const updated = buildCoachMark(updateData);
      prisma.coachMark.update.mockResolvedValue(updated as any);

      const result = await service.update('cm-1', updateData);

      expect(prisma.coachMark.update).toHaveBeenCalledWith({
        where: { id: 'cm-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });

  // =========================================================================
  // delete
  // =========================================================================
  describe('delete', () => {
    it('should delete a coach mark by id', async () => {
      const deleted = buildCoachMark();
      prisma.coachMark.delete.mockResolvedValue(deleted as any);

      const result = await service.delete('cm-1');

      expect(prisma.coachMark.delete).toHaveBeenCalledWith({
        where: { id: 'cm-1' },
      });
      expect(result).toEqual(deleted);
    });
  });
});

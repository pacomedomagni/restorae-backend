import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotificationsService } from './notifications.service';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { PrismaService } from '../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Suppress logger output during tests
// ---------------------------------------------------------------------------
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-123';
const TEST_DEVICE_ID = 'device-abc';
const TEST_PUSH_TOKEN = 'push-token-xyz';

function buildDevice(overrides: Record<string, any> = {}) {
  return {
    id: 'dev-1',
    userId: TEST_USER_ID,
    deviceId: TEST_DEVICE_ID,
    platform: 'ios',
    pushToken: TEST_PUSH_TOKEN,
    appVersion: '1.0.0',
    osVersion: '17.0',
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildReminder(overrides: Record<string, any> = {}) {
  return {
    id: 'reminder-1',
    userId: TEST_USER_ID,
    type: 'mood',
    label: 'Morning check-in',
    time: '08:00',
    enabled: true,
    ritualId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildCampaign(overrides: Record<string, any> = {}) {
  return {
    id: 'campaign-1',
    title: 'Test Campaign',
    body: 'Hello everyone',
    data: null,
    scheduledFor: null,
    sentAt: null,
    sentCount: 0,
    createdBy: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: DeepMockProxy<PrismaService>;
  let fcm: DeepMockProxy<FirebaseMessagingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: FirebaseMessagingService, useValue: mockDeep<FirebaseMessagingService>() },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
    fcm = module.get(FirebaseMessagingService) as DeepMockProxy<FirebaseMessagingService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // registerPushToken
  // =========================================================================
  describe('registerPushToken', () => {
    it('should update the device with the push token', async () => {
      const device = buildDevice();
      prisma.device.update.mockResolvedValue(device as any);

      const result = await service.registerPushToken(TEST_USER_ID, TEST_DEVICE_ID, TEST_PUSH_TOKEN);

      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { deviceId: TEST_DEVICE_ID },
        data: { pushToken: TEST_PUSH_TOKEN },
      });
      expect(result).toEqual(device);
    });
  });

  // =========================================================================
  // unregisterPushToken
  // =========================================================================
  describe('unregisterPushToken', () => {
    it('should set pushToken to null on the device', async () => {
      const device = buildDevice({ pushToken: null });
      prisma.device.update.mockResolvedValue(device as any);

      const result = await service.unregisterPushToken(TEST_DEVICE_ID);

      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { deviceId: TEST_DEVICE_ID },
        data: { pushToken: null },
      });
      expect(result.pushToken).toBeNull();
    });
  });

  // =========================================================================
  // getReminders
  // =========================================================================
  describe('getReminders', () => {
    it('should return reminders for a user ordered by time ascending', async () => {
      const reminders = [
        buildReminder({ time: '08:00' }),
        buildReminder({ id: 'reminder-2', time: '20:00' }),
      ];
      prisma.reminder.findMany.mockResolvedValue(reminders as any);

      const result = await service.getReminders(TEST_USER_ID);

      expect(prisma.reminder.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        orderBy: { time: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no reminders', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      const result = await service.getReminders(TEST_USER_ID);

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // createReminder
  // =========================================================================
  describe('createReminder', () => {
    it('should create a reminder with all fields', async () => {
      const data = {
        type: 'mood',
        label: 'Evening reflection',
        time: '21:00',
        ritualId: 'ritual-1',
      };
      const reminder = buildReminder({ ...data });
      prisma.reminder.create.mockResolvedValue(reminder as any);

      const result = await service.createReminder(TEST_USER_ID, data);

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          type: 'mood',
          label: 'Evening reflection',
          time: '21:00',
          ritualId: 'ritual-1',
        },
      });
      expect(result).toEqual(reminder);
    });

    it('should create a reminder without optional ritualId', async () => {
      const data = { type: 'journal', label: 'Write journal', time: '22:00' };
      const reminder = buildReminder({ ...data, ritualId: undefined });
      prisma.reminder.create.mockResolvedValue(reminder as any);

      const result = await service.createReminder(TEST_USER_ID, data);

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          type: 'journal',
          label: 'Write journal',
          time: '22:00',
          ritualId: undefined,
        },
      });
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // updateReminder
  // =========================================================================
  describe('updateReminder', () => {
    it('should update a reminder when it belongs to the user', async () => {
      const existing = buildReminder();
      prisma.reminder.findFirst.mockResolvedValue(existing as any);
      const updated = buildReminder({ label: 'Updated label' });
      prisma.reminder.update.mockResolvedValue(updated as any);

      const result = await service.updateReminder(TEST_USER_ID, 'reminder-1', {
        label: 'Updated label',
      });

      expect(prisma.reminder.findFirst).toHaveBeenCalledWith({
        where: { id: 'reminder-1', userId: TEST_USER_ID },
      });
      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: { label: 'Updated label' },
      });
      expect(result.label).toBe('Updated label');
    });

    it('should throw NotFoundException when reminder does not belong to user', async () => {
      prisma.reminder.findFirst.mockResolvedValue(null);

      await expect(
        service.updateReminder(TEST_USER_ID, 'nonexistent', { label: 'New' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateReminder(TEST_USER_ID, 'nonexistent', { label: 'New' }),
      ).rejects.toThrow('Reminder not found');

      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // deleteReminder
  // =========================================================================
  describe('deleteReminder', () => {
    it('should delete reminders matching id and userId', async () => {
      prisma.reminder.deleteMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.deleteReminder(TEST_USER_ID, 'reminder-1');

      expect(prisma.reminder.deleteMany).toHaveBeenCalledWith({
        where: { id: 'reminder-1', userId: TEST_USER_ID },
      });
      expect(result).toEqual({ count: 1 });
    });
  });

  // =========================================================================
  // toggleReminder
  // =========================================================================
  describe('toggleReminder', () => {
    it('should toggle an enabled reminder to disabled', async () => {
      const existing = buildReminder({ enabled: true });
      prisma.reminder.findFirst.mockResolvedValue(existing as any);
      const toggled = buildReminder({ enabled: false });
      prisma.reminder.update.mockResolvedValue(toggled as any);

      const result = await service.toggleReminder(TEST_USER_ID, 'reminder-1');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: { enabled: false },
      });
      expect(result.enabled).toBe(false);
    });

    it('should toggle a disabled reminder to enabled', async () => {
      const existing = buildReminder({ enabled: false });
      prisma.reminder.findFirst.mockResolvedValue(existing as any);
      const toggled = buildReminder({ enabled: true });
      prisma.reminder.update.mockResolvedValue(toggled as any);

      const result = await service.toggleReminder(TEST_USER_ID, 'reminder-1');

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: { enabled: true },
      });
      expect(result.enabled).toBe(true);
    });

    it('should throw NotFoundException when reminder is not found', async () => {
      prisma.reminder.findFirst.mockResolvedValue(null);

      await expect(
        service.toggleReminder(TEST_USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // sendToUser
  // =========================================================================
  describe('sendToUser', () => {
    it('should return { sent: 0, failed: 0 } when user has no devices with push tokens', async () => {
      prisma.device.findMany.mockResolvedValue([]);

      const result = await service.sendToUser(TEST_USER_ID, 'Title', 'Body');

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(fcm.sendRich).not.toHaveBeenCalled();
    });

    it('should send notifications to all user devices and log successes', async () => {
      const devices = [
        buildDevice({ deviceId: 'd1', pushToken: 'tok1' }),
        buildDevice({ deviceId: 'd2', pushToken: 'tok2' }),
      ];
      prisma.device.findMany.mockResolvedValue(devices as any);
      fcm.sendRich.mockResolvedValue({ success: true, messageId: 'msg-1' });
      prisma.notificationLog.create.mockResolvedValue({} as any);

      const result = await service.sendToUser(TEST_USER_ID, 'Hello', 'World');

      expect(fcm.sendRich).toHaveBeenCalledTimes(2);
      expect(prisma.notificationLog.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ sent: 2, failed: 0 });
    });

    it('should handle failed sends and clean up invalid tokens', async () => {
      const devices = [buildDevice({ deviceId: 'd1', pushToken: 'tok1' })];
      prisma.device.findMany.mockResolvedValue(devices as any);
      fcm.sendRich.mockResolvedValue({ success: false, error: 'INVALID_TOKEN' });
      prisma.notificationLog.create.mockResolvedValue({} as any);
      prisma.device.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.sendToUser(TEST_USER_ID, 'Hello', 'World');

      expect(result).toEqual({ sent: 0, failed: 1 });
      // Invalid token should trigger cleanup
      expect(prisma.device.updateMany).toHaveBeenCalledWith({
        where: { deviceId: { in: ['d1'] } },
        data: { pushToken: null },
      });
    });

    it('should pass data payload to fcm.sendRich', async () => {
      const devices = [buildDevice()];
      prisma.device.findMany.mockResolvedValue(devices as any);
      fcm.sendRich.mockResolvedValue({ success: true, messageId: 'msg-1' });
      prisma.notificationLog.create.mockResolvedValue({} as any);

      const data = { screen: 'mood', action: 'open' };
      await service.sendToUser(TEST_USER_ID, 'Title', 'Body', data);

      expect(fcm.sendRich).toHaveBeenCalledWith(
        TEST_PUSH_TOKEN,
        'Title',
        'Body',
        data,
      );
    });
  });

  // =========================================================================
  // cancelCampaign
  // =========================================================================
  describe('cancelCampaign', () => {
    it('should delete an unsent campaign', async () => {
      const campaign = buildCampaign({ sentAt: null });
      prisma.notificationCampaign.findUnique.mockResolvedValue(campaign as any);
      prisma.notificationCampaign.delete.mockResolvedValue(campaign as any);

      const result = await service.cancelCampaign('campaign-1');

      expect(prisma.notificationCampaign.delete).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
      });
      expect(result).toEqual(campaign);
    });

    it('should throw NotFoundException when campaign does not exist', async () => {
      prisma.notificationCampaign.findUnique.mockResolvedValue(null);

      await expect(service.cancelCampaign('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw Error when campaign has already been sent', async () => {
      const campaign = buildCampaign({ sentAt: new Date() });
      prisma.notificationCampaign.findUnique.mockResolvedValue(campaign as any);

      await expect(service.cancelCampaign('campaign-1')).rejects.toThrow(
        'Can only cancel campaigns that have not been sent',
      );
      expect(prisma.notificationCampaign.delete).not.toHaveBeenCalled();
    });
  });
});

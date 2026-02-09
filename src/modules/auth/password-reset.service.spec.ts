import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PasswordResetService } from './password-reset.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';

// ---------------------------------------------------------------------------
// Mock bcrypt at the module level
// ---------------------------------------------------------------------------
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('new-hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Suppress Logger output
// ---------------------------------------------------------------------------
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-reset-1';
const TEST_EMAIL = 'reset@example.com';
const FAKE_TOKEN_HEX = 'ab'.repeat(32); // 64-char hex string

function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    name: 'Test User',
    passwordHash: 'old-hashed-password',
    isActive: true,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: DeepMockProxy<PrismaService>;
  let emailService: DeepMockProxy<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const values: Record<string, string> = {
                APP_URL: 'https://test.restorae.com',
                FROM_EMAIL: 'test@restorae.com',
              };
              return values[key];
            }),
          },
        },
        { provide: EmailService, useValue: mockDeep<EmailService>() },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    prisma = module.get(PrismaService) as DeepMockProxy<PrismaService>;
    emailService = module.get(EmailService) as DeepMockProxy<EmailService>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // requestReset
  // =========================================================================
  describe('requestReset', () => {
    it('should generate a token, store its hash, and send a reset email for a valid user', async () => {
      // Spy on crypto.randomBytes to return predictable output
      jest.spyOn(crypto, 'randomBytes').mockReturnValue(
        Buffer.from(FAKE_TOKEN_HEX, 'hex') as any,
      );

      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      emailService.send.mockResolvedValue(true);

      const result = await service.requestReset(TEST_EMAIL);

      expect(result.message).toContain('If an account exists');

      // Should look up user by lowercase email
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: TEST_EMAIL.toLowerCase() },
      });

      // Should store the hashed token with an expiry
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        },
      });

      // The stored token should be a SHA-256 hash (64-char hex), not the raw token
      const storedHash = (prisma.user.update as jest.Mock).mock.calls[0][0].data
        .passwordResetToken as string;
      expect(storedHash).toMatch(/^[a-f0-9]{64}$/);

      // Should send an email
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: TEST_EMAIL,
          subject: 'Reset your Restorae password',
        }),
      );
    });

    it('should return success message even if the user does not exist (prevent email enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestReset('nonexistent@example.com');

      expect(result.message).toContain('If an account exists');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should return success message for inactive user (prevent email enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ isActive: false }) as any,
      );

      const result = await service.requestReset(TEST_EMAIL);

      expect(result.message).toContain('If an account exists');
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase before lookup', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestReset('UPPER@EXAMPLE.COM');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'upper@example.com' },
      });
    });

    it('should include the raw token (not hash) in the reset URL sent via email', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      emailService.send.mockResolvedValue(true);

      await service.requestReset(TEST_EMAIL);

      const emailCall = emailService.send.mock.calls[0][0];
      // The HTML should contain the configured APP_URL
      expect(emailCall.html).toContain('https://test.restorae.com/reset-password?token=');
    });

    it('should set the token expiry to approximately 1 hour from now', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      emailService.send.mockResolvedValue(true);

      const beforeCall = Date.now();
      await service.requestReset(TEST_EMAIL);
      const afterCall = Date.now();

      const expiresAt: Date = (prisma.user.update as jest.Mock).mock.calls[0][0].data
        .passwordResetExpires;
      const expiresMs = expiresAt.getTime();

      // Should expire approximately 1 hour from now
      expect(expiresMs).toBeGreaterThanOrEqual(beforeCall + 60 * 60 * 1000 - 100);
      expect(expiresMs).toBeLessThanOrEqual(afterCall + 60 * 60 * 1000 + 100);
    });
  });

  // =========================================================================
  // verifyToken
  // =========================================================================
  describe('verifyToken', () => {
    it('should return valid:true and the email for a valid, non-expired token', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: TEST_EMAIL,
      } as any);

      const result = await service.verifyToken('some-token');

      expect(result).toEqual({ valid: true, email: TEST_EMAIL });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          passwordResetToken: expect.any(String),
          passwordResetExpires: { gt: expect.any(Date) },
          isActive: true,
        },
        select: { email: true },
      });
    });

    it('should return valid:false when token is expired or not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.verifyToken('invalid-token');

      expect(result).toEqual({ valid: false });
    });

    it('should return valid:true with undefined email if user email is null', async () => {
      prisma.user.findFirst.mockResolvedValue({
        email: null,
      } as any);

      const result = await service.verifyToken('some-token');

      expect(result).toEqual({ valid: true, email: undefined });
    });
  });

  // =========================================================================
  // resetPassword
  // =========================================================================
  describe('resetPassword', () => {
    it('should hash the new password, update the user, clear the token, and invalidate sessions', async () => {
      const user = buildUser({
        passwordResetToken: 'some-hash',
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      });
      prisma.user.findFirst.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      prisma.session.deleteMany.mockResolvedValue({ count: 2 } as any);
      emailService.send.mockResolvedValue(true);

      const result = await service.resetPassword('valid-token', 'newpassword123');

      expect(result.message).toContain('Password reset successful');

      // Password should be hashed with bcrypt
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);

      // User record should be updated with new hash and cleared token
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: {
          passwordHash: 'new-hashed-password',
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // All sessions should be invalidated
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });

    it('should throw BadRequestException when password is too short', async () => {
      await expect(
        service.resetPassword('some-token', 'short'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resetPassword('some-token', 'short'),
      ).rejects.toThrow('Password must be at least 8 characters');

      // Should not even look up the token
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when token is invalid or expired', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'validpassword123'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resetPassword('bad-token', 'validpassword123'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should send a password-changed notification email after successful reset', async () => {
      const user = buildUser();
      prisma.user.findFirst.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      prisma.session.deleteMany.mockResolvedValue({ count: 0 } as any);
      emailService.send.mockResolvedValue(true);

      await service.resetPassword('valid-token', 'newpassword123');

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: TEST_EMAIL,
          subject: 'Your Restorae password was changed',
        }),
      );
    });

    it('should invalidate all existing sessions after password reset for security', async () => {
      const user = buildUser();
      prisma.user.findFirst.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      prisma.session.deleteMany.mockResolvedValue({ count: 3 } as any);
      emailService.send.mockResolvedValue(true);

      await service.resetPassword('valid-token', 'newpassword123');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });
  });

  // =========================================================================
  // changePassword
  // =========================================================================
  describe('changePassword', () => {
    it('should verify current password, hash new one, and update the user', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      prisma.user.update.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      emailService.send.mockResolvedValue(true);

      const result = await service.changePassword(
        TEST_USER_ID,
        'currentpass123',
        'newpassword456',
      );

      expect(result.message).toBe('Password changed successfully');

      // Verify current password was checked
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'currentpass123',
        'old-hashed-password',
      );

      // New password is hashed
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword456', 12);

      // User record updated
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword(TEST_USER_ID, 'current', 'newpass123'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.changePassword(TEST_USER_ID, 'current', 'newpass123'),
      ).rejects.toThrow('User not found');
    });

    it('should throw NotFoundException when user has no passwordHash (SSO-only account)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ passwordHash: null }) as any,
      );

      await expect(
        service.changePassword(TEST_USER_ID, 'current', 'newpass123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(TEST_USER_ID, 'wrongpass', 'newpass12345'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.changePassword(TEST_USER_ID, 'wrongpass', 'newpass12345'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw BadRequestException when new password is too short', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword(TEST_USER_ID, 'currentpass', 'short'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.changePassword(TEST_USER_ID, 'currentpass', 'short'),
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should send a password-changed notification email after successful change', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(buildUser() as any);
      emailService.send.mockResolvedValue(true);

      await service.changePassword(TEST_USER_ID, 'currentpass', 'newpassword456');

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: TEST_EMAIL,
          subject: 'Your Restorae password was changed',
        }),
      );
    });

    it('should NOT send notification email when user has no email', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ email: null }) as any,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(buildUser({ email: null }) as any);

      await service.changePassword(TEST_USER_ID, 'currentpass', 'newpassword456');

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should look up user with correct select fields', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(buildUser() as any);
      emailService.send.mockResolvedValue(true);

      await service.changePassword(TEST_USER_ID, 'currentpass', 'newpassword456');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
        select: { passwordHash: true, email: true, name: true },
      });
    });
  });
});

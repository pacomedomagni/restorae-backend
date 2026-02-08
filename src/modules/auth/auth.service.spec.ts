import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuthService } from './auth.service';
import { SSOService } from './sso.service';
import { PasswordResetService } from './password-reset.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// ---------------------------------------------------------------------------
// Mock bcrypt at the module level
// ---------------------------------------------------------------------------
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------
const TEST_USER_ID = 'user-id-1';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'securepassword123';
const TEST_ACCESS_TOKEN = 'access-token-stub';
const TEST_REFRESH_TOKEN = 'refresh-token-stub';

function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    passwordHash: 'hashed-password',
    name: 'Test User',
    isActive: true,
    emailVerified: false,
    appleId: null,
    googleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: { id: 'pref-1' },
    subscription: { id: 'sub-1', tier: 'FREE' },
    ...overrides,
  };
}

function buildSession(overrides: Record<string, any> = {}) {
  return {
    id: 'session-1',
    userId: TEST_USER_ID,
    refreshToken: 'hashed-refresh-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let jwtService: DeepMockProxy<JwtService>;
  let configService: DeepMockProxy<ConfigService>;
  let ssoService: DeepMockProxy<SSOService>;
  let passwordResetService: DeepMockProxy<PasswordResetService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    jwtService = mockDeep<JwtService>();
    configService = mockDeep<ConfigService>();
    ssoService = mockDeep<SSOService>();
    passwordResetService = mockDeep<PasswordResetService>();

    // Default config values consumed by the service
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const values: Record<string, string> = {
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '30d',
      };
      return values[key] ?? defaultValue;
    });

    // JwtService.sign returns predictable tokens
    jwtService.sign.mockImplementation((_payload: any, options?: any) => {
      if (options?.secret) {
        return TEST_REFRESH_TOKEN;
      }
      return TEST_ACCESS_TOKEN;
    });

    // Default: session.create succeeds
    prisma.session.create.mockResolvedValue(buildSession() as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: SSOService, useValue: ssoService },
        { provide: PasswordResetService, useValue: passwordResetService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // register
  // =========================================================================
  describe('register', () => {
    const dto: RegisterDto = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: 'Test User',
    };

    it('should register a new user and return sanitized user with tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const createdUser = buildUser();
      prisma.user.create.mockResolvedValue(createdUser as any);

      const result = await service.register(dto);

      // Verify bcrypt.hash was called with 12 salt rounds
      expect(bcrypt.hash).toHaveBeenCalledWith(TEST_PASSWORD, 12);

      // Verify Prisma create payload
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: TEST_EMAIL,
            passwordHash: 'hashed-password',
            name: 'Test User',
            preferences: { create: {} },
            subscription: { create: { tier: 'FREE' } },
          }),
          include: { preferences: true, subscription: true },
        }),
      );

      // Tokens are returned
      expect(result.accessToken).toBe(TEST_ACCESS_TOKEN);
      expect(result.refreshToken).toBe(TEST_REFRESH_TOKEN);

      // passwordHash must NOT be in the returned user object
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', TEST_EMAIL);
    });

    it('should throw ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow('Email already registered');

      // user.create should NOT have been called
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // login
  // =========================================================================
  describe('login', () => {
    const dto: LoginDto = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    };

    it('should login successfully and return sanitized user with tokens', async () => {
      const user = buildUser();
      prisma.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: TEST_EMAIL },
          include: { preferences: true, subscription: true },
        }),
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(TEST_PASSWORD, 'hashed-password');

      expect(result.accessToken).toBe(TEST_ACCESS_TOKEN);
      expect(result.refreshToken).toBe(TEST_REFRESH_TOKEN);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe(TEST_EMAIL);
    });

    it('should throw UnauthorizedException when email is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when user has no passwordHash (SSO-only account)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ passwordHash: null }) as any,
      );

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException when account is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ isActive: false }) as any,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Account is disabled');
    });

    it('should upsert device when deviceId is provided', async () => {
      const dtoWithDevice: LoginDto = {
        ...dto,
        deviceId: 'device-123',
        platform: 'ios',
        pushToken: 'push-token-abc',
        appVersion: '1.0.0',
        osVersion: '17.0',
      };

      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.device.upsert.mockResolvedValue({} as any);

      await service.login(dtoWithDevice);

      expect(prisma.device.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deviceId: 'device-123' },
          update: expect.objectContaining({
            pushToken: 'push-token-abc',
            appVersion: '1.0.0',
            osVersion: '17.0',
          }),
          create: expect.objectContaining({
            userId: TEST_USER_ID,
            deviceId: 'device-123',
            platform: 'ios',
          }),
        }),
      );
    });

    it('should NOT upsert device when deviceId is not provided', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser() as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(dto);

      expect(prisma.device.upsert).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // refreshTokens
  // =========================================================================
  describe('refreshTokens', () => {
    it('should delete old session and return new tokens', async () => {
      const session = buildSession();
      prisma.session.findUnique.mockResolvedValue(session as any);
      prisma.session.delete.mockResolvedValue(session as any);

      const result = await service.refreshTokens('some-refresh-token');

      // Old session is deleted by id
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: session.id },
      });

      // New tokens returned
      expect(result.accessToken).toBe(TEST_ACCESS_TOKEN);
      expect(result.refreshToken).toBe(TEST_REFRESH_TOKEN);

      // A new session is created (from generateTokens)
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when session is not found', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw UnauthorizedException when session is expired', async () => {
      const expiredSession = buildSession({
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      });
      prisma.session.findUnique.mockResolvedValue(expiredSession as any);

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.refreshTokens('expired-token')).rejects.toThrow(
        'Invalid refresh token',
      );

      // Session should NOT be deleted when expired (guard clause returns early)
      expect(prisma.session.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // logout
  // =========================================================================
  describe('logout', () => {
    it('should delete the session matching the hashed refresh token and return success', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.logout('some-refresh-token');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { refreshToken: expect.any(String) },
      });
      expect(result).toEqual({ success: true });
    });

    it('should return success even if no session was found (idempotent)', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.logout('nonexistent-token');
      expect(result).toEqual({ success: true });
    });
  });

  // =========================================================================
  // registerAnonymous
  // =========================================================================
  describe('registerAnonymous', () => {
    const deviceId = 'device-anon-1';
    const platform = 'ios';

    it('should return existing user when device already exists', async () => {
      const existingUser = buildUser({ id: 'existing-user-id' });
      const existingDevice = {
        id: 'device-rec-1',
        deviceId,
        userId: 'existing-user-id',
        user: existingUser,
      };

      prisma.device.findUnique.mockResolvedValue(existingDevice as any);
      prisma.user.findUnique.mockResolvedValue(existingUser as any);

      const result = await service.registerAnonymous(deviceId, platform);

      // Should NOT create a new user
      expect(prisma.user.create).not.toHaveBeenCalled();

      // Should generate tokens for the existing user
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.accessToken).toBe(TEST_ACCESS_TOKEN);
      expect(result.refreshToken).toBe(TEST_REFRESH_TOKEN);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should create a new anonymous user when device does not exist', async () => {
      prisma.device.findUnique.mockResolvedValue(null);

      const newUser = buildUser({ id: 'new-anon-id', email: null, passwordHash: null });
      prisma.user.create.mockResolvedValue(newUser as any);

      const result = await service.registerAnonymous(deviceId, platform);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            preferences: { create: {} },
            subscription: { create: { tier: 'FREE' } },
            devices: { create: { deviceId, platform } },
          }),
          include: { preferences: true, subscription: true },
        }),
      );

      expect(result.accessToken).toBe(TEST_ACCESS_TOKEN);
      expect(result.refreshToken).toBe(TEST_REFRESH_TOKEN);
    });
  });

  // =========================================================================
  // upgradeAnonymous
  // =========================================================================
  describe('upgradeAnonymous', () => {
    const dto: RegisterDto = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: 'Upgraded User',
    };

    it('should upgrade an anonymous user to a full account', async () => {
      // No email conflict
      prisma.user.findUnique.mockResolvedValue(null);

      const updatedUser = buildUser({ name: 'Upgraded User' });
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.upgradeAnonymous(TEST_USER_ID, dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(TEST_PASSWORD, 12);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_USER_ID },
          data: expect.objectContaining({
            email: TEST_EMAIL,
            passwordHash: 'hashed-password',
            name: 'Upgraded User',
          }),
          include: { preferences: true, subscription: true },
        }),
      );

      // passwordHash stripped from response
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email', TEST_EMAIL);
    });

    it('should allow upgrade if the email belongs to the same user', async () => {
      // Email found but belongs to the same userId
      prisma.user.findUnique.mockResolvedValue(buildUser({ id: TEST_USER_ID }) as any);

      const updatedUser = buildUser({ name: 'Upgraded User' });
      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.upgradeAnonymous(TEST_USER_ID, dto);

      expect(prisma.user.update).toHaveBeenCalled();
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw ConflictException when email belongs to another user', async () => {
      // Email found for a different user
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ id: 'other-user-id' }) as any,
      );

      await expect(service.upgradeAnonymous(TEST_USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.upgradeAnonymous(TEST_USER_ID, dto)).rejects.toThrow(
        'Email already registered',
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // generateTokens (tested indirectly through public methods)
  // =========================================================================
  describe('generateTokens (indirect)', () => {
    it('should sign an access token and a refresh token with different secrets', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser() as any);

      await service.register({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: 'Test',
      });

      // First call: access token (no explicit secret option)
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: TEST_USER_ID });

      // Second call: refresh token (with secret and expiresIn)
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: TEST_USER_ID },
        expect.objectContaining({
          secret: 'test-refresh-secret',
          expiresIn: '30d',
        }),
      );
    });

    it('should store a hashed refresh token in a new session', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser() as any);

      await service.register({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: TEST_USER_ID,
            refreshToken: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );

      // The stored refresh token should be a hex hash, NOT the raw token
      const storedToken = (prisma.session.create as jest.Mock).mock.calls[0][0].data
        .refreshToken as string;
      expect(storedToken).not.toBe(TEST_REFRESH_TOKEN);
      expect(storedToken).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex digest
    });
  });
});

/**
 * Auth Controller Tests
 * 
 * Unit tests for authentication controller endpoints.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    isActive: true,
    onboardingCompleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    timezone: 'UTC',
    locale: 'en',
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      registerAnonymous: jest.fn(),
      upgradeAnonymous: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
      authService.register.mockResolvedValue({ user: mockUser, ...mockTokens });

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      authService.login.mockResolvedValue({ user: mockUser, ...mockTokens });

      const result = await controller.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('registerAnonymous', () => {
    it('should create anonymous user', async () => {
      const dto = { deviceId: 'device-123', platform: 'ios' };
      authService.registerAnonymous.mockResolvedValue({ user: { ...mockUser, email: null }, ...mockTokens });

      const result = await controller.registerAnonymous(dto);

      expect(authService.registerAnonymous).toHaveBeenCalledWith(dto.deviceId, dto.platform);
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('refresh', () => {
    it('should refresh tokens', async () => {
      const dto = { refreshToken: 'old-refresh-token' };
      authService.refreshTokens.mockResolvedValue(mockTokens);

      const result = await controller.refresh(dto);

      expect(authService.refreshTokens).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('logout', () => {
    it('should logout and invalidate token', async () => {
      const dto = { refreshToken: 'refresh-token' };
      authService.logout.mockResolvedValue({ message: 'Logged out' });

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toHaveProperty('message');
    });
  });

  describe('signInWithApple', () => {
    it('should sign in with Apple', async () => {
      const dto = { identityToken: 'apple-token', name: 'Apple User' };
      authService.signInWithApple.mockResolvedValue({ user: mockUser, ...mockTokens });

      const result = await controller.signInWithApple(dto);

      expect(authService.signInWithApple).toHaveBeenCalledWith(dto.identityToken, dto.name, undefined);
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('signInWithGoogle', () => {
    it('should sign in with Google', async () => {
      const dto = { idToken: 'google-token', platform: 'ios' };
      authService.signInWithGoogle.mockResolvedValue({ user: mockUser, ...mockTokens });

      const result = await controller.signInWithGoogle(dto);

      expect(authService.signInWithGoogle).toHaveBeenCalledWith(dto.idToken, dto.platform);
      expect(result).toHaveProperty('accessToken');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SSOService } from './sso.service';

// ---------------------------------------------------------------------------
// Use fake timers so the setTimeout in getApplePublicKeys doesn't leak
// ---------------------------------------------------------------------------
jest.useFakeTimers();

// ---------------------------------------------------------------------------
// Suppress Logger output
// ---------------------------------------------------------------------------
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Mock crypto for verifyJWT / jwkToCryptoKey
// ---------------------------------------------------------------------------
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    verify: jest.fn().mockReturnValue(true),
    createPublicKey: jest.fn().mockReturnValue({
      export: jest.fn().mockReturnValue('-----BEGIN RSA PUBLIC KEY-----\nmockkey\n-----END RSA PUBLIC KEY-----'),
    }),
  };
});

import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------
const TEST_APPLE_CLIENT_ID = 'com.restorae.app';
const TEST_GOOGLE_CLIENT_ID = 'google-web-client-id';
const TEST_GOOGLE_CLIENT_ID_IOS = 'google-ios-client-id';
const TEST_GOOGLE_CLIENT_ID_ANDROID = 'google-android-client-id';

const APPLE_JWK = {
  kty: 'RSA',
  kid: 'test-kid-1',
  use: 'sig',
  alg: 'RS256',
  n: 'test-modulus-base64',
  e: 'AQAB',
};

function buildAppleJWT(headerOverrides: Record<string, any> = {}, payloadOverrides: Record<string, any> = {}) {
  const header = {
    alg: 'RS256',
    kid: 'test-kid-1',
    ...headerOverrides,
  };
  const payload = {
    iss: 'https://appleid.apple.com',
    aud: TEST_APPLE_CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    sub: 'apple-user-001',
    email: 'apple@example.com',
    email_verified: true,
    is_private_email: false,
    nonce_supported: true,
    auth_time: Math.floor(Date.now() / 1000),
    ...payloadOverrides,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signatureB64 = Buffer.from('fake-signature').toString('base64');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function buildGooglePayload(overrides: Record<string, any> = {}) {
  return {
    iss: 'https://accounts.google.com',
    azp: TEST_GOOGLE_CLIENT_ID_IOS,
    aud: TEST_GOOGLE_CLIENT_ID_IOS,
    sub: 'google-user-001',
    email: 'google@example.com',
    email_verified: true,
    name: 'Google User',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
    given_name: 'Google',
    family_name: 'User',
    locale: 'en',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('SSOService', () => {
  let service: SSOService;

  beforeEach(async () => {
    // Reset apple public keys cache between tests
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SSOService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const values: Record<string, string> = {
                APPLE_CLIENT_ID: TEST_APPLE_CLIENT_ID,
                GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_ID_IOS: TEST_GOOGLE_CLIENT_ID_IOS,
                GOOGLE_CLIENT_ID_ANDROID: TEST_GOOGLE_CLIENT_ID_ANDROID,
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SSOService>(SSOService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Apple Sign In - getApplePublicKeys
  // =========================================================================
  describe('getApplePublicKeys (via verifyAppleToken)', () => {
    it('should fetch Apple public keys successfully and cache them', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ keys: [APPLE_JWK] }),
      });

      const token = buildAppleJWT();
      const result = await service.verifyAppleToken(token);

      expect(mockFetch).toHaveBeenCalledWith('https://appleid.apple.com/auth/keys');
      expect(result.providerId).toBe('apple-user-001');
      expect(result.provider).toBe('apple');
      expect(result.email).toBe('apple@example.com');
      expect(result.emailVerified).toBe(true);
    });

    it('should throw ServiceUnavailableException when Apple key endpoint returns non-OK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const token = buildAppleJWT();

      // The ServiceUnavailableException is caught and re-thrown as UnauthorizedException
      // because verifyAppleToken wraps errors
      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when Apple keys response has invalid format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'data' }),
      });

      const token = buildAppleJWT();

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when fetch itself fails (network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const token = buildAppleJWT();

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // Apple Sign In - verifyAppleToken
  // =========================================================================
  describe('verifyAppleToken', () => {
    beforeEach(() => {
      // Successfully fetch Apple keys for all tests in this block
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [APPLE_JWK] }),
      });
    });

    it('should return SSO user info for a valid Apple token', async () => {
      const token = buildAppleJWT();
      const result = await service.verifyAppleToken(token);

      expect(result).toEqual({
        providerId: 'apple-user-001',
        provider: 'apple',
        email: 'apple@example.com',
        emailVerified: true,
      });
    });

    it('should throw UnauthorizedException when key kid does not match any Apple key', async () => {
      const token = buildAppleJWT({ kid: 'nonexistent-kid' });

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token signature is invalid', async () => {
      (crypto.verify as jest.Mock).mockReturnValueOnce(false);

      const token = buildAppleJWT();

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when issuer is wrong', async () => {
      const token = buildAppleJWT({}, { iss: 'https://evil.com' });

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when audience does not match client ID', async () => {
      const token = buildAppleJWT({}, { aud: 'com.wrong.app' });

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const token = buildAppleJWT({}, { exp: Math.floor(Date.now() / 1000) - 3600 });

      await expect(service.verifyAppleToken(token)).rejects.toThrow(UnauthorizedException);
    });

    it('should return emailVerified false when email_verified is absent', async () => {
      const token = buildAppleJWT({}, { email_verified: undefined });

      const result = await service.verifyAppleToken(token);

      expect(result.emailVerified).toBe(false);
    });
  });

  // =========================================================================
  // Google Sign In - verifyGoogleToken
  // =========================================================================
  describe('verifyGoogleToken', () => {
    it('should return SSO user info for a valid Google token (iOS platform)', async () => {
      const payload = buildGooglePayload();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      const result = await service.verifyGoogleToken('google-id-token', 'ios');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/tokeninfo?id_token=google-id-token',
      );

      expect(result).toEqual({
        providerId: 'google-user-001',
        provider: 'google',
        email: 'google@example.com',
        name: 'Google User',
        emailVerified: true,
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      });
    });

    it('should validate against web client ID for web platform', async () => {
      const payload = buildGooglePayload({ aud: TEST_GOOGLE_CLIENT_ID });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      const result = await service.verifyGoogleToken('google-id-token', 'web');

      expect(result.providerId).toBe('google-user-001');
    });

    it('should validate against android client ID for android platform', async () => {
      const payload = buildGooglePayload({ aud: TEST_GOOGLE_CLIENT_ID_ANDROID });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      const result = await service.verifyGoogleToken('google-id-token', 'android');

      expect(result.providerId).toBe('google-user-001');
    });

    it('should accept cross-platform audience if it matches any valid client ID', async () => {
      // iOS token but aud matches Android client ID -- should still pass
      const payload = buildGooglePayload({ aud: TEST_GOOGLE_CLIENT_ID_ANDROID });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      const result = await service.verifyGoogleToken('google-id-token', 'ios');

      expect(result.providerId).toBe('google-user-001');
    });

    it('should throw UnauthorizedException when Google endpoint returns non-OK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(
        service.verifyGoogleToken('invalid-token', 'ios'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when audience does not match any known client ID', async () => {
      const payload = buildGooglePayload({ aud: 'totally-unknown-audience' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      await expect(
        service.verifyGoogleToken('google-id-token', 'ios'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Google token is expired', async () => {
      const payload = buildGooglePayload({
        exp: Math.floor(Date.now() / 1000) - 3600,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      await expect(
        service.verifyGoogleToken('expired-token', 'ios'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when fetch fails (network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.verifyGoogleToken('token', 'ios'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should default to ios platform when no platform is specified', async () => {
      const payload = buildGooglePayload({ aud: TEST_GOOGLE_CLIENT_ID_IOS });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
      });

      const result = await service.verifyGoogleToken('google-id-token');

      expect(result.providerId).toBe('google-user-001');
    });
  });
});

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
  nonce_supported: boolean;
  auth_time: number;
}

interface GoogleTokenPayload {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  iat: number;
  exp: number;
}

interface SSOUserInfo {
  providerId: string;
  provider: 'apple' | 'google';
  email?: string;
  name?: string;
  emailVerified: boolean;
  picture?: string;
}

@Injectable()
export class SSOService {
  private readonly logger = new Logger(SSOService.name);
  private readonly appleClientId: string;
  private readonly googleClientId: string;
  private readonly googleClientIdIOS: string;
  private readonly googleClientIdAndroid: string;
  private applePublicKeys: any[] | null = null;

  constructor(private configService: ConfigService) {
    this.appleClientId = this.configService.get<string>('APPLE_CLIENT_ID') || '';
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.googleClientIdIOS = this.configService.get<string>('GOOGLE_CLIENT_ID_IOS') || '';
    this.googleClientIdAndroid = this.configService.get<string>('GOOGLE_CLIENT_ID_ANDROID') || '';
  }

  // =========================================================================
  // APPLE SIGN IN
  // =========================================================================

  async verifyAppleToken(identityToken: string, nonce?: string): Promise<SSOUserInfo> {
    try {
      // Decode the JWT without verification first to get the header
      const [headerB64, payloadB64] = identityToken.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());
      
      // Get Apple's public keys
      const publicKeys = await this.getApplePublicKeys();
      const key = publicKeys.find((k: any) => k.kid === header.kid);
      
      if (!key) {
        throw new UnauthorizedException('Invalid Apple token: key not found');
      }

      // Verify the token
      const payload = await this.verifyJWT(identityToken, key) as AppleTokenPayload;

      // Validate claims
      if (payload.iss !== 'https://appleid.apple.com') {
        throw new UnauthorizedException('Invalid Apple token: wrong issuer');
      }

      if (payload.aud !== this.appleClientId) {
        this.logger.error(`Apple audience mismatch. Token aud: ${payload.aud}, Expected: ${this.appleClientId}`);
        throw new UnauthorizedException('Invalid Apple token: wrong audience');
      }

      if (payload.exp * 1000 < Date.now()) {
        throw new UnauthorizedException('Apple token expired');
      }

      return {
        providerId: payload.sub,
        provider: 'apple',
        email: payload.email,
        emailVerified: payload.email_verified || false,
      };
    } catch (error) {
      this.logger.error('Apple token verification failed:', error);
      throw new UnauthorizedException('Invalid Apple token');
    }
  }

  private async getApplePublicKeys(): Promise<any[]> {
    if (this.applePublicKeys) {
      return this.applePublicKeys;
    }

    const response = await fetch('https://appleid.apple.com/auth/keys');
    const data = await response.json();
    this.applePublicKeys = data.keys;
    
    // Refresh keys every hour
    setTimeout(() => {
      this.applePublicKeys = null;
    }, 60 * 60 * 1000);

    return this.applePublicKeys!;
  }

  // =========================================================================
  // GOOGLE SIGN IN
  // =========================================================================

  async verifyGoogleToken(idToken: string, platform: 'web' | 'ios' | 'android' = 'ios'): Promise<SSOUserInfo> {
    try {
      // Use Google's token verification endpoint
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google token');
      }

      const payload: GoogleTokenPayload = await response.json();

      // Determine which client ID to validate against
      let expectedAud: string;
      switch (platform) {
        case 'ios':
          expectedAud = this.googleClientIdIOS || this.googleClientId;
          break;
        case 'android':
          expectedAud = this.googleClientIdAndroid || this.googleClientId;
          break;
        default:
          expectedAud = this.googleClientId;
      }

      // Validate audience
      if (payload.aud !== expectedAud) {
        // Also check other client IDs in case of cross-platform
        const validAuds = [
          this.googleClientId,
          this.googleClientIdIOS,
          this.googleClientIdAndroid,
        ].filter(Boolean);

        this.logger.debug(`Google token audience: ${payload.aud}`);
        this.logger.debug(`Valid audiences: ${validAuds.join(', ')}`);

        if (!validAuds.includes(payload.aud)) {
          this.logger.error(`Google audience mismatch. Token aud: ${payload.aud}, Valid: ${validAuds.join(', ')}`);
          throw new UnauthorizedException('Invalid Google token: wrong audience');
        }
      }

      // Validate expiry
      if (payload.exp * 1000 < Date.now()) {
        throw new UnauthorizedException('Google token expired');
      }

      return {
        providerId: payload.sub,
        provider: 'google',
        email: payload.email,
        name: payload.name,
        emailVerified: payload.email_verified,
        picture: payload.picture,
      };
    } catch (error) {
      this.logger.error('Google token verification failed:', error);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async verifyJWT(token: string, jwk: any): Promise<any> {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    
    // Import the JWK
    const keyData = await this.jwkToCryptoKey(jwk);
    
    // Verify signature
    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    
    const isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(signatureInput),
      {
        key: keyData,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      signature
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    return JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  }

  private async jwkToCryptoKey(jwk: any): Promise<string> {
    // Convert JWK to PEM format
    const n = Buffer.from(jwk.n, 'base64');
    const e = Buffer.from(jwk.e, 'base64');

    // Create RSA public key from components
    const key = crypto.createPublicKey({
      key: {
        kty: 'RSA',
        n: jwk.n,
        e: jwk.e,
      },
      format: 'jwk',
    });

    return key.export({ type: 'pkcs1', format: 'pem' }) as string;
  }
}

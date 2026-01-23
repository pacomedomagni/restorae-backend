import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SSOService } from './sso.service';
import { PasswordResetService } from './password-reset.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private ssoService: SSOService,
    private passwordResetService: PasswordResetService,
  ) {}

  // Register with email/password
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        preferences: {
          create: {},
        },
        subscription: {
          create: {
            tier: 'FREE',
          },
        },
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    const tokens = await this.generateTokens(user.id);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // Login with email/password
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const tokens = await this.generateTokens(user.id);

    // Update device if provided
    if (dto.deviceId) {
      await this.upsertDevice(user.id, dto);
    }

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // Anonymous device registration
  async registerAnonymous(deviceId: string, platform: string) {
    // Check if device already exists
    let device = await this.prisma.device.findUnique({
      where: { deviceId },
      include: { user: true },
    });

    if (device) {
      // Return existing user
      const tokens = await this.generateTokens(device.userId);
      const user = await this.prisma.user.findUnique({
        where: { id: device.userId },
        include: {
          preferences: true,
          subscription: true,
        },
      });
      return {
        user: this.sanitizeUser(user!),
        ...tokens,
      };
    }

    // Create anonymous user
    const user = await this.prisma.user.create({
      data: {
        preferences: {
          create: {},
        },
        subscription: {
          create: {
            tier: 'FREE',
          },
        },
        devices: {
          create: {
            deviceId,
            platform,
          },
        },
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    const tokens = await this.generateTokens(user.id);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  // Upgrade anonymous to full account
  async upgradeAnonymous(userId: string, dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingEmail && existingEmail.id !== userId) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    return this.sanitizeUser(user);
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Delete old session
    await this.prisma.session.delete({
      where: { id: session.id },
    });

    // Generate new tokens
    return this.generateTokens(session.userId);
  }

  // Logout
  async logout(refreshToken: string) {
    await this.prisma.session.deleteMany({
      where: { refreshToken },
    });
    return { success: true };
  }

  // Generate tokens
  private async generateTokens(userId: string) {
    const payload = { sub: userId };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  // Upsert device
  private async upsertDevice(userId: string, dto: LoginDto) {
    await this.prisma.device.upsert({
      where: { deviceId: dto.deviceId! },
      update: {
        lastActiveAt: new Date(),
        pushToken: dto.pushToken,
        appVersion: dto.appVersion,
        osVersion: dto.osVersion,
      },
      create: {
        userId,
        deviceId: dto.deviceId!,
        platform: dto.platform || 'unknown',
        pushToken: dto.pushToken,
        appVersion: dto.appVersion,
        osVersion: dto.osVersion,
      },
    });
  }

  // Remove sensitive fields
  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  // =========================================================================
  // SSO - Apple Sign In
  // =========================================================================

  async signInWithApple(identityToken: string, name?: string, nonce?: string) {
    const ssoUser = await this.ssoService.verifyAppleToken(identityToken, nonce);
    return this.handleSSOLogin(ssoUser, name);
  }

  // =========================================================================
  // SSO - Google Sign In
  // =========================================================================

  async signInWithGoogle(idToken: string, platform: 'web' | 'ios' | 'android' = 'ios') {
    const ssoUser = await this.ssoService.verifyGoogleToken(idToken, platform);
    return this.handleSSOLogin(ssoUser, ssoUser.name);
  }

  // =========================================================================
  // SSO - Common Handler
  // =========================================================================

  private async handleSSOLogin(
    ssoUser: { providerId: string; provider: 'apple' | 'google'; email?: string; name?: string; emailVerified: boolean },
    providedName?: string
  ) {
    // Check if user exists with this provider ID
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { appleId: ssoUser.provider === 'apple' ? ssoUser.providerId : undefined },
          { googleId: ssoUser.provider === 'google' ? ssoUser.providerId : undefined },
          { email: ssoUser.email || undefined },
        ].filter(c => Object.values(c)[0] !== undefined),
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    if (user) {
      // Update SSO link if not already linked
      const updateData: any = {};
      if (ssoUser.provider === 'apple' && !user.appleId) {
        updateData.appleId = ssoUser.providerId;
      }
      if (ssoUser.provider === 'google' && !user.googleId) {
        updateData.googleId = ssoUser.providerId;
      }
      if (ssoUser.emailVerified && !user.emailVerified) {
        updateData.emailVerified = true;
      }

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { preferences: true, subscription: true },
        });
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is disabled');
      }

      const tokens = await this.generateTokens(user.id);
      return {
        user: this.sanitizeUser(user),
        ...tokens,
        isNewUser: false,
      };
    }

    // Create new user
    user = await this.prisma.user.create({
      data: {
        email: ssoUser.email,
        emailVerified: ssoUser.emailVerified,
        name: providedName || ssoUser.name,
        appleId: ssoUser.provider === 'apple' ? ssoUser.providerId : null,
        googleId: ssoUser.provider === 'google' ? ssoUser.providerId : null,
        preferences: { create: {} },
        subscription: { create: { tier: 'FREE' } },
      },
      include: {
        preferences: true,
        subscription: true,
      },
    });

    const tokens = await this.generateTokens(user.id);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
      isNewUser: true,
    };
  }

  // =========================================================================
  // Password Reset
  // =========================================================================

  async requestPasswordReset(email: string) {
    return this.passwordResetService.requestReset(email);
  }

  async verifyResetToken(token: string) {
    return this.passwordResetService.verifyToken(token);
  }

  async resetPassword(token: string, newPassword: string) {
    return this.passwordResetService.resetPassword(token, newPassword);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    return this.passwordResetService.changePassword(userId, currentPassword, newPassword);
  }

  // =========================================================================
  // Link SSO to Existing Account
  // =========================================================================

  async linkApple(userId: string, identityToken: string) {
    const ssoUser = await this.ssoService.verifyAppleToken(identityToken);
    
    // Check if Apple ID already linked to another account
    const existing = await this.prisma.user.findFirst({
      where: { appleId: ssoUser.providerId, NOT: { id: userId } },
    });
    
    if (existing) {
      throw new BadRequestException('This Apple account is already linked to another user');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { appleId: ssoUser.providerId },
      include: { preferences: true, subscription: true },
    });

    return this.sanitizeUser(user);
  }

  async linkGoogle(userId: string, idToken: string, platform: 'web' | 'ios' | 'android' = 'ios') {
    const ssoUser = await this.ssoService.verifyGoogleToken(idToken, platform);
    
    // Check if Google ID already linked to another account
    const existing = await this.prisma.user.findFirst({
      where: { googleId: ssoUser.providerId, NOT: { id: userId } },
    });
    
    if (existing) {
      throw new BadRequestException('This Google account is already linked to another user');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { googleId: ssoUser.providerId },
      include: { preferences: true, subscription: true },
    });

    return this.sanitizeUser(user);
  }

  async unlinkSSO(userId: string, provider: 'apple' | 'google') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appleId: true, googleId: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Ensure user has another way to log in
    const hasPassword = !!user.passwordHash;
    const hasApple = !!user.appleId;
    const hasGoogle = !!user.googleId;

    const loginMethodsCount = [hasPassword, hasApple, hasGoogle].filter(Boolean).length;

    if (loginMethodsCount <= 1) {
      throw new BadRequestException('Cannot unlink: you need at least one login method');
    }

    const updateData = provider === 'apple' ? { appleId: null } : { googleId: null };

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: { preferences: true, subscription: true },
    });

    return this.sanitizeUser(updated);
  }
}

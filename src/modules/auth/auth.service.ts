import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
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
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('admin/settings')
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminSettingsController {
  constructor(private prisma: PrismaService) {}

  // =========================================================================
  // FEATURE FLAGS
  // =========================================================================

  @Get('features')
  @ApiOperation({ summary: 'Get all feature flags' })
  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  @Post('features')
  @ApiOperation({ summary: 'Create feature flag' })
  async createFeatureFlag(
    @Body() body: {
      key: string;
      name: string;
      description?: string;
      enabled: boolean;
      rules?: any;
    },
  ) {
    return this.prisma.featureFlag.create({
      data: {
        key: body.key,
        name: body.name,
        description: body.description,
        enabled: body.enabled,
        rules: body.rules,
      },
    });
  }

  @Patch('features/:key')
  @ApiOperation({ summary: 'Update feature flag' })
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body() body: Partial<{
      name: string;
      description: string;
      enabled: boolean;
      rules: any;
    }>,
  ) {
    return this.prisma.featureFlag.update({
      where: { key },
      data: body,
    });
  }

  // =========================================================================
  // SYSTEM CONFIG
  // =========================================================================

  @Get('config')
  @ApiOperation({ summary: 'Get system configuration' })
  async getSystemConfig() {
    const configs = await this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert to key-value object
    return configs.reduce((acc, config) => ({
      ...acc,
      [config.key]: config.value,
    }), {});
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update system configuration' })
  async updateSystemConfig(
    @CurrentUser() admin: any,
    @Body() body: Record<string, any>,
  ) {
    const updates = await Promise.all(
      Object.entries(body).map(([key, value]) =>
        this.prisma.systemConfig.upsert({
          where: { key },
          update: { 
            value: typeof value === 'string' ? value : JSON.stringify(value),
            updatedAt: new Date(),
          },
          create: {
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
          },
        }),
      ),
    );

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE_CONFIG',
        resource: 'SYSTEM_CONFIG',
        newValue: body,
        adminId: admin.id,
      },
    });

    return { success: true, updated: updates.length };
  }

  // =========================================================================
  // LEGAL CONTENT
  // =========================================================================

  @Get('legal')
  @ApiOperation({ summary: 'Get legal content' })
  async getLegalContent() {
    const [termsOfService, privacyPolicy] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: 'terms_of_service' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'privacy_policy' } }),
    ]);

    return {
      termsOfService: termsOfService?.value || '',
      privacyPolicy: privacyPolicy?.value || '',
    };
  }

  @Patch('legal')
  @ApiOperation({ summary: 'Update legal content' })
  async updateLegalContent(
    @CurrentUser() admin: any,
    @Body() body: { termsOfService?: string; privacyPolicy?: string },
  ) {
    const updates = [];

    if (body.termsOfService !== undefined) {
      updates.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'terms_of_service' },
          update: { value: body.termsOfService, updatedAt: new Date() },
          create: { key: 'terms_of_service', value: body.termsOfService },
        }),
      );
    }

    if (body.privacyPolicy !== undefined) {
      updates.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'privacy_policy' },
          update: { value: body.privacyPolicy, updatedAt: new Date() },
          create: { key: 'privacy_policy', value: body.privacyPolicy },
        }),
      );
    }

    await Promise.all(updates);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE_LEGAL',
        resource: 'SYSTEM_CONFIG',
        newValue: { fields: Object.keys(body) },
        adminId: admin.id,
      },
    });

    return { success: true };
  }

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  async getAuditLogs(
    @Param('limit') limit = 100,
    @Param('offset') offset = 0,
  ) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
        include: {
          admin: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { logs, total };
  }

  // =========================================================================
  // APP VERSIONS
  // =========================================================================

  @Get('app-versions')
  @ApiOperation({ summary: 'Get app version requirements' })
  async getAppVersions() {
    const [minIOSVersion, minAndroidVersion, currentVersion] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: 'min_ios_version' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'min_android_version' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'current_app_version' } }),
    ]);

    return {
      minIOSVersion: minIOSVersion?.value || '1.0.0',
      minAndroidVersion: minAndroidVersion?.value || '1.0.0',
      currentVersion: currentVersion?.value || '1.0.0',
    };
  }

  @Patch('app-versions')
  @ApiOperation({ summary: 'Update app version requirements' })
  async updateAppVersions(
    @CurrentUser() admin: any,
    @Body() body: {
      minIOSVersion?: string;
      minAndroidVersion?: string;
      currentVersion?: string;
    },
  ) {
    const updates = [];

    if (body.minIOSVersion) {
      updates.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'min_ios_version' },
          update: { value: body.minIOSVersion },
          create: { key: 'min_ios_version', value: body.minIOSVersion },
        }),
      );
    }

    if (body.minAndroidVersion) {
      updates.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'min_android_version' },
          update: { value: body.minAndroidVersion },
          create: { key: 'min_android_version', value: body.minAndroidVersion },
        }),
      );
    }

    if (body.currentVersion) {
      updates.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'current_app_version' },
          update: { value: body.currentVersion },
          create: { key: 'current_app_version', value: body.currentVersion },
        }),
      );
    }

    await Promise.all(updates);

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: 'UPDATE_APP_VERSIONS',
        resource: 'SYSTEM_CONFIG',
        newValue: body,
        adminId: admin.id,
      },
    });

    return { success: true };
  }

  // =========================================================================
  // MAINTENANCE MODE
  // =========================================================================

  @Get('maintenance')
  @ApiOperation({ summary: 'Get maintenance status' })
  async getMaintenanceStatus() {
    const [enabled, message, scheduledEnd] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: 'maintenance_enabled' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'maintenance_message' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'maintenance_end' } }),
    ]);

    return {
      enabled: enabled?.value === 'true',
      message: message?.value || 'We\'re currently performing maintenance. Please check back soon.',
      scheduledEnd: scheduledEnd?.value || null,
    };
  }

  @Patch('maintenance')
  @ApiOperation({ summary: 'Update maintenance status' })
  async updateMaintenanceStatus(
    @CurrentUser() admin: any,
    @Body() body: {
      enabled: boolean;
      message?: string;
      scheduledEnd?: string;
    },
  ) {
    await Promise.all([
      this.prisma.systemConfig.upsert({
        where: { key: 'maintenance_enabled' },
        update: { value: body.enabled.toString() },
        create: { key: 'maintenance_enabled', value: body.enabled.toString() },
      }),
      body.message && this.prisma.systemConfig.upsert({
        where: { key: 'maintenance_message' },
        update: { value: body.message },
        create: { key: 'maintenance_message', value: body.message },
      }),
      body.scheduledEnd && this.prisma.systemConfig.upsert({
        where: { key: 'maintenance_end' },
        update: { value: body.scheduledEnd },
        create: { key: 'maintenance_end', value: body.scheduledEnd },
      }),
    ].filter(Boolean));

    // Log audit
    await this.prisma.auditLog.create({
      data: {
        action: body.enabled ? 'ENABLE_MAINTENANCE' : 'DISABLE_MAINTENANCE',
        resource: 'SYSTEM_CONFIG',
        newValue: body,
        adminId: admin.id,
      },
    });

    return { success: true };
  }
}

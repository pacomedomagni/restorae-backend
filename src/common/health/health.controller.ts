import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import * as os from 'os';
import { PrismaService } from '../../prisma/prisma.service';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: 'up' | 'down';
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check(): Promise<HealthStatus> {
    const dbStatus = await this.checkDatabase();
    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - os.freemem();

    const isHealthy = dbStatus === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: dbStatus,
        memory: {
          used: Math.round(usedMemory / 1024 / 1024),
          total: Math.round(totalMemory / 1024 / 1024),
          percentage: Math.round((usedMemory / totalMemory) * 100),
        },
      },
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  async ready() {
    const dbStatus = await this.checkDatabase();
    if (dbStatus === 'down') {
      throw new Error('Database not ready');
    }
    return { status: 'ok' };
  }

  private async checkDatabase(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';

@ApiTags('metrics')
@Controller('metrics')
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class MetricsController {
  constructor(private metrics: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get application metrics (JSON)' })
  getMetrics() {
    return this.metrics.getMetrics();
  }

  @Get('prometheus')
  @ApiOperation({ summary: 'Get metrics in Prometheus format' })
  getPrometheusFormat() {
    const metrics = this.metrics.getMetrics();
    const lines: string[] = [];

    // Uptime
    lines.push(`# HELP uptime_seconds Application uptime in seconds`);
    lines.push(`# TYPE uptime_seconds gauge`);
    lines.push(`uptime_seconds ${metrics.uptime_seconds}`);

    // Memory
    lines.push(`# HELP memory_heap_used_mb Heap memory used in MB`);
    lines.push(`# TYPE memory_heap_used_mb gauge`);
    lines.push(`memory_heap_used_mb ${metrics.memory.heapUsedMB}`);

    lines.push(`# HELP memory_rss_mb RSS memory in MB`);
    lines.push(`# TYPE memory_rss_mb gauge`);
    lines.push(`memory_rss_mb ${metrics.memory.rssMB}`);

    // Counters
    Object.entries(metrics.counters).forEach(([key, value]) => {
      const safeName = key.replace(/[{}=",]/g, '_').replace(/__+/g, '_');
      lines.push(`${safeName} ${value}`);
    });

    // Gauges
    Object.entries(metrics.gauges).forEach(([key, value]) => {
      const safeName = key.replace(/[{}=",]/g, '_').replace(/__+/g, '_');
      lines.push(`${safeName} ${value}`);
    });

    // Histograms (just the summary stats)
    Object.entries(metrics.histograms).forEach(([key, stats]: [string, any]) => {
      const safeName = key.replace(/[{}=",]/g, '_').replace(/__+/g, '_');
      lines.push(`${safeName}_count ${stats.count}`);
      lines.push(`${safeName}_sum ${stats.sum}`);
      lines.push(`${safeName}_avg ${stats.avg}`);
      lines.push(`${safeName}_p95 ${stats.p95}`);
    });

    return lines.join('\n');
  }
}

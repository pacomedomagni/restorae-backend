import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from '../../../common/health/metrics.service';
import { AlertService, AlertThreshold, ActiveAlert } from '../../../common/health/alert.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';

@ApiTags('Admin - Metrics')
@Controller('admin/metrics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminMetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly alertService: AlertService,
  ) {}

  @Get()
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get all system metrics' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved' })
  async getMetrics() {
    const metrics = this.metricsService.getMetrics();
    const alertStatus = this.alertService.getStatus();

    return {
      ...metrics,
      alerts: alertStatus,
    };
  }

  @Get('summary')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get metrics summary for dashboard' })
  @ApiResponse({ status: 200, description: 'Metrics summary retrieved' })
  async getMetricsSummary() {
    const metrics = this.metricsService.getMetrics();
    const alertStatus = this.alertService.getStatus();
    const activeAlerts = this.alertService.getActiveAlerts();

    // Calculate summary stats
    const counters = metrics.counters as Record<string, number>;
    const histograms = metrics.histograms as Record<string, any>;

    return {
      uptime: {
        seconds: metrics.uptime_seconds,
        formatted: this.formatUptime(metrics.uptime_seconds),
      },
      requests: {
        total: Object.entries(counters)
          .filter(([k]) => k.startsWith('http_requests_total'))
          .reduce((sum, [, v]) => sum + v, 0),
        errors5xx: counters['http_errors_5xx'] || 0,
        errors4xx: counters['http_errors_4xx'] || 0,
        errorRate: this.calculateErrorRate(counters),
      },
      latency: histograms['http_request_duration_ms'] || null,
      memory: metrics.memory,
      alerts: {
        ...alertStatus,
        active: activeAlerts.map((a: ActiveAlert) => ({
          name: a.threshold.name,
          severity: a.threshold.severity,
          metric: a.threshold.metric,
          currentValue: a.currentValue,
          threshold: a.threshold.value,
          triggeredAt: a.triggeredAt,
        })),
      },
      appEvents: {
        moodEvents: Object.entries(counters)
          .filter(([k]) => k.includes('mood'))
          .reduce((sum, [, v]) => sum + v, 0),
        breathingEvents: Object.entries(counters)
          .filter(([k]) => k.includes('breathing'))
          .reduce((sum, [, v]) => sum + v, 0),
        journalEvents: Object.entries(counters)
          .filter(([k]) => k.includes('journal'))
          .reduce((sum, [, v]) => sum + v, 0),
        storyEvents: Object.entries(counters)
          .filter(([k]) => k.includes('story'))
          .reduce((sum, [, v]) => sum + v, 0),
        errors: counters['app_errors'] || 0,
        totalReceived: counters['analytics_events_received'] || 0,
      },
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private calculateErrorRate(counters: Record<string, number>): number {
    const total = Object.entries(counters)
      .filter(([k]) => k.startsWith('http_requests_total'))
      .reduce((sum, [, v]) => sum + v, 0);
    
    const errors = (counters['http_errors_5xx'] || 0) + (counters['http_errors_4xx'] || 0);
    
    if (total === 0) return 0;
    return Math.round((errors / total) * 10000) / 100; // 2 decimal places
  }

  @Get('alerts')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get active alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved' })
  async getActiveAlerts() {
    return {
      status: this.alertService.getStatus(),
      active: this.alertService.getActiveAlerts(),
    };
  }

  @Get('alerts/history')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get alert history' })
  @ApiResponse({ status: 200, description: 'Alert history retrieved' })
  async getAlertHistory() {
    return {
      history: this.alertService.getAlertHistory(100),
    };
  }

  @Get('alerts/thresholds')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get alert thresholds configuration' })
  @ApiResponse({ status: 200, description: 'Thresholds retrieved' })
  async getAlertThresholds() {
    return {
      thresholds: this.alertService.getThresholds(),
    };
  }

  @Post('alerts/thresholds')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add new alert threshold' })
  @ApiResponse({ status: 201, description: 'Threshold created' })
  async addAlertThreshold(@Body() threshold: AlertThreshold) {
    this.alertService.addThreshold(threshold);
    return { success: true, thresholds: this.alertService.getThresholds() };
  }

  @Delete('alerts/thresholds/:name')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove alert threshold' })
  @ApiResponse({ status: 200, description: 'Threshold removed' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async removeAlertThreshold(@Param('name') name: string) {
    const removed = this.alertService.removeThreshold(name);
    return { success: removed, thresholds: this.alertService.getThresholds() };
  }
}

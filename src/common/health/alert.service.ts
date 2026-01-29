/**
 * Alert Service
 * 
 * Monitors metrics and triggers alerts when thresholds are exceeded.
 * Lightweight - logs alerts and exposes them via API.
 */
import { Injectable, OnModuleInit } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { LoggerService } from '../logger/logger.service';

export interface AlertThreshold {
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  severity: 'info' | 'warning' | 'critical';
  cooldownMinutes?: number;
}

export interface ActiveAlert {
  id: string;
  threshold: AlertThreshold;
  triggeredAt: Date;
  currentValue: number;
  resolved: boolean;
  resolvedAt?: Date;
}

@Injectable()
export class AlertService implements OnModuleInit {
  private readonly thresholds: AlertThreshold[] = [];
  private readonly activeAlerts: Map<string, ActiveAlert> = new Map();
  private readonly alertHistory: ActiveAlert[] = [];
  private readonly lastAlertTime: Map<string, Date> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  // Default thresholds
  private readonly DEFAULT_THRESHOLDS: AlertThreshold[] = [
    {
      name: 'High 5xx Error Rate',
      metric: 'http_errors_5xx',
      condition: 'gt',
      value: 10,
      severity: 'critical',
      cooldownMinutes: 5,
    },
    {
      name: 'High 4xx Error Rate',
      metric: 'http_errors_4xx',
      condition: 'gt',
      value: 100,
      severity: 'warning',
      cooldownMinutes: 15,
    },
    {
      name: 'High Memory Usage',
      metric: 'memory_heap_used_mb',
      condition: 'gt',
      value: 500,
      severity: 'warning',
      cooldownMinutes: 10,
    },
    {
      name: 'Critical Memory Usage',
      metric: 'memory_heap_used_mb',
      condition: 'gt',
      value: 800,
      severity: 'critical',
      cooldownMinutes: 5,
    },
    {
      name: 'Slow Response Times (p95)',
      metric: 'http_request_duration_ms_p95',
      condition: 'gt',
      value: 2000,
      severity: 'warning',
      cooldownMinutes: 10,
    },
    {
      name: 'Very Slow Response Times (p99)',
      metric: 'http_request_duration_ms_p99',
      condition: 'gt',
      value: 5000,
      severity: 'critical',
      cooldownMinutes: 5,
    },
    {
      name: 'High App Error Rate',
      metric: 'app_errors',
      condition: 'gt',
      value: 50,
      severity: 'warning',
      cooldownMinutes: 15,
    },
  ];

  constructor(
    private metricsService: MetricsService,
    private logger: LoggerService,
  ) {
    this.thresholds = [...this.DEFAULT_THRESHOLDS];
  }

  onModuleInit() {
    // Check alerts every 30 seconds
    this.checkInterval = setInterval(() => this.checkAlerts(), 30000);
    this.logger.log('Alert monitoring started', 'AlertService');
  }

  onModuleDestroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  addThreshold(threshold: AlertThreshold): void {
    this.thresholds.push(threshold);
    this.logger.log(`Alert threshold added: ${threshold.name}`, 'AlertService');
  }

  removeThreshold(name: string): boolean {
    const index = this.thresholds.findIndex(t => t.name === name);
    if (index >= 0) {
      this.thresholds.splice(index, 1);
      return true;
    }
    return false;
  }

  getThresholds(): AlertThreshold[] {
    return [...this.thresholds];
  }

  updateThreshold(name: string, updates: Partial<AlertThreshold>): boolean {
    const threshold = this.thresholds.find(t => t.name === name);
    if (threshold) {
      Object.assign(threshold, updates);
      return true;
    }
    return false;
  }

  private checkAlerts(): void {
    const metrics = this.metricsService.getMetrics();
    const flatMetrics = this.flattenMetrics(metrics);

    for (const threshold of this.thresholds) {
      const value = flatMetrics[threshold.metric];
      if (value === undefined) continue;

      const isTriggered = this.evaluateCondition(value, threshold.condition, threshold.value);
      const alertId = `${threshold.name}`;
      const existingAlert = this.activeAlerts.get(alertId);

      if (isTriggered) {
        // Check cooldown
        const lastAlert = this.lastAlertTime.get(alertId);
        const cooldown = (threshold.cooldownMinutes || 5) * 60 * 1000;
        
        if (lastAlert && Date.now() - lastAlert.getTime() < cooldown) {
          continue;
        }

        if (!existingAlert || existingAlert.resolved) {
          const alert: ActiveAlert = {
            id: `${alertId}-${Date.now()}`,
            threshold,
            triggeredAt: new Date(),
            currentValue: value,
            resolved: false,
          };

          this.activeAlerts.set(alertId, alert);
          this.alertHistory.push(alert);
          this.lastAlertTime.set(alertId, new Date());

          // Log alert
          this.logger.warn(
            `Alert triggered: ${threshold.name} (${threshold.severity}) - ${threshold.metric}=${value} > ${threshold.value}`,
            'AlertService'
          );
        }
      } else if (existingAlert && !existingAlert.resolved) {
        // Resolve alert
        existingAlert.resolved = true;
        existingAlert.resolvedAt = new Date();

        const duration = existingAlert.resolvedAt.getTime() - existingAlert.triggeredAt.getTime();
        this.logger.log(
          `Alert resolved: ${threshold.name} - ${threshold.metric}=${value} (duration: ${duration}ms)`,
          'AlertService'
        );
      }
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  private flattenMetrics(metrics: Record<string, any>): Record<string, number> {
    const flat: Record<string, number> = {};

    // Flatten counters
    if (metrics.counters) {
      for (const [key, value] of Object.entries(metrics.counters)) {
        flat[key] = value as number;
      }
    }

    // Flatten gauges
    if (metrics.gauges) {
      for (const [key, value] of Object.entries(metrics.gauges)) {
        flat[key] = value as number;
      }
    }

    // Flatten histograms (use summary values)
    if (metrics.histograms) {
      for (const [key, hist] of Object.entries(metrics.histograms as Record<string, any>)) {
        flat[`${key}_count`] = hist.count;
        flat[`${key}_avg`] = hist.avg;
        flat[`${key}_p50`] = hist.p50;
        flat[`${key}_p95`] = hist.p95;
        flat[`${key}_p99`] = hist.p99;
      }
    }

    // Add memory
    if (metrics.memory) {
      flat['memory_heap_used_mb'] = metrics.memory.heapUsedMB;
      flat['memory_heap_total_mb'] = metrics.memory.heapTotalMB;
      flat['memory_rss_mb'] = metrics.memory.rssMB;
    }

    flat['uptime_seconds'] = metrics.uptime_seconds;

    return flat;
  }

  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  getAlertHistory(limit: number = 50): ActiveAlert[] {
    return this.alertHistory.slice(-limit).reverse();
  }

  getStatus(): {
    healthy: boolean;
    criticalAlerts: number;
    warningAlerts: number;
    totalAlerts: number;
  } {
    const active = this.getActiveAlerts();
    const critical = active.filter(a => a.threshold.severity === 'critical').length;
    const warning = active.filter(a => a.threshold.severity === 'warning').length;

    return {
      healthy: critical === 0,
      criticalAlerts: critical,
      warningAlerts: warning,
      totalAlerts: active.length,
    };
  }
}

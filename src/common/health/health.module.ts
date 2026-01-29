import { Module, Global } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { AlertService } from './alert.service';

@Global()
@Module({
  controllers: [HealthController, MetricsController],
  providers: [MetricsService, AlertService],
  exports: [MetricsService, AlertService],
})
export class HealthModule {}

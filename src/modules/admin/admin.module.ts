import { Module } from '@nestjs/common';
import { AdminContentController } from './controllers/admin-content.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminSubscriptionsController } from './controllers/admin-subscriptions.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminNotificationsController } from './controllers/admin-notifications.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminMetricsController } from './controllers/admin-metrics.controller';
import { AdminService } from './admin.service';
import { ContentModule } from '../content/content.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ContentModule, NotificationsModule],
  controllers: [
    AdminContentController,
    AdminUsersController,
    AdminSubscriptionsController,
    AdminAnalyticsController,
    AdminNotificationsController,
    AdminSettingsController,
    AdminMetricsController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

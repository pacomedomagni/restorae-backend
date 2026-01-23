import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FirebaseMessagingService } from './firebase-messaging.service';

@Module({
  providers: [NotificationsService, FirebaseMessagingService],
  controllers: [NotificationsController],
  exports: [NotificationsService, FirebaseMessagingService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { RevenueCatService } from './revenuecat.service';

@Module({
  providers: [SubscriptionsService, RevenueCatService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService, RevenueCatService],
})
export class SubscriptionsModule {}

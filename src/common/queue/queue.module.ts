/**
 * Queue Module
 * 
 * Provides background job processing using BullMQ with Redis.
 * Handles email sending, push notifications, analytics processing, etc.
 */
import { Module, Global, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  constructor(private queueService: QueueService) {}

  async onModuleInit() {
    await this.queueService.initialize();
  }

  async onModuleDestroy() {
    await this.queueService.shutdown();
  }
}

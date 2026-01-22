import { Module } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackController, AdminFeedbackController } from './feedback.controller';

@Module({
  providers: [FeedbackService],
  controllers: [FeedbackController, AdminFeedbackController],
  exports: [FeedbackService],
})
export class FeedbackModule {}

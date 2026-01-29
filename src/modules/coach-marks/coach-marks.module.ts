import { Module } from '@nestjs/common';
import { CoachMarksService } from './coach-marks.service';
import { CoachMarksController } from './coach-marks.controller';

@Module({
  providers: [CoachMarksService],
  controllers: [CoachMarksController],
  exports: [CoachMarksService],
})
export class CoachMarksModule {}

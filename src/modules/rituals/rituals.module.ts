import { Module } from '@nestjs/common';
import { RitualsService } from './rituals.service';
import { RitualsController } from './rituals.controller';

@Module({
  providers: [RitualsService],
  controllers: [RitualsController],
  exports: [RitualsService],
})
export class RitualsModule {}

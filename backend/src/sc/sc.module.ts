import { Module } from '@nestjs/common';
import { ScController } from './sc.controller.js';
import { ScService } from './sc.service.js';

@Module({
  controllers: [ScController],
  providers: [ScService],
  exports: [ScService],
})
export class ScModule {}

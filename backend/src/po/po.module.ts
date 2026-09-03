import { Module } from '@nestjs/common';
import { PoController } from './po.controller.js';
import { PoService } from './po.service.js';

@Module({
  controllers: [PoController],
  providers: [PoService],
  exports: [PoService],
})
export class PoModule {}

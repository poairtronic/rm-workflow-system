import { Module } from '@nestjs/common';
import { RmController } from './rm.controller.js';
import { RmService } from './rm.service.js';

@Module({
  controllers: [RmController],
  providers: [RmService],
  exports: [RmService],
})
export class RmModule {}

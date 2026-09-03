import { Module } from '@nestjs/common';
import { AdditionalRequestController } from './additional-request.controller.js';
import { AdditionalRequestService } from './additional-request.service.js';

@Module({
  controllers: [AdditionalRequestController],
  providers: [AdditionalRequestService],
  exports: [AdditionalRequestService],
})
export class AdditionalRequestModule {}

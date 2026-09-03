import { Controller, Get } from '@nestjs/common';
import { AdditionalRequestService } from './additional-request.service.js';

@Controller('api/additional-request')
export class AdditionalRequestController {
  constructor(
    private readonly additionalRequestService: AdditionalRequestService,
  ) {}

  @Get('status')
  getStatus() {
    return this.additionalRequestService.getStatus();
  }
}

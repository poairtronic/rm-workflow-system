import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdditionalRequestService } from './additional-request.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/additional-request')
export class AdditionalRequestController {
  constructor(private readonly additionalRequestService: AdditionalRequestService) {}

  @Get('status')
  getStatus() {
    return this.additionalRequestService.getStatus();
  }
}

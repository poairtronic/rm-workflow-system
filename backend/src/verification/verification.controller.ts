import { Controller, Get } from '@nestjs/common';
import { VerificationService } from './verification.service.js';

@Controller('api/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('status')
  getStatus() {
    return this.verificationService.getStatus();
  }
}

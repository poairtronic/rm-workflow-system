import { Controller, Get, UseGuards } from '@nestjs/common';
import { VerificationService } from './verification.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('status')
  getStatus() {
    return this.verificationService.getStatus();
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('status')
  getStatus() {
    return this.auditService.getStatus();
  }
}

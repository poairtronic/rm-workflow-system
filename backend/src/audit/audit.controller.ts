import { Controller, Get } from '@nestjs/common';
import { AuditService } from './audit.service.js';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('status')
  getStatus() {
    return this.auditService.getStatus();
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { EmailObservabilityService, EmailQueueObservabilitySummary } from './email-observability.service.js';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailObservabilityService: EmailObservabilityService) {}

  /**
   * Primary Read-Only Email Queue Observability Endpoint.
   * Restricted to ADMIN role.
   */
  @Get('observability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getObservability(): Promise<EmailQueueObservabilitySummary> {
    return await this.emailObservabilityService.getQueueObservability();
  }

  /**
   * Alias route for compatibility with /api/email/queue/observability.
   * Restricted to ADMIN role.
   */
  @Get('queue/observability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getQueueObservability(): Promise<EmailQueueObservabilitySummary> {
    return await this.emailObservabilityService.getQueueObservability();
  }
}

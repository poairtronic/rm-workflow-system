import { Controller, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { TraceabilityService } from './traceability.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { FinalRmUsageResponseDto } from './dto/final-rm-usage.dto.js';

@Controller('api/traceability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  /**
   * Phase 20.1 — Get authoritative Final RM Usage calculation for a Sales Order Component (SC).
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('sc/:scId/rm-usage')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getFinalRmUsage(
    @Param('scId', ParseUUIDPipe) scId: string,
  ): Promise<FinalRmUsageResponseDto> {
    return this.traceabilityService.getFinalRmUsage(scId);
  }
}

import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { TraceabilityService } from './traceability.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { FinalRmUsageResponseDto } from './dto/final-rm-usage.dto.js';
import {
  RmLifecycleFilterDto,
  RmLifecycleSummaryResponseDto,
  RmReconciliationQueueFilterDto,
  RmReconciliationQueueResponseDto,
} from './dto/rm-lifecycle.dto.js';

@Controller('api/traceability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  /**
   * Phase 20.2 — Aggregates and reports Raw Material Lifecycle Summary across SCs.
   * Categorizes Open RM, Completed RM, Closed RM, outstanding quantities, and pending returns.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('rm/lifecycle-summary')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getRmLifecycleSummary(
    @Query() query: RmLifecycleFilterDto,
  ): Promise<RmLifecycleSummaryResponseDto> {
    return this.traceabilityService.getRmLifecycleSummary(query);
  }

  /**
   * Phase 20.2 — Retrieves the raw material reconciliation queue.
   * Lists SCs that have pending store-ack returns, unresolved variances, or are awaiting final closure.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('rm/reconciliation-queue')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getRmReconciliationQueue(
    @Query() query: RmReconciliationQueueFilterDto,
  ): Promise<RmReconciliationQueueResponseDto> {
    return this.traceabilityService.getRmReconciliationQueue(query);
  }

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

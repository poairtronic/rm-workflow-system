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
import { ConsolidatedScTraceabilityDto } from './dto/consolidated-sc-traceability.dto.js';
import { ConsolidatedPoTraceabilityDto } from './dto/consolidated-po-traceability.dto.js';
import {
  VendorTraceabilityResponseDto,
  VendorPerformanceAnalyticsResponseDto,
} from './dto/vendor-traceability.dto.js';
import {
  ProcessOutwardAnalyticsResponseDto,
  ItemOutwardAnalyticsResponseDto,
  RmConsumptionFilterDto,
  RmConsumptionAnalyticsResponseDto,
  InventoryMslFilterDto,
  InventoryMslStatusResponseDto,
} from './dto/enterprise-analytics.dto.js';

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
   * Phase 20.4 — Build the comprehensive, top-level PO Consolidated Traceability API.
   * Aggregates all child SCs under a PO with cumulative RM, inventory, production, DC, and vendor metrics.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('po/:poId/consolidated')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getConsolidatedPoTraceability(
    @Param('poId', ParseUUIDPipe) poId: string,
  ): Promise<ConsolidatedPoTraceabilityDto> {
    return this.traceabilityService.getConsolidatedPoTraceability(poId);
  }

  /**
   * Phase 20.3 — Build the comprehensive, single-call consolidated traceability API for an SC.
   * Aggregates SC, PO, customer, RM requests, material issues, receipts, consumptions, returns,
   * additional requests, stock transactions, processes, delivery challans, vendors, and final RM usage.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('sc/:scId/consolidated')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getConsolidatedScTraceability(
    @Param('scId', ParseUUIDPipe) scId: string,
  ): Promise<ConsolidatedScTraceabilityDto> {
    return this.traceabilityService.getConsolidatedScTraceability(scId);
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

  /**
   * Phase 20.5 — Aggregates global vendor performance analytics across all vendors.
   * Computes overall SLA compliance, average turnaround duration, DC ageing distribution,
   * and individual vendor performance rankings.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('vendors/performance-analytics')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getVendorPerformanceAnalytics(): Promise<VendorPerformanceAnalyticsResponseDto> {
    return this.traceabilityService.getVendorPerformanceAnalytics();
  }

  /**
   * Phase 20.5 — Aggregates and reports comprehensive vendor traceability.
   * Tracks total DCs, open DCs, closed DCs, overdue DCs, items in custody,
   * associated processes, turnaround times, and SLA compliance.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('vendors/:vendorId/traceability')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getVendorTraceability(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
  ): Promise<VendorTraceabilityResponseDto> {
    return this.traceabilityService.getVendorTraceability(vendorId);
  }

  /**
   * Phase 20.6 — Process-wise Outward Summary.
   * Aggregated volume and count of Delivery Challans categorized by production process steps.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('analytics/process-outward')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getProcessOutwardAnalytics(): Promise<ProcessOutwardAnalyticsResponseDto> {
    return this.traceabilityService.getProcessOutwardAnalytics();
  }

  /**
   * Phase 20.6 — Item-wise Outward Summary.
   * Total quantities dispatched externally per raw material product/item.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('analytics/item-outward')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getItemOutwardAnalytics(): Promise<ItemOutwardAnalyticsResponseDto> {
    return this.traceabilityService.getItemOutwardAnalytics();
  }

  /**
   * Phase 20.6 — RM Consumption Summary.
   * Total raw materials consumed across all shop-floor operations grouped by material & category.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('analytics/rm-consumption')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getRmConsumptionAnalytics(
    @Query() query: RmConsumptionFilterDto,
  ): Promise<RmConsumptionAnalyticsResponseDto> {
    return this.traceabilityService.getRmConsumptionAnalytics(query);
  }

  /**
   * Phase 20.6 — MSL & Stock Status Dashboard.
   * Real-time stock alerts returning items below Minimum Stock Level (MSL),
   * critical stock deficiencies, and complete out-of-stock items.
   * Authorized roles: STORES, PRODUCTION, SENIOR_MANAGER, ADMIN, GENERAL_MANAGER
   */
  @Get('analytics/inventory-msl-status')
  @Roles(
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.ADMIN,
    UserRole.GENERAL_MANAGER,
  )
  async getInventoryMslStatus(
    @Query() query: InventoryMslFilterDto,
  ): Promise<InventoryMslStatusResponseDto> {
    return this.traceabilityService.getInventoryMslStatus(query);
  }
}



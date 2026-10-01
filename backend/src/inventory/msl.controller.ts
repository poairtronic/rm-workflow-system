import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { MslCalculationService, MslCalculationResult } from './msl-calculation.service.js';
import { MslAlertService, MslAlertEvaluationResult } from './msl-alert.service.js';
import { MslTriggerService } from './msl-trigger.service.js';
import { MslAlert } from './entities/msl-alert.entity.js';

@Controller('api/inventory/msl')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MslController {
  constructor(
    private readonly mslCalculationService: MslCalculationService,
    private readonly mslAlertService: MslAlertService,
    private readonly mslTriggerService: MslTriggerService,
  ) {}

  /**
   * Get MSL status for all active products across enterprise catalogue
   */
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getAllMslStatus(): Promise<MslCalculationResult[]> {
    return this.mslCalculationService.evaluateAllProducts();
  }

  /**
   * Get only products breaching MSL thresholds (OUT_OF_STOCK, LOW_STOCK, EXCESS)
   */
  @Get('breached')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getBreachedProducts(): Promise<MslCalculationResult[]> {
    return this.mslCalculationService.getBreachedProducts();
  }

  /**
   * Get all currently ACTIVE MSL alerts
   */
  @Get('alerts')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getActiveAlerts(): Promise<MslAlert[]> {
    return this.mslAlertService.getActiveAlerts();
  }

  /**
   * Check MSL status for a specific product
   */
  @Get('products/:id')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getProductMsl(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MslCalculationResult> {
    const result = await this.mslCalculationService.checkProductMsl(id);
    if (!result) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }
    return result;
  }

  /**
   * Get alert history for a specific product
   */
  @Get('products/:id/history')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getProductAlertHistory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MslAlert[]> {
    return this.mslAlertService.getAlertHistory(id);
  }

  /**
   * Trigger on-demand MSL evaluation and notification dispatch
   */
  @Post('evaluate')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  async evaluateAll(): Promise<MslAlertEvaluationResult[]> {
    return this.mslAlertService.evaluateAllAndAlert();
  }

  /**
   * Run scheduled reconciliation sweep on demand with concurrency lock
   */
  @Post('sweep')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  async runSweep(): Promise<MslAlertEvaluationResult[]> {
    return this.mslTriggerService.runScheduledSweep();
  }

  /**
   * Get sweep concurrency status and stats from last sweep
   */
  @Get('sweep-status')
  @Roles(
    UserRole.ADMIN,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.DESIGNER,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getSweepStatus() {
    return {
      isRunning: this.mslTriggerService.isSweepRunning(),
      lastSweepTime: this.mslTriggerService.getLastSweepTime(),
      lastSweepStats: this.mslTriggerService.getLastSweepStats(),
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ProductionProcessService } from './production-process.service.js';
import {
  ProcessRoutingService,
  ProcessNavigationInfo,
  ProcessTransitionValidationResult,
} from './process-routing.service.js';
import { CreateProductionProcessDto } from './dto/create-production-process.dto.js';
import { UpdateProductionProcessDto } from './dto/update-production-process.dto.js';
import { GetProductionProcessFilterDto } from './dto/get-production-process-filter.dto.js';
import { ValidateProcessTransitionDto } from './dto/validate-transition.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { ProductionProcess } from './entities/production-process.entity.js';

@Controller('api/production-processes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductionProcessController {
  constructor(
    private readonly productionProcessService: ProductionProcessService,
    private readonly processRoutingService: ProcessRoutingService,
  ) {}

  /**
   * Create a new production process routing step.
   * Write access restricted to ADMIN, STORES, and PRODUCTION roles.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION)
  create(
    @Body() createDto: CreateProductionProcessDto,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.create(createDto);
  }

  /**
   * Retrieve all production processes ordered by sequence number.
   * Read access permitted for all authenticated users.
   */
  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true }))
    filterDto: GetProductionProcessFilterDto,
  ): Promise<ProductionProcess[]> {
    return this.productionProcessService.findAll(filterDto);
  }

  // =========================================================================
  // ROUTING & SEQUENCE RULES ENDPOINTS (MUST BE BEFORE :id)
  // =========================================================================

  /**
   * Retrieve the initial manufacturing step (lowest active sequence number).
   */
  @Get('routing/first')
  getFirstProcess(): Promise<ProductionProcess | null> {
    return this.processRoutingService.getFirstProcess();
  }

  /**
   * Retrieve the terminal manufacturing step (highest active sequence number).
   */
  @Get('routing/final')
  getFinalProcess(): Promise<ProductionProcess | null> {
    return this.processRoutingService.getFinalProcess();
  }

  /**
   * Retrieve all active processes that permit outside-vendor processing (job work).
   * Critical for Delivery Challan (DC Type 1).
   */
  @Get('routing/vendor-eligible')
  getEligibleVendorProcesses(): Promise<ProductionProcess[]> {
    return this.processRoutingService.getEligibleVendorProcesses();
  }

  /**
   * Validate whether a work-order or batch can transition from fromProcess to toProcess.
   */
  @Post('routing/validate-transition')
  validateTransition(
    @Body() dto: ValidateProcessTransitionDto,
  ): Promise<ProcessTransitionValidationResult> {
    return this.processRoutingService.validateTransition(
      dto.fromProcessId,
      dto.toProcessId,
    );
  }

  // =========================================================================
  // PARAMETRIC ID ENDPOINTS
  // =========================================================================

  /**
   * Retrieve navigation context for a specific process step (previous, next, flags).
   */
  @Get(':id/navigation')
  getNavigation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProcessNavigationInfo> {
    return this.processRoutingService.getNavigation(id);
  }

  /**
   * Retrieve a single production process by UUID.
   * Read access permitted for all authenticated users.
   */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.findOne(id);
  }

  /**
   * Update an existing production process details.
   * Write access restricted to ADMIN, STORES, and PRODUCTION roles.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateProductionProcessDto,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.update(id, updateDto);
  }

  /**
   * Toggle the active status of a production process.
   * Write access restricted to ADMIN, STORES, and PRODUCTION roles.
   */
  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.PRODUCTION)
  toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductionProcess> {
    return this.productionProcessService.toggleActive(id);
  }
}

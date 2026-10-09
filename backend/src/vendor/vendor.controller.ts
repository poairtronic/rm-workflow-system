import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
  Req,
} from '@nestjs/common';
import { VendorService } from './vendor.service.js';
import {
  VendorCapabilityService,
  VendorProcessValidationResult,
} from './vendor-capability.service.js';
import {
  VendorSlaService,
  ExpectedReturnCalculationResult,
  VendorComparisonResult,
  VendorComplianceResult,
} from './vendor-sla.service.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';
import { GetVendorFilterDto } from './dto/get-vendor-filter.dto.js';
import { AssignVendorCapabilityDto } from './dto/assign-vendor-capability.dto.js';
import { UpdateVendorCapabilityDto } from './dto/update-vendor-capability.dto.js';
import { CreateVendorSlaDto } from './dto/create-vendor-sla.dto.js';
import { UpdateVendorSlaDto } from './dto/update-vendor-sla.dto.js';
import { RecordSlaOverrideDto } from './dto/record-sla-override.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { Vendor } from './entities/vendor.entity.js';
import { VendorProcessCapability } from './entities/vendor-process-capability.entity.js';
import { VendorSla } from './entities/vendor-sla.entity.js';
import { VendorSlaOverride } from './entities/vendor-sla-override.entity.js';

@Controller('api/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  constructor(
    private readonly vendorService: VendorService,
    private readonly capabilityService: VendorCapabilityService,
    private readonly slaService: VendorSlaService,
  ) {}

  /**
   * Create a new Vendor master record.
   * Write access restricted to ADMIN and STORES roles.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  create(@Body() createDto: CreateVendorDto): Promise<Vendor> {
    return this.vendorService.create(createDto);
  }

  /**
   * Retrieve all vendors with optional search, category, and active status filters.
   * Read access permitted for all authenticated users.
   */
  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true }))
    filterDto: GetVendorFilterDto,
  ): Promise<Vendor[]> {
    return this.vendorService.findAll(filterDto);
  }

  /**
   * Retrieve all vendors approved for a specific manufacturing process.
   * Static subroute placed before /:id to prevent route hijacking.
   */
  @Get('capabilities/by-process/:processId')
  getVendorsForProcess(
    @Param('processId', ParseUUIDPipe) processId: string,
  ): Promise<VendorProcessCapability[]> {
    return this.capabilityService.getVendorsForProcess(processId);
  }

  /**
   * Update an existing SLA agreement by its UUID.
   * Placed before /:id to prevent route hijacking.
   */
  @Patch('slas/:slaId')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  updateSla(
    @Param('slaId', ParseUUIDPipe) slaId: string,
    @Body() dto: UpdateVendorSlaDto,
  ): Promise<VendorSla> {
    return this.slaService.updateSla(slaId, dto);
  }

  /**
   * Delete / remove an SLA agreement by its UUID.
   * Placed before /:id to prevent route hijacking.
   */
  @Delete('slas/:slaId')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  removeSla(
    @Param('slaId', ParseUUIDPipe) slaId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.slaService.removeSla(slaId);
  }

  /**
   * Retrieve all SLA agreements across all vendors.
   * Placed before /:id to prevent route hijacking.
   */
  @Get('slas')
  getAllSlas(): Promise<VendorSla[]> {
    return this.slaService.getAllSlas();
  }

  /**
   * Compare all approved vendors providing a specific manufacturing process.
   * Placed before /:id to prevent route hijacking.
   */
  @Get('compare/by-process/:processId')
  compareVendors(
    @Param('processId', ParseUUIDPipe) processId: string,
  ): Promise<VendorComparisonResult[]> {
    return this.slaService.compareVendorsForProcess(processId);
  }

  /**
   * Record an SLA Exception Override.
   * Placed before /:id to prevent route hijacking.
   */
  @Post('slas/:slaId/override')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER, UserRole.SENIOR_MANAGER)
  recordOverride(
    @Param('slaId', ParseUUIDPipe) slaId: string,
    @Body() dto: RecordSlaOverrideDto,
    @Req() req: any,
  ): Promise<VendorSlaOverride> {
    const userId = req.user?.userId || req.user?.id;
    return this.slaService.recordOverride(slaId, userId, dto);
  }

  /**
   * Retrieve exception overrides logged for an SLA.
   * Placed before /:id to prevent route hijacking.
   */
  @Get('slas/:slaId/overrides')
  getOverrides(
    @Param('slaId', ParseUUIDPipe) slaId: string,
  ): Promise<VendorSlaOverride[]> {
    return this.slaService.getOverrides(slaId);
  }

  /**
   * Retrieve a single vendor by UUID.
   * Read access permitted for all authenticated users.
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Vendor> {
    return this.vendorService.findOne(id);
  }

  /**
   * Retrieve 6-month historical SLA compliance trend for a vendor.
   */
  @Get(':id/compliance')
  getVendorCompliance(
    @Param('id', ParseUUIDPipe) vendorId: string,
  ): Promise<VendorComplianceResult> {
    return this.slaService.getVendorCompliance(vendorId);
  }

  /**
   * Update an existing vendor.
   * Write access restricted to ADMIN and STORES roles.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVendorDto,
  ): Promise<Vendor> {
    return this.vendorService.update(id, updateDto);
  }

  /**
   * Toggle vendor active status.
   * Restricted to ADMIN and STORES roles.
   */
  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  toggleActive(@Param('id', ParseUUIDPipe) id: string): Promise<Vendor> {
    return this.vendorService.toggleActive(id);
  }

  /**
   * Soft-deactivate a vendor.
   * Restricted to ADMIN and STORES roles.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.vendorService.remove(id);
  }

  // =========================================================================
  // VENDOR PROCESS CAPABILITIES
  // =========================================================================

  /**
   * Assign a process capability to a vendor.
   * Restricted to ADMIN and STORES roles.
   */
  @Post(':id/capabilities')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  assignCapability(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Body() dto: AssignVendorCapabilityDto,
  ): Promise<VendorProcessCapability> {
    return this.capabilityService.assignCapability(vendorId, dto);
  }

  /**
   * Retrieve all capabilities assigned to a vendor.
   * Read access permitted for all authenticated users.
   */
  @Get(':id/capabilities')
  getVendorCapabilities(
    @Param('id', ParseUUIDPipe) vendorId: string,
  ): Promise<VendorProcessCapability[]> {
    return this.capabilityService.getVendorCapabilities(vendorId);
  }

  /**
   * Validate whether a vendor is actively certified/approved for a specific process.
   * Foundation check for Delivery Challan (DC Type 1).
   */
  @Get(':id/capabilities/:processId/validate')
  validateVendorProcess(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
  ): Promise<VendorProcessValidationResult> {
    return this.capabilityService.validateVendorProcess(vendorId, processId);
  }

  /**
   * Update capability parameters (approval status, lead time, notes).
   * Restricted to ADMIN and STORES roles.
   */
  @Patch(':id/capabilities/:processId')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  updateCapability(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
    @Body() dto: UpdateVendorCapabilityDto,
  ): Promise<VendorProcessCapability> {
    return this.capabilityService.updateCapability(vendorId, processId, dto);
  }

  /**
   * Revoke / remove a capability assignment.
   * Restricted to ADMIN and STORES roles.
   */
  @Delete(':id/capabilities/:processId')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  removeCapability(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.capabilityService.removeCapability(vendorId, processId);
  }

  // =========================================================================
  // VENDOR SLA FOUNDATION (PHASE 18.5)
  // =========================================================================

  /**
   * Create or configure an SLA agreement for a vendor and process.
   * Restricted to ADMIN and STORES roles.
   */
  @Post(':id/slas')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  createSla(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Body() dto: CreateVendorSlaDto,
  ): Promise<VendorSla> {
    return this.slaService.createSla(vendorId, dto);
  }

  /**
   * Retrieve all SLA agreements for a vendor.
   * Read access permitted for all authenticated users.
   */
  @Get(':id/slas')
  getVendorSlas(
    @Param('id', ParseUUIDPipe) vendorId: string,
  ): Promise<VendorSla[]> {
    return this.slaService.getVendorSlas(vendorId);
  }

  /**
   * Retrieve active SLA agreement for a vendor and process.
   * Read access permitted for all authenticated users.
   */
  @Get(':id/slas/:processId')
  getSlaForVendorProcess(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
  ): Promise<VendorSla> {
    return this.slaService.getSlaForVendorProcess(vendorId, processId);
  }

  /**
   * Calculate expected return date for DC Type 1 based on vendor SLA days.
   * Read access permitted for all authenticated users.
   */
  @Get(':id/slas/:processId/expected-return')
  calculateExpectedReturnDate(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
    @Query('dispatchDate') dispatchDate?: string,
  ): Promise<ExpectedReturnCalculationResult> {
    const parsedDate = dispatchDate ? new Date(dispatchDate) : new Date();
    return this.slaService.calculateExpectedReturnDate(vendorId, processId, parsedDate);
  }
}


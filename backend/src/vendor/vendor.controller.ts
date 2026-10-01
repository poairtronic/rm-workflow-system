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
} from '@nestjs/common';
import { VendorService } from './vendor.service.js';
import {
  VendorCapabilityService,
  VendorProcessValidationResult,
} from './vendor-capability.service.js';
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';
import { GetVendorFilterDto } from './dto/get-vendor-filter.dto.js';
import { AssignVendorCapabilityDto } from './dto/assign-vendor-capability.dto.js';
import { UpdateVendorCapabilityDto } from './dto/update-vendor-capability.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { Vendor } from './entities/vendor.entity.js';
import { VendorProcessCapability } from './entities/vendor-process-capability.entity.js';

@Controller('api/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  constructor(
    private readonly vendorService: VendorService,
    private readonly capabilityService: VendorCapabilityService,
  ) {}

  /**
   * Create a new Vendor master record.
   * Write access restricted to ADMIN and STORES roles.
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
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
   * Retrieve a single vendor by UUID.
   * Read access permitted for all authenticated users.
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Vendor> {
    return this.vendorService.findOne(id);
  }

  /**
   * Update an existing vendor.
   * Write access restricted to ADMIN and STORES roles.
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
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
  @Roles(UserRole.ADMIN, UserRole.STORES)
  toggleActive(@Param('id', ParseUUIDPipe) id: string): Promise<Vendor> {
    return this.vendorService.toggleActive(id);
  }

  /**
   * Soft-deactivate a vendor.
   * Restricted to ADMIN and STORES roles.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
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
  @Roles(UserRole.ADMIN, UserRole.STORES)
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
  @Roles(UserRole.ADMIN, UserRole.STORES)
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
  @Roles(UserRole.ADMIN, UserRole.STORES)
  removeCapability(
    @Param('id', ParseUUIDPipe) vendorId: string,
    @Param('processId', ParseUUIDPipe) processId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.capabilityService.removeCapability(vendorId, processId);
  }
}


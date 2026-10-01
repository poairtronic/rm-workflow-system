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
import { CreateVendorDto } from './dto/create-vendor.dto.js';
import { UpdateVendorDto } from './dto/update-vendor.dto.js';
import { GetVendorFilterDto } from './dto/get-vendor-filter.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { Vendor } from './entities/vendor.entity.js';

@Controller('api/vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

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
}


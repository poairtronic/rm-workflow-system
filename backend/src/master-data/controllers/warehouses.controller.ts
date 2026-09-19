import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MasterDataService } from '../master-data.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { UserRole } from '../../auth/enums/role.enum.js';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '../dto/warehouse.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';

@Controller('api/warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findWarehouses(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findWarehouses(filter);
  }

  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findWarehouseById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findWarehouseById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.masterDataService.createWarehouse(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  updateWarehouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.masterDataService.updateWarehouse(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  deleteWarehouse(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteWarehouse(id);
  }
}

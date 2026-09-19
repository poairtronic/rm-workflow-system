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
import { CreateLocationDto, UpdateLocationDto } from '../dto/location.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';

@Controller('api/locations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocationsController {
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
  findLocations(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findLocations(filter);
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
  findLocationById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findLocationById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  createLocation(@Body() dto: CreateLocationDto) {
    return this.masterDataService.createLocation(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.masterDataService.updateLocation(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  deleteLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteLocation(id);
  }
}

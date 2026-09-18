import {
  Controller,
  Get,
  Post,
  Patch,
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
  CreateRackDto,
  UpdateRackDto,
} from '../dto/rack.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';

@Controller('api/racks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RacksController {
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
  findRacks(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findRacks(filter);
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
  findRackById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findRackById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  createRack(@Body() dto: CreateRackDto) {
    return this.masterDataService.createRack(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  updateRack(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRackDto,
  ) {
    return this.masterDataService.updateRack(id, dto);
  }
}

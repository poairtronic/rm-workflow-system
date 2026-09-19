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
import { CreateFamilyDto, UpdateFamilyDto } from '../dto/family.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';

@Controller('api/families')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FamiliesController {
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
  findFamilies(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findFamilies(filter);
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
  findFamilyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findFamilyById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  createFamily(@Body() dto: CreateFamilyDto) {
    return this.masterDataService.createFamily(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  updateFamily(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.masterDataService.updateFamily(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  deleteFamily(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteFamily(id);
  }
}

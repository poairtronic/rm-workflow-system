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
import { CreateBinDto, UpdateBinDto } from '../dto/bin.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';
import {
  CacheNamespace,
  InvalidateCache,
} from '../../common/cache/cache.decorators.js';

@Controller(['api/bins', 'api/master-data/bins'])
@UseGuards(JwtAuthGuard, RolesGuard)
@CacheNamespace('bins')
export class BinsController {
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
  findBins(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findBins(filter);
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
  findBinById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findBinById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  @InvalidateCache('bins')
  createBin(@Body() dto: CreateBinDto) {
    return this.masterDataService.createBin(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  @InvalidateCache('bins')
  updateBin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBinDto) {
    return this.masterDataService.updateBin(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  @InvalidateCache('bins')
  deleteBin(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteBin(id);
  }
}

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
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../dto/category.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';

@Controller('api/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
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
  findCategories(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findCategories(filter);
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
  findCategoryById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findCategoryById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.masterDataService.createCategory(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.masterDataService.updateCategory(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteCategory(id);
  }
}

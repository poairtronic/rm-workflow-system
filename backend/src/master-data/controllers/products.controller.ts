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
  CreateProductDto,
  UpdateProductDto,
} from '../dto/product.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';

@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
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
  findProducts(@Query() filter: MasterFilterDto) {
    return this.masterDataService.findProducts(filter);
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
  findProductById(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.findProductById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORES)
  createProduct(@Body() dto: CreateProductDto) {
    return this.masterDataService.createProduct(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES)
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.masterDataService.updateProduct(id, dto);
  }
}

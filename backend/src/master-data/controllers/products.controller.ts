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
import { CreateProductDto, UpdateProductDto } from '../dto/product.dto.js';
import { MasterFilterDto } from '../dto/master-filter.dto.js';
import {
  CacheNamespace,
  InvalidateCache,
  NoCache,
} from '../../common/cache/cache.decorators.js';

@Controller(['api/products', 'products'])
@UseGuards(JwtAuthGuard, RolesGuard)
@CacheNamespace('products')
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

  @Get('by-barcode/:barcode')
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  findProductByBarcode(@Param('barcode') barcode: string) {
    return this.masterDataService.findProductByBarcode(barcode);
  }

  @Post('backfill-barcodes')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  @InvalidateCache('products')
  backfillBarcodes() {
    return this.masterDataService.backfillBarcodes();
  }

  @Get('next-code')
  @NoCache()
  @Roles(
    UserRole.ADMIN,
    UserRole.DESIGNER,
    UserRole.STORES,
    UserRole.PRODUCTION,
    UserRole.SENIOR_MANAGER,
    UserRole.GENERAL_MANAGER,
  )
  async getNextProductCode() {
    const nextCode = await this.masterDataService.generateUniqueProductCode();
    return { nextCode };
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
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  @InvalidateCache('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.masterDataService.createProduct(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  @InvalidateCache('products')
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.masterDataService.updateProduct(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORES, UserRole.GENERAL_MANAGER)
  @InvalidateCache('products')
  deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.masterDataService.deleteProduct(id);
  }
}

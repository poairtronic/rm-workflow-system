import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from '../inventory/entities/product-category.entity.js';
import { ProductFamily } from '../inventory/entities/product-family.entity.js';
import { Product } from '../inventory/entities/product.entity.js';
import { Warehouse } from '../inventory/entities/warehouse.entity.js';
import { WarehouseLocation } from '../inventory/entities/warehouse-location.entity.js';
import { Rack } from '../inventory/entities/rack.entity.js';
import { Bin } from '../inventory/entities/bin.entity.js';

import { MasterDataService } from './master-data.service.js';
import { CategoriesController } from './controllers/categories.controller.js';
import { FamiliesController } from './controllers/families.controller.js';
import { ProductsController } from './controllers/products.controller.js';
import { WarehousesController } from './controllers/warehouses.controller.js';
import { LocationsController } from './controllers/locations.controller.js';
import { RacksController } from './controllers/racks.controller.js';
import { BinsController } from './controllers/bins.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductCategory,
      ProductFamily,
      Product,
      Warehouse,
      WarehouseLocation,
      Rack,
      Bin,
    ]),
  ],
  controllers: [
    CategoriesController,
    FamiliesController,
    ProductsController,
    WarehousesController,
    LocationsController,
    RacksController,
    BinsController,
  ],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}

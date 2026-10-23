import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { ReworkController } from './rework.controller.js';
import { ReworkService } from './rework.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesOrderComponent, PurchaseOrder]),
  ],
  controllers: [ReworkController],
  providers: [ReworkService],
  exports: [ReworkService],
})
export class ReworkModule {}

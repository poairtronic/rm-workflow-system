import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrderComponent } from './entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { Customer } from '../customers/entities/customer.entity.js';
import { ScService } from './sc.service.js';
import { ScController } from './sc.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesOrderComponent,
      PurchaseOrder,
      Customer,
    ]),
  ],
  controllers: [ScController],
  providers: [ScService],
  exports: [ScService],
})
export class ScModule {}

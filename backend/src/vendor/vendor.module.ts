import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Vendor } from './entities/vendor.entity.js';
import { VendorController } from './vendor.controller.js';
import { VendorService } from './vendor.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor]),
    AuthModule,
  ],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}


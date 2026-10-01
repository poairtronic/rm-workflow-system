import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Vendor } from './entities/vendor.entity.js';
import { VendorProcessCapability } from './entities/vendor-process-capability.entity.js';
import { ProductionProcess } from '../production-process/entities/production-process.entity.js';
import { VendorController } from './vendor.controller.js';
import { VendorService } from './vendor.service.js';
import { VendorCapabilityService } from './vendor-capability.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vendor,
      VendorProcessCapability,
      ProductionProcess,
    ]),
    AuthModule,
  ],
  controllers: [VendorController],
  providers: [VendorService, VendorCapabilityService],
  exports: [VendorService, VendorCapabilityService],
})
export class VendorModule {}


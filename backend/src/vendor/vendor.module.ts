import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Vendor } from './entities/vendor.entity.js';
import { VendorProcessCapability } from './entities/vendor-process-capability.entity.js';
import { VendorSla } from './entities/vendor-sla.entity.js';
import { ProductionProcess } from '../production-process/entities/production-process.entity.js';
import { VendorController } from './vendor.controller.js';
import { VendorService } from './vendor.service.js';
import { VendorCapabilityService } from './vendor-capability.service.js';
import { VendorSlaService } from './vendor-sla.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vendor,
      VendorProcessCapability,
      VendorSla,
      ProductionProcess,
    ]),
    AuthModule,
  ],
  controllers: [VendorController],
  providers: [VendorService, VendorCapabilityService, VendorSlaService],
  exports: [VendorService, VendorCapabilityService, VendorSlaService],
})
export class VendorModule {}


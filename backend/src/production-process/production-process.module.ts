import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { ProductionProcess } from './entities/production-process.entity.js';
import { ProductionProcessController } from './production-process.controller.js';
import { ProductionProcessService } from './production-process.service.js';
import { ProcessRoutingService } from './process-routing.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductionProcess]),
    AuthModule,
  ],
  controllers: [ProductionProcessController],
  providers: [ProductionProcessService, ProcessRoutingService],
  exports: [ProductionProcessService, ProcessRoutingService],
})
export class ProductionProcessModule {}

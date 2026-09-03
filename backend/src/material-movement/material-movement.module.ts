import { Module } from '@nestjs/common';
import { MaterialMovementController } from './material-movement.controller.js';
import { MaterialMovementService } from './material-movement.service.js';

@Module({
  controllers: [MaterialMovementController],
  providers: [MaterialMovementService],
  exports: [MaterialMovementService],
})
export class MaterialMovementModule {}

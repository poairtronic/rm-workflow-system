import { Controller, Get } from '@nestjs/common';
import { MaterialMovementService } from './material-movement.service.js';

@Controller('api/material-movement')
export class MaterialMovementController {
  constructor(
    private readonly materialMovementService: MaterialMovementService,
  ) {}

  @Get('status')
  getStatus() {
    return this.materialMovementService.getStatus();
  }
}

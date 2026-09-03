import { Controller, Get, UseGuards } from '@nestjs/common';
import { MaterialMovementService } from './material-movement.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/material-movement')
export class MaterialMovementController {
  constructor(private readonly materialMovementService: MaterialMovementService) {}

  @Get('status')
  getStatus() {
    return this.materialMovementService.getStatus();
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProductionService } from './production.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('status')
  getStatus() {
    return this.productionService.getStatus();
  }
}

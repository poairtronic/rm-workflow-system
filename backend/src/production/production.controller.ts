import { Controller, Get } from '@nestjs/common';
import { ProductionService } from './production.service.js';

@Controller('api/production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('status')
  getStatus() {
    return this.productionService.getStatus();
  }
}

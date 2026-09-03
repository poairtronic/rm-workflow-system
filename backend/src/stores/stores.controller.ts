import { Controller, Get, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('status')
  getStatus() {
    return this.storesService.getStatus();
  }
}

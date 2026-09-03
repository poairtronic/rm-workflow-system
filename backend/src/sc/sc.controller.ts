import { Controller, Get, UseGuards } from '@nestjs/common';
import { ScService } from './sc.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/sc')
export class ScController {
  constructor(private readonly scService: ScService) {}

  @Get('status')
  getStatus() {
    return this.scService.getStatus();
  }
}

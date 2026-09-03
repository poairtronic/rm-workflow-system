import { Controller, Get, UseGuards } from '@nestjs/common';
import { PoService } from './po.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/po')
export class PoController {
  constructor(private readonly poService: PoService) {}

  @Get('status')
  getStatus() {
    return this.poService.getStatus();
  }
}

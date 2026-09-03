import { Controller, Get, UseGuards } from '@nestjs/common';
import { RmService } from './rm.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/rm')
export class RmController {
  constructor(private readonly rmService: RmService) {}

  @Get('status')
  getStatus() {
    return this.rmService.getStatus();
  }
}

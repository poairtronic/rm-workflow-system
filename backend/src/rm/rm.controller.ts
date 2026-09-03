import { Controller, Get } from '@nestjs/common';
import { RmService } from './rm.service.js';

@Controller('api/rm')
export class RmController {
  constructor(private readonly rmService: RmService) {}

  @Get('status')
  getStatus() {
    return this.rmService.getStatus();
  }
}

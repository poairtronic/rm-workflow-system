import { Controller, Get } from '@nestjs/common';
import { PoService } from './po.service.js';

@Controller('api/po')
export class PoController {
  constructor(private readonly poService: PoService) {}

  @Get('status')
  getStatus() {
    return this.poService.getStatus();
  }
}

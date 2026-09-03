import { Controller, Get } from '@nestjs/common';
import { ScService } from './sc.service.js';

@Controller('api/sc')
export class ScController {
  constructor(private readonly scService: ScService) {}

  @Get('status')
  getStatus() {
    return this.scService.getStatus();
  }
}

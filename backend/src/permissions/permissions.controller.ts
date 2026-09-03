import { Controller, Get } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';

@Controller('api/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('status')
  getStatus() {
    return this.permissionsService.getStatus();
  }
}

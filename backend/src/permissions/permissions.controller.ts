import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('status')
  getStatus() {
    return this.permissionsService.getStatus();
  }
}

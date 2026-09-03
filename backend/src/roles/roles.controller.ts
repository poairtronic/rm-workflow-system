import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('status')
  getStatus() {
    return this.rolesService.getStatus();
  }
}

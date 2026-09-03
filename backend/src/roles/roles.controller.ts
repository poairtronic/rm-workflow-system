import { Controller, Get } from '@nestjs/common';
import { RolesService } from './roles.service.js';

@Controller('api/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('status')
  getStatus() {
    return this.rolesService.getStatus();
  }
}

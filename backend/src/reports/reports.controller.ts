import { Controller, Get, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('process-wise')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getProcessWise() {
    return this.reportsService.getProcessWiseReport();
  }

  @Get('item-wise')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getItemWise() {
    return this.reportsService.getItemWiseReport();
  }

  @Get('rm-consumption')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getRmConsumption() {
    return this.reportsService.getRmConsumptionReport();
  }
}


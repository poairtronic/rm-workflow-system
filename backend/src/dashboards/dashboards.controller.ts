import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardsService } from './dashboards.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';

@Controller('api/dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('designer')
  @Roles(UserRole.DESIGNER, UserRole.ADMIN)
  async getDesignerDashboard(@Req() req: any) {
    const userId = req.user.id;
    return this.dashboardsService.getDesignerDashboard(userId);
  }

  @Get('stores')
  @Roles(UserRole.STORES, UserRole.ADMIN)
  async getStoresDashboard() {
    return this.dashboardsService.getStoresDashboard();
  }

  @Get('production')
  @Roles(UserRole.PRODUCTION, UserRole.ADMIN)
  async getProductionDashboard() {
    return this.dashboardsService.getProductionDashboard();
  }

  @Get('management')
  @Roles(UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getManagementDashboard() {
    return this.dashboardsService.getManagementDashboard();
  }

  @Get('overview')
  @Roles(UserRole.DESIGNER, UserRole.STORES, UserRole.PRODUCTION, UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ADMIN)
  async getUnifiedOverview() {
    return this.dashboardsService.getUnifiedOverview();
  }
}


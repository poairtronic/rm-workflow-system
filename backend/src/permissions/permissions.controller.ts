import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../auth/enums/role.enum.js';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto.js';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto.js';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('modules')
  async getAllModules() {
    return this.permissionsService.getAllModules();
  }

  @Get('matrix')
  @Roles(UserRole.ADMIN)
  async getRoleMatrix() {
    return this.permissionsService.getRoleMatrix();
  }

  @Put('role/:roleId')
  @Roles(UserRole.ADMIN)
  async updateRolePermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.permissionsService.updateRolePermissions(
      roleId,
      dto.allowedModuleKeys,
    );
  }

  @Get('my-modules')
  async getMyModules(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.permissionsService.getUserPermissions(userId);
  }

  @Get('user/:userId')
  async getUserPermissions(@Param('userId') targetUserId: string, @Req() req: any) {
    const currentUserId = req.user?.sub || req.user?.userId;
    const currentRole = req.user?.role;

    // Only Admin can view other users' permissions; any user can view their own
    if (currentRole !== UserRole.ADMIN && currentUserId !== targetUserId) {
      throw new ForbiddenException('Cannot inspect other users permissions');
    }

    return this.permissionsService.getUserPermissions(targetUserId);
  }

  @Put('user/:userId')
  @Roles(UserRole.ADMIN)
  async updateUserPermissions(
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateUserPermissionsDto,
  ) {
    return this.permissionsService.updateUserOverrides(
      targetUserId,
      dto.overrides,
    );
  }
}

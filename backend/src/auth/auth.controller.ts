import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

import { PermissionsService } from '../permissions/permissions.service.js';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    let effectiveModules: string[] = [];
    try {
      const perms = await this.permissionsService.getUserPermissions(result.user.userId);
      effectiveModules = perms.effectiveModules;
    } catch {
      // Fallback
    }
    return {
      ...result,
      user: {
        ...result.user,
        id: result.user.userId,
        effectiveModules,
      },
    };
  }

  @Get('roles')
  getRoles() {
    return {
      operationalRoles: [
        UserRole.ADMIN,
        UserRole.DESIGNER,
        UserRole.STORES,
        UserRole.PRODUCTION,
      ],
      governanceRoles: [UserRole.SENIOR_MANAGER, UserRole.GENERAL_MANAGER],
    };
  }

  @Post('dev-token')
  getDevToken(@Body() body: { role?: UserRole; userId?: string }) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev token endpoint is strictly disabled in production');
    }
    const targetRole = body?.role ?? UserRole.ADMIN;
    return this.authService.createDevTestToken(targetRole, body?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: { user: any }) {
    const userId = req.user?.sub || req.user?.userId;
    let effectiveModules: string[] = [];
    try {
      const perms = await this.permissionsService.getUserPermissions(userId);
      effectiveModules = perms.effectiveModules;
    } catch {
      // Fallback
    }

    return {
      status: 'authenticated',
      user: {
        ...req.user,
        id: userId,
        effectiveModules,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: { user: any },
  ) {
    const currentUserId = req?.user?.userId || req?.user?.sub || req?.user?.id;
    return this.authService.changePassword(
      currentUserId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}

import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('roles')
  getRoles() {
    return {
      operationalRoles: [
        UserRole.ADMIN,
        UserRole.DESIGN_USER,
        UserRole.SENIOR_MANAGER,
        UserRole.STORES_MANAGER,
        UserRole.PRODUCTION_USER,
      ],
      governanceRoles: [
        UserRole.ACCOUNTS,
        UserRole.PRODUCTION_MANAGER,
        UserRole.MANAGEMENT,
      ],
    };
  }

  @Post('dev-token')
  getDevToken(@Body() body: { role?: UserRole }) {
    const targetRole = body?.role ?? UserRole.ADMIN;
    return this.authService.createDevTestToken(targetRole);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: { user: any }) {
    return {
      status: 'authenticated',
      user: req.user,
    };
  }
}

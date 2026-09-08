import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
      governanceRoles: [
        UserRole.SENIOR_MANAGER,
        UserRole.GENERAL_MANAGER,
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


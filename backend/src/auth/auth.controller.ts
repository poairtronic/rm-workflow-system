import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { UserRole } from './enums/role.enum.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { PermissionsService } from '../permissions/permissions.service.js';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful. Returns access token, refresh token, and user profile.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    const result = await this.authService.login(loginDto, userAgent);
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

  @ApiOperation({ summary: 'Rotate and refresh JWT access token using a valid refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully. Returns new access token and rotated refresh token.' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or revoked refresh token.' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: any) {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    const result = await this.authService.rotateRefreshToken(dto.refreshToken, userAgent);
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

  @ApiOperation({ summary: 'Revoke refresh token and end user session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto) {
    if (dto?.refreshToken) {
      await this.authService.revokeRefreshToken(dto.refreshToken);
    }
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset link via registered email' })
  @ApiResponse({
    status: 200,
    description: 'Generic success message returned to prevent user enumeration.',
  })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @ApiOperation({ summary: 'Validate if a password reset token is active and valid' })
  @ApiQuery({ name: 'token', required: true, description: 'Raw reset token from email link' })
  @ApiResponse({ status: 200, description: 'Token validation result.' })
  @Get('verify-reset-token')
  async verifyResetToken(@Query('token') token: string) {
    return this.authService.verifyResetToken(token);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Reset user password using a valid reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successful.' })
  @ApiResponse({ status: 400, description: 'Token invalid, expired, already used, or invalid password.' })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
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

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @Body() dto: { name?: string; department?: string },
    @Req() req: { user: any },
  ) {
    const currentUserId = req?.user?.userId || req?.user?.sub || req?.user?.id;
    return this.authService.updateProfile(currentUserId, dto);
  }
}

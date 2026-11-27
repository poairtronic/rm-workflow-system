import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { DevTokenDto } from './dto/dev-token.dto.js';
import { PermissionsService } from '../permissions/permissions.service.js';

const REFRESH_COOKIE_NAME = 'rm_refresh_token';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  private isCrossSiteSecure(req: any): boolean {
    return (
      process.env.NODE_ENV === 'production' ||
      Boolean(req?.secure) ||
      req?.headers?.['x-forwarded-proto'] === 'https'
    );
  }

  private extractRefreshCookie(req: any): string | undefined {
    const cookieHeader = req?.headers?.cookie;
    if (!cookieHeader || typeof cookieHeader !== 'string') return undefined;
    for (const part of cookieHeader.split(';')) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === REFRESH_COOKIE_NAME) {
        return decodeURIComponent(part.slice(idx + 1).trim());
      }
    }
    return undefined;
  }

  private setRefreshCookie(res: Response, req: any, token: string): void {
    const secure = this.isCrossSiteSecure(req);
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/api/auth',
      maxAge: this.authService.getRefreshExpiryMs(),
    });
  }

  private clearRefreshCookie(res: Response, req: any): void {
    const secure = this.isCrossSiteSecure(req);
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/api/auth',
    });
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful. Returns access token, refresh token, and user profile.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    const result = await this.authService.login(loginDto, userAgent);
    this.setRefreshCookie(res, req, result.refreshToken);
    let effectiveModules: string[] = [];
    let permissionsMap: Record<string, string> = {};
    try {
      const perms = await this.permissionsService.getUserPermissions(result.user.userId);
      effectiveModules = perms.effectiveModules;
      permissionsMap = perms.permissionsMap || {};
    } catch {
      // Fallback
    }
    return {
      ...result,
      user: {
        ...result.user,
        id: result.user.userId,
        effectiveModules,
        permissionsMap,
      },
    };
  }

  @ApiOperation({ summary: 'Rotate and refresh JWT access token using a valid refresh token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully. Returns new access token and rotated refresh token.' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or revoked refresh token.' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const userAgent = req?.headers ? req.headers['user-agent'] : undefined;
    const rawToken = dto?.refreshToken || this.extractRefreshCookie(req);
    if (!rawToken) {
      this.logger.warn('[AuthController.refresh] Missing refresh token in both body and httpOnly cookie');
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'REFRESH_INVALID',
        message: 'Refresh token cookie or payload is missing',
      });
    }
    const result = await this.authService.rotateRefreshToken(rawToken, userAgent);
    this.setRefreshCookie(res, req, result.refreshToken);
    let effectiveModules: string[] = [];
    let permissionsMap: Record<string, string> = {};
    try {
      const perms = await this.permissionsService.getUserPermissions(result.user.userId);
      effectiveModules = perms.effectiveModules;
      permissionsMap = perms.permissionsMap || {};
    } catch {
      // Fallback
    }
    return {
      ...result,
      user: {
        ...result.user,
        id: result.user.userId,
        effectiveModules,
        permissionsMap,
      },
    };
  }

  @ApiOperation({ summary: 'Revoke refresh token and end user session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const rawToken = dto?.refreshToken || this.extractRefreshCookie(req);
    if (rawToken) {
      await this.authService.revokeRefreshToken(rawToken);
    }
    this.clearRefreshCookie(res, req);
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
  getDevToken(@Body() dto: DevTokenDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev token endpoint is strictly disabled in production');
    }
    const targetRole = dto?.role ?? UserRole.ADMIN;
    return this.authService.createDevTestToken(targetRole, dto?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: { user: any }) {
    const userId = req.user?.sub || req.user?.userId;
    let effectiveModules: string[] = [];
    let permissionsMap: Record<string, string> = {};
    let liveRole = req.user?.role;
    try {
      const perms = await this.permissionsService.getUserPermissions(userId);
      effectiveModules = perms.effectiveModules;
      permissionsMap = perms.permissionsMap || {};
      if (perms?.roleName) {
        liveRole = perms.roleName;
      }
    } catch {
      // Fallback
    }

    return {
      status: 'authenticated',
      user: {
        ...req.user,
        id: userId,
        role: liveRole,
        roles: [liveRole],
        effectiveModules,
        permissionsMap,
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
    @Body() dto: UpdateProfileDto,
    @Req() req: { user: any },
  ) {
    const currentUserId = req?.user?.userId || req?.user?.sub || req?.user?.id;
    return this.authService.updateProfile(currentUserId, dto);
  }
}

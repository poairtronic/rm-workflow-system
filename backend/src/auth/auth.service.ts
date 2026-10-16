import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { User } from '../users/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { PasswordResetToken } from './entities/password-reset-token.entity.js';
import { UserRole } from './enums/role.enum.js';
import { LoginDto } from './dto/login.dto.js';
import { EmailQueueService } from '../email/email-queue.service.js';

export interface TokenUser {
  userId: string;
  name?: string;
  email: string;
  role: UserRole | string;
  roles?: (UserRole | string)[];
  department?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @Inject(forwardRef(() => EmailQueueService))
    private readonly emailQueueService: EmailQueueService,
    private readonly configService: ConfigService,
  ) {}

  async validateUserCredentials(email: string, pass: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'User account is inactive. Contact Administrator.',
      );
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(loginDto: LoginDto, deviceInfo?: string): Promise<{ accessToken: string; refreshToken: string; user: TokenUser }> {
    const user = await this.validateUserCredentials(
      loginDto.email,
      loginDto.password,
    );

    const roleName = (user.role?.name || UserRole.DESIGNER) as UserRole;

    const tokenUser: TokenUser = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: roleName,
      roles: [roleName],
      department: user.department,
    };

    return this.generateTokens(tokenUser, deviceInfo);
  }

  async generateTokens(
    user: TokenUser,
    deviceInfo?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: TokenUser }> {
    const { accessToken } = this.signToken(user);
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const tokenRecord = this.refreshTokenRepository.create({
      userId: user.userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
      deviceInfo: deviceInfo || null,
    });
    await this.refreshTokenRepository.save(tokenRecord);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user,
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    deviceInfo?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: TokenUser }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken.trim()).digest('hex');
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: { role: true } },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse Detection: If someone attempts to use an already revoked token,
    // revoke all active tokens for this user as a safeguard
    if (tokenRecord.isRevoked) {
      await this.refreshTokenRepository.update(
        { userId: tokenRecord.userId },
        { isRevoked: true },
      );
      throw new UnauthorizedException('Revoked refresh token reused. All sessions terminated.');
    }

    if (new Date() > tokenRecord.expiresAt) {
      tokenRecord.isRevoked = true;
      await this.refreshTokenRepository.save(tokenRecord);
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!tokenRecord.user || !tokenRecord.user.isActive) {
      throw new UnauthorizedException('User account is inactive or deleted');
    }

    // Revoke old token and rotate
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

    tokenRecord.isRevoked = true;
    tokenRecord.replacedByToken = newTokenHash;
    await this.refreshTokenRepository.save(tokenRecord);

    const roleName = (tokenRecord.user.role?.name || UserRole.DESIGNER) as UserRole;
    const tokenUser: TokenUser = {
      userId: tokenRecord.user.id,
      name: tokenRecord.user.name,
      email: tokenRecord.user.email,
      role: roleName,
      roles: [roleName],
      department: tokenRecord.user.department,
    };

    const newRecord = this.refreshTokenRepository.create({
      userId: tokenUser.userId,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isRevoked: false,
      deviceInfo: deviceInfo || tokenRecord.deviceInfo,
    });
    await this.refreshTokenRepository.save(newRecord);

    const { accessToken } = this.signToken(tokenUser);
    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: tokenUser,
    };
  }

  async revokeRefreshToken(rawRefreshToken: string): Promise<boolean> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      return false;
    }
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken.trim()).digest('hex');
    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (tokenRecord) {
      tokenRecord.isRevoked = true;
      await this.refreshTokenRepository.save(tokenRecord);
      return true;
    }
    return false;
  }

  signToken(user: TokenUser): { accessToken: string; user: TokenUser } {
    const payload = {
      sub: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: user.roles ?? [user.role],
      department: user.department,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }

  verifyToken(token: string) {
    return this.jwtService.verify(token);
  }

  /**
   * Isolated developer/test helper to generate signed JWTs for unit tests
   */
  createDevTestToken(role: UserRole = UserRole.ADMIN, customUserId?: string) {
    const mockUuids: Record<string, string> = {
      ADMIN: '00000000-0000-0000-0000-000000000001',
      DESIGNER: '00000000-0000-0000-0000-000000000002',
      STORES: '00000000-0000-0000-0000-000000000003',
      PRODUCTION: '00000000-0000-0000-0000-000000000004',
      SENIOR_MANAGER: '00000000-0000-0000-0000-000000000005',
      GENERAL_MANAGER: '00000000-0000-0000-0000-000000000006',
    };

    return this.signToken({
      userId: customUserId || mockUuids[role] || '00000000-0000-0000-0000-000000000000',
      name: `Dev ${role} User`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      roles: [role],
    });
  }

  async changePassword(
    userId: string,
    currentPass: string,
    newPass: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPass, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    if (currentPass === newPass) {
      throw new BadRequestException(
        'New password cannot be the same as the current password',
      );
    }

    user.passwordHash = await bcrypt.hash(newPass, 10);
    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async updateProfile(
    userId: string,
    data: { name?: string; department?: string },
  ): Promise<{ success: boolean; user: Partial<User>; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.name && data.name.trim()) {
      user.name = data.name.trim();
    }
    if (data.department !== undefined) {
      user.department = data.department.trim();
    }

    const saved = await this.userRepository.save(user);
    const { passwordHash: _, ...userWithoutPass } = saved;

    return {
      success: true,
      user: userWithoutPass,
      message: 'Profile updated successfully',
    };
  }

  /**
   * Generates a secure, single-use password reset token and enqueues
   * an email with the reset link. Returns a generic message to prevent user enumeration.
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const genericSuccessMessage =
      'If an account exists with this email address, a password reset link has been dispatched to it.';

    if (!normalizedEmail) {
      return { success: true, message: genericSuccessMessage };
    }

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    // Anti-enumeration: return success even if user does not exist or is inactive
    if (!user || !user.isActive) {
      return { success: true, message: genericSuccessMessage };
    }

    // Invalidate any existing unused reset tokens for this user
    await this.passwordResetTokenRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    // Generate cryptographically secure 32-byte hex token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token expires in 60 minutes
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const resetTokenEntity = this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      isUsed: false,
    });
    await this.passwordResetTokenRepository.save(resetTokenEntity);

    // Determine frontend base URL
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:5173';
    const cleanFrontendUrl = frontendUrl.replace(/\/+$/, '');
    const resetUrl = `${cleanFrontendUrl}/reset-password?token=${rawToken}`;

    try {
      await this.emailQueueService.enqueueJob({
        recipientEmail: user.email,
        recipientName: user.name || 'Team Member',
        recipientUserId: user.id,
        eventType: 'PASSWORD_RESET',
        templateKey: 'PASSWORD_RESET',
        subject: '[V-SMART] Password Reset Request',
        payload: {
          resetUrl,
          recipientName: user.name || 'Team Member',
          expiresInMinutes: 60,
        },
      });
    } catch (err: any) {
      console.error('Failed to enqueue password reset email:', err?.message || err);
    }

    return {
      success: true,
      message: genericSuccessMessage,
    };
  }

  /**
   * Validates whether a password reset token is active, unused, and not expired.
   */
  async verifyResetToken(
    rawToken: string,
  ): Promise<{ valid: boolean; email?: string; message?: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, message: 'Invalid or missing reset token.' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const record = await this.passwordResetTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record) {
      return { valid: false, message: 'This password reset link is invalid or has expired.' };
    }

    if (record.isUsed) {
      return {
        valid: false,
        message: 'This password reset link has already been used. Please request a new one.',
      };
    }

    if (new Date() > record.expiresAt) {
      return {
        valid: false,
        message: 'This password reset link has expired. Please request a new one.',
      };
    }

    if (!record.user || !record.user.isActive) {
      return {
        valid: false,
        message: 'The associated user account is inactive or disabled.',
      };
    }

    // Mask the email for user confirmation, e.g., d***r@airtronic.com
    const emailParts = record.user.email.split('@');
    let maskedEmail = record.user.email;
    if (emailParts.length === 2 && emailParts[0].length > 2) {
      const u = emailParts[0];
      maskedEmail = `${u[0]}***${u[u.length - 1]}@${emailParts[1]}`;
    }

    return {
      valid: true,
      email: maskedEmail,
    };
  }

  /**
   * Resets the user's password using a valid token, hashes it with bcrypt,
   * invalidates the reset token, and revokes all active refresh tokens.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new BadRequestException('Reset token is required.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const record = await this.passwordResetTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record) {
      throw new BadRequestException('This password reset link is invalid or does not exist.');
    }

    if (record.isUsed) {
      throw new BadRequestException(
        'This password reset link has already been used. Please request a new one.',
      );
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException(
        'This password reset link has expired. Please request a new one.',
      );
    }

    const user = record.user;
    if (!user || !user.isActive) {
      throw new BadRequestException('The associated user account is inactive or disabled.');
    }

    // Hash new password using bcrypt 10 rounds
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    // Mark current token as used
    record.isUsed = true;
    await this.passwordResetTokenRepository.save(record);

    // Invalidate any other pending reset tokens for this user
    await this.passwordResetTokenRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    // Revoke all existing refresh tokens for security
    await this.refreshTokenRepository.update(
      { userId: user.id, isRevoked: false },
      { isRevoked: true },
    );

    return {
      success: true,
      message: 'Your password has been reset successfully. You can now log in with your new password.',
    };
  }
}

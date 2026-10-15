import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { User } from '../users/entities/user.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { UserRole } from './enums/role.enum.js';
import { LoginDto } from './dto/login.dto.js';

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
}

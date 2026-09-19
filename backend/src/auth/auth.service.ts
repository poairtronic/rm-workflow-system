import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity.js';
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

  async login(loginDto: LoginDto) {
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

    return this.signToken(tokenUser);
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
  createDevTestToken(role: UserRole = UserRole.ADMIN) {
    const mockUuids: Record<string, string> = {
      ADMIN: '00000000-0000-0000-0000-000000000001',
      DESIGNER: '00000000-0000-0000-0000-000000000002',
      STORES: '00000000-0000-0000-0000-000000000003',
      PRODUCTION: '00000000-0000-0000-0000-000000000004',
      SENIOR_MANAGER: '00000000-0000-0000-0000-000000000005',
      GENERAL_MANAGER: '00000000-0000-0000-0000-000000000006',
    };

    return this.signToken({
      userId: mockUuids[role] || '00000000-0000-0000-0000-000000000000',
      name: `Dev ${role} User`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      roles: [role],
    });
  }
}

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from './enums/role.enum.js';

export interface TokenUser {
  userId: string;
  email: string;
  role: UserRole;
  roles?: UserRole[];
  department?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  signToken(user: TokenUser): { accessToken: string; user: TokenUser } {
    const payload = {
      sub: user.userId,
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
   * Helper to generate a signed JWT for testing specific role access
   */
  createDevTestToken(role: UserRole = UserRole.ADMIN) {
    return this.signToken({
      userId: `dev-${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      roles: [role],
    });
  }
}

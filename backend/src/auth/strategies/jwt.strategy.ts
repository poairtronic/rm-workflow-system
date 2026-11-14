import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '../../users/entities/user.entity.js';

export interface JwtPayload {
  sub: string;
  name?: string;
  email: string;
  role: string;
  roles?: string[];
  department?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) throw new Error('JWT_SECRET environment variable is not configured');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (this.userRepository && payload?.sub) {
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: { role: true },
      });

      if (user) {
        if (!user.isActive) {
          throw new UnauthorizedException(
            'User account is inactive. Please contact Administrator.',
          );
        }

        const liveRole = user.role?.name || payload.role;
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: liveRole,
          roles: [liveRole],
          department: user.department,
        };
      }
    }

    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      roles: payload.roles ?? [payload.role],
      department: payload.department,
    };
  }
}

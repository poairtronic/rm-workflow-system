import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      const isExpired =
        info?.name === 'TokenExpiredError' ||
        info?.message?.toLowerCase?.().includes('jwt expired');
      throw (
        err ||
        new UnauthorizedException({
          statusCode: 401,
          code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
          message: isExpired ? 'Access token expired' : 'Invalid or missing access token',
        })
      );
    }
    return user;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly configService?: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers || {};
    const providedSecret =
      headers['x-internal-secret'] ||
      headers['X-Internal-Secret'] ||
      headers['X-INTERNAL-SECRET'];

    const expectedSecret =
      this.configService?.get<string>('RM_INTERNAL_SECRET') ||
      process.env.RM_INTERNAL_SECRET ||
      this.configService?.get<string>('MERC_INTERNAL_SECRET') ||
      process.env.MERC_INTERNAL_SECRET ||
      this.configService?.get<string>('ECR_INTERNAL_SECRET') ||
      process.env.ECR_INTERNAL_SECRET;

    if (!expectedSecret) {
      throw new UnauthorizedException('RM_INTERNAL_SECRET is not configured on server');
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing internal secret');
    }

    return true;
  }
}

export default InternalSecretGuard;


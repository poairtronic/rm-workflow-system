import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MasterDataCacheService } from './master-data-cache.service.js';
import { INVALIDATE_CACHE_METADATA } from './cache.decorators.js';

@Injectable()
export class CacheInvalidateInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: MasterDataCacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const namespaces = this.reflector.getAllAndOverride<string[]>(
      INVALIDATE_CACHE_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!namespaces || namespaces.length === 0) {
      return next.handle();
    }

    // Invalidation runs only upon successful completion (never on 4xx/5xx exceptions)
    return next.handle().pipe(
      tap(() => {
        // Asynchronously flush targeted namespaces in O(1)
        this.cacheService.invalidateNamespace(namespaces);
      }),
    );
  }
}

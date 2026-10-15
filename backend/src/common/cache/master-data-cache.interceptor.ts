import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MasterDataCacheService } from './master-data-cache.service.js';
import {
  CACHE_NAMESPACE_METADATA,
  CACHE_TTL_METADATA,
  NO_CACHE_METADATA,
} from './cache.decorators.js';

@Injectable()
export class MasterDataCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly cacheService: MasterDataCacheService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    // Cache is strictly applied to GET queries
    if (!req || req.method !== 'GET') {
      return next.handle();
    }

    // Check if handler explicitly requested NoCache bypass
    const noCache = this.reflector.getAllAndOverride<boolean>(NO_CACHE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (noCache) {
      if (res && typeof res.setHeader === 'function' && !res.headersSent) {
        res.setHeader('X-Cache', 'BYPASS');
      }
      return next.handle();
    }

    const namespace =
      this.reflector.getAllAndOverride<string>(CACHE_NAMESPACE_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) || 'master-default';

    const ttlMs =
      this.reflector.getAllAndOverride<number>(CACHE_TTL_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) || 300000;

    const requestUrl = req.originalUrl || req.url || '';
    const cacheKey = `rmrit:${namespace}:${requestUrl}`;

    // Attempt cache hit
    const cachedData = await this.cacheService.get(cacheKey);

    if (cachedData !== null) {
      if (res && typeof res.setHeader === 'function' && !res.headersSent) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Namespace', namespace);
      }
      return of(cachedData);
    }

    // Cache Miss - execute handler, set MISS header, and cache result
    if (res && typeof res.setHeader === 'function' && !res.headersSent) {
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Namespace', namespace);
    }

    return next.handle().pipe(
      tap((data) => {
        if (data !== undefined && data !== null) {
          this.cacheService.set(namespace, cacheKey, data, ttlMs);
        }
      }),
    );
  }
}

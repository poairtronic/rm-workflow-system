import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { MasterDataCacheService } from '../src/common/cache/master-data-cache.service.js';
import { MasterDataCacheInterceptor } from '../src/common/cache/master-data-cache.interceptor.js';
import { CacheInvalidateInterceptor } from '../src/common/cache/cache-invalidate.interceptor.js';
import {
  CACHE_NAMESPACE_METADATA,
  CACHE_TTL_METADATA,
  NO_CACHE_METADATA,
  INVALIDATE_CACHE_METADATA,
} from '../src/common/cache/cache.decorators.js';

describe('Stage 4 (Phase 24B): Master Data In-Memory RAM Caching Suite', () => {
  let cacheService: MasterDataCacheService;
  let cacheInterceptor: MasterDataCacheInterceptor;
  let invalidateInterceptor: CacheInvalidateInterceptor;
  let reflector: Reflector;
  let mockCacheStore: Map<string, any>;

  beforeEach(() => {
    mockCacheStore = new Map<string, any>();

    const mockCacheManager: any = {
      get: vi.fn(async (key: string) => mockCacheStore.get(key) ?? null),
      set: vi.fn(async (key: string, val: any, _ttl: number) => {
        mockCacheStore.set(key, val);
      }),
      del: vi.fn(async (key: string) => {
        mockCacheStore.delete(key);
      }),
      clear: vi.fn(async () => {
        mockCacheStore.clear();
      }),
    };

    cacheService = new MasterDataCacheService(mockCacheManager);
    reflector = new Reflector();
    cacheInterceptor = new MasterDataCacheInterceptor(cacheService, reflector);
    invalidateInterceptor = new CacheInvalidateInterceptor(cacheService, reflector);
  });

  function createMockContext(
    method: string,
    url: string,
    headers: Record<string, string> = {},
  ): { context: ExecutionContext; setHeaderSpy: any; headersSent: boolean } {
    const responseHeaders: Record<string, string> = {};
    const setHeaderSpy = vi.fn((name: string, value: string) => {
      responseHeaders[name.toLowerCase()] = value;
    });

    const mockReq = { method, url, originalUrl: url, headers };
    const mockRes = {
      setHeader: setHeaderSpy,
      headersSent: false,
      getHeader: (name: string) => responseHeaders[name.toLowerCase()],
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    return { context, setHeaderSpy, headersSent: false };
  }

  describe('1. MasterDataCacheService In-Memory Registry', () => {
    it('should store and retrieve data with namespace registration', async () => {
      await cacheService.set('products', 'rmrit:products:/api/products', [{ id: 'p1', name: 'Product 1' }]);
      const retrieved = await cacheService.get('rmrit:products:/api/products');
      expect(retrieved).toEqual([{ id: 'p1', name: 'Product 1' }]);
      expect(cacheService.getActiveKeyCount()).toBe(1);
    });

    it('should flush all keys for a single namespace in O(1)', async () => {
      await cacheService.set('categories', 'rmrit:categories:/api/categories', [{ id: 'c1' }]);
      await cacheService.set('categories', 'rmrit:categories:/api/categories/c1', { id: 'c1' });
      await cacheService.set('products', 'rmrit:products:/api/products', [{ id: 'p1' }]);

      expect(cacheService.getActiveKeyCount()).toBe(3);

      const flushed = await cacheService.invalidateNamespace('categories');
      expect(flushed).toBe(2);
      expect(await cacheService.get('rmrit:categories:/api/categories')).toBeNull();
      expect(await cacheService.get('rmrit:categories:/api/categories/c1')).toBeNull();
      // Products namespace must remain intact
      expect(await cacheService.get('rmrit:products:/api/products')).toEqual([{ id: 'p1' }]);
      expect(cacheService.getActiveKeyCount()).toBe(1);
    });

    it('should support multi-namespace invalidation (e.g., categories + products)', async () => {
      await cacheService.set('categories', 'rmrit:categories:/api/categories', [{ id: 'c1' }]);
      await cacheService.set('products', 'rmrit:products:/api/products', [{ id: 'p1' }]);
      await cacheService.set('bins', 'rmrit:bins:/api/bins', [{ id: 'b1' }]);

      const flushed = await cacheService.invalidateNamespace(['categories', 'products']);
      expect(flushed).toBe(2);
      expect(await cacheService.get('rmrit:categories:/api/categories')).toBeNull();
      expect(await cacheService.get('rmrit:products:/api/products')).toBeNull();
      // Bins namespace must remain untouched
      expect(await cacheService.get('rmrit:bins:/api/bins')).toEqual([{ id: 'b1' }]);
    });
  });

  describe('2. MasterDataCacheInterceptor (GET Caching & Headers)', () => {
    it('should return X-Cache: MISS on the first read and cache data', async () => {
      const { context, setHeaderSpy } = createMockContext('GET', '/api/products');
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === CACHE_NAMESPACE_METADATA) return 'products';
        if (key === CACHE_TTL_METADATA) return 300000;
        if (key === NO_CACHE_METADATA) return false;
        return null;
      });

      const next: CallHandler = {
        handle: () => of([{ id: 'prod-100', name: 'Cotton Yarn 40s' }]),
      };

      const obs = await cacheInterceptor.intercept(context, next);
      let resultData: any;
      obs.subscribe((data) => {
        resultData = data;
      });

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Cache-Namespace', 'products');
      expect(resultData).toEqual([{ id: 'prod-100', name: 'Cotton Yarn 40s' }]);

      // Verify cached in memory
      const cached = await cacheService.get('rmrit:products:/api/products');
      expect(cached).toEqual([{ id: 'prod-100', name: 'Cotton Yarn 40s' }]);
    });

    it('should return X-Cache: HIT on the second read without executing handler', async () => {
      // Pre-seed cache
      await cacheService.set('products', 'rmrit:products:/api/products', [{ id: 'prod-100', name: 'Cotton Yarn 40s' }]);

      const { context, setHeaderSpy } = createMockContext('GET', '/api/products');
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === CACHE_NAMESPACE_METADATA) return 'products';
        if (key === NO_CACHE_METADATA) return false;
        return null;
      });

      const handlerSpy = vi.fn(() => of([]));
      const next: CallHandler = { handle: handlerSpy };

      const obs = await cacheInterceptor.intercept(context, next);
      let resultData: any;
      obs.subscribe((data) => {
        resultData = data;
      });

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(setHeaderSpy).toHaveBeenCalledWith('X-Cache-Namespace', 'products');
      expect(handlerSpy).not.toHaveBeenCalled();
      expect(resultData).toEqual([{ id: 'prod-100', name: 'Cotton Yarn 40s' }]);
    });

    it('should bypass caching when @NoCache() is specified (e.g. next-code generator)', async () => {
      const { context, setHeaderSpy } = createMockContext('GET', '/api/products/next-code');
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === NO_CACHE_METADATA) return true;
        return null;
      });

      const next: CallHandler = {
        handle: () => of({ nextCode: 'PRD-0042' }),
      };

      const obs = await cacheInterceptor.intercept(context, next);
      let resultData: any;
      obs.subscribe((data) => {
        resultData = data;
      });

      expect(setHeaderSpy).toHaveBeenCalledWith('X-Cache', 'BYPASS');
      expect(resultData).toEqual({ nextCode: 'PRD-0042' });
      expect(await cacheService.get('rmrit:products:/api/products/next-code')).toBeNull();
    });

    it('should ignore non-GET methods (POST/PATCH/DELETE pass through)', async () => {
      const { context, setHeaderSpy } = createMockContext('POST', '/api/products');
      const next: CallHandler = { handle: () => of({ success: true }) };

      const obs = await cacheInterceptor.intercept(context, next);
      let resultData: any;
      obs.subscribe((data) => {
        resultData = data;
      });

      expect(setHeaderSpy).not.toHaveBeenCalled();
      expect(resultData).toEqual({ success: true });
    });
  });

  describe('3. CacheInvalidateInterceptor (Post-Mutation Flushes)', () => {
    it('should flush targeted namespace when mutation succeeds', async () => {
      // Seed categories and vendors
      await cacheService.set('categories', 'rmrit:categories:/api/categories', [{ id: 'c1' }]);
      await cacheService.set('vendors', 'rmrit:vendors:/api/vendors', [{ id: 'v1' }]);

      const { context } = createMockContext('POST', '/api/categories');
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['categories', 'products']);

      const next: CallHandler = {
        handle: () => of({ id: 'c2', name: 'New Category' }),
      };

      const obs = invalidateInterceptor.intercept(context, next);
      obs.subscribe();

      // Categories cache should be flushed
      expect(await cacheService.get('rmrit:categories:/api/categories')).toBeNull();
      // Vendors cache must remain safe
      expect(await cacheService.get('rmrit:vendors:/api/vendors')).toEqual([{ id: 'v1' }]);
    });

    it('should NOT flush cache if mutation throws an error (4xx/5xx failure safety)', async () => {
      await cacheService.set('products', 'rmrit:products:/api/products', [{ id: 'p1' }]);

      const { context } = createMockContext('POST', '/api/products');
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['products']);

      const next: CallHandler = {
        handle: () => throwError(() => new Error('Validation failed')),
      };

      const obs = invalidateInterceptor.intercept(context, next);
      obs.subscribe({
        next: () => {},
        error: () => {
          // Expected validation error caught
        },
      });

      // Products cache must still be intact because mutation failed!
      expect(await cacheService.get('rmrit:products:/api/products')).toEqual([{ id: 'p1' }]);
    });
  });
});

import { SetMetadata, applyDecorators, UseInterceptors } from '@nestjs/common';
import { MasterDataCacheInterceptor } from './master-data-cache.interceptor.js';
import { CacheInvalidateInterceptor } from './cache-invalidate.interceptor.js';

export const CACHE_NAMESPACE_METADATA = 'cacheNamespace';
export const CACHE_TTL_METADATA = 'cacheTtl';
export const NO_CACHE_METADATA = 'noCache';
export const INVALIDATE_CACHE_METADATA = 'invalidateCache';

/**
 * Marks a controller or handler to be cached under a designated master data namespace.
 * Automatically attaches MasterDataCacheInterceptor.
 *
 * @param namespace e.g. 'products', 'categories', 'bins', 'vendors'
 * @param ttlMs Optional TTL in milliseconds (defaults to 300,000ms / 5 min)
 */
export function CacheNamespace(namespace: string, ttlMs: number = 300000) {
  return applyDecorators(
    SetMetadata(CACHE_NAMESPACE_METADATA, namespace),
    SetMetadata(CACHE_TTL_METADATA, ttlMs),
    UseInterceptors(MasterDataCacheInterceptor),
  );
}

/**
 * Bypasses caching on specific dynamic endpoints (e.g. next-code generator).
 */
export function NoCache() {
  return SetMetadata(NO_CACHE_METADATA, true);
}

/**
 * Marks a mutation route (POST, PATCH, DELETE) to automatically invalidate
 * all cached keys under one or more namespaces upon successful HTTP 2xx completion.
 * Automatically attaches CacheInvalidateInterceptor.
 *
 * @param namespaces One or more namespace strings to flush, e.g. 'products' or ['categories', 'products']
 */
export function InvalidateCache(namespaces: string | string[]) {
  const nsList = Array.isArray(namespaces) ? namespaces : [namespaces];
  return applyDecorators(
    SetMetadata(INVALIDATE_CACHE_METADATA, nsList),
    UseInterceptors(CacheInvalidateInterceptor),
  );
}

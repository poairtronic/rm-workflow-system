import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class MasterDataCacheService {
  private readonly logger = new Logger(MasterDataCacheService.name);
  // Registry: namespace -> Set of active cache keys
  private readonly namespaceKeys = new Map<string, Set<string>>();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Retrieves an item from cache by key.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.cacheManager.get<T>(key);
      return val ?? null;
    } catch (err: any) {
      this.logger.warn(`[MasterDataCache] Error retrieving key "${key}": ${err.message}`);
      return null;
    }
  }

  /**
   * Stores an item in cache and registers its key under the designated namespace.
   */
  async set(namespace: string, key: string, value: any, ttlMs: number = 300000): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
      if (!this.namespaceKeys.has(namespace)) {
        this.namespaceKeys.set(namespace, new Set());
      }
      this.namespaceKeys.get(namespace)!.add(key);
    } catch (err: any) {
      this.logger.warn(`[MasterDataCache] Error setting key "${key}": ${err.message}`);
    }
  }

  /**
   * Deletes a single key from cache.
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      for (const keys of this.namespaceKeys.values()) {
        keys.delete(key);
      }
    } catch (err: any) {
      this.logger.warn(`[MasterDataCache] Error deleting key "${key}": ${err.message}`);
    }
  }

  /**
   * Flushes all cached entries registered under one or more namespaces in O(1) time.
   */
  async invalidateNamespace(namespaces: string | string[]): Promise<number> {
    const nsList = Array.isArray(namespaces) ? namespaces : [namespaces];
    let invalidatedTotal = 0;

    for (const ns of nsList) {
      const keys = this.namespaceKeys.get(ns);
      if (keys && keys.size > 0) {
        const keyList = Array.from(keys);
        for (const key of keyList) {
          try {
            await this.cacheManager.del(key);
            invalidatedTotal++;
          } catch (err: any) {
            this.logger.warn(`[MasterDataCache] Failed to delete key "${key}": ${err.message}`);
          }
        }
        keys.clear();
        this.logger.log(`[MasterDataCache] Invalidation: Flushed ${keyList.length} keys for namespace '${ns}'`);
      }
    }

    return invalidatedTotal;
  }

  /**
   * Clears the entire in-memory cache and namespace registry.
   */
  async clearAll(): Promise<void> {
    try {
      if (typeof (this.cacheManager as any).clear === 'function') {
        await (this.cacheManager as any).clear();
      } else if (typeof (this.cacheManager as any).reset === 'function') {
        await (this.cacheManager as any).reset();
      }
      this.namespaceKeys.clear();
      this.logger.log('[MasterDataCache] Entire in-memory cache cleared');
    } catch (err: any) {
      this.logger.warn(`[MasterDataCache] Error clearing cache: ${err.message}`);
    }
  }

  /**
   * Returns current active registered key count across all namespaces.
   */
  getActiveKeyCount(): number {
    let count = 0;
    for (const keys of this.namespaceKeys.values()) {
      count += keys.size;
    }
    return count;
  }
}

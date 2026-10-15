import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MasterDataCacheService } from './master-data-cache.service.js';
import { MasterDataCacheInterceptor } from './master-data-cache.interceptor.js';
import { CacheInvalidateInterceptor } from './cache-invalidate.interceptor.js';

@Global()
@Module({
  imports: [
    CacheModule.register({
      ttl: 300000, // 5 minutes default in milliseconds (RAM in-memory)
      max: 1000, // Max 1,000 master items (< 5 MB RAM footprint)
    }),
  ],
  providers: [
    MasterDataCacheService,
    MasterDataCacheInterceptor,
    CacheInvalidateInterceptor,
  ],
  exports: [
    CacheModule,
    MasterDataCacheService,
    MasterDataCacheInterceptor,
    CacheInvalidateInterceptor,
  ],
})
export class MasterDataCacheModule {}

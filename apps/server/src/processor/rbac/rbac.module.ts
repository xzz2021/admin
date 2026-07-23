import { Global, Module } from '@nestjs/common';
import { RbacPermissionCacheService } from './rbac-permission-cache.service';

@Global()
@Module({
  providers: [RbacPermissionCacheService],
  exports: [RbacPermissionCacheService],
})
export class RbacModule {}

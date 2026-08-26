import { RbacModule } from '@/processor/rbac'
import { DepartmentModule } from '@/system/department/department.module'
import { Module } from '@nestjs/common'
import { AuthorizationRepository } from './authorization.repository'
import { AuthorizationService } from './authorization.service'
import { AuthorizationSnapshotCacheService } from './authorization-snapshot-cache.service'
import { OrganizationGenerationModule } from './organization-generation.module'
import { ScopeResolverRegistry } from './scope-resolver.registry'

@Module({
  imports: [RbacModule, DepartmentModule, OrganizationGenerationModule],
  providers: [AuthorizationRepository, AuthorizationService, AuthorizationSnapshotCacheService, ScopeResolverRegistry],
  exports: [AuthorizationService, OrganizationGenerationModule],
})
export class AuthorizationModule {}

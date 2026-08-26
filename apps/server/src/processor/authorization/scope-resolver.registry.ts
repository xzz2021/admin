import { DataScope } from '@/prisma/generated/prisma/enums'
import { DepartmentRepository } from '@/system/department/department.repository'
import { Injectable } from '@nestjs/common'
import { AllScopeResolver } from './resolvers/all.scope-resolver'
import { CustomScopeResolver } from './resolvers/custom.scope-resolver'
import { DepartmentTreeScopeResolver } from './resolvers/department-tree.scope-resolver'
import { DepartmentScopeResolver } from './resolvers/department.scope-resolver'
import { SelfScopeResolver } from './resolvers/self.scope-resolver'
import type { ScopeResolutionInput, ScopeResolver } from './scope-resolver.interface'
import type { ResolvedGrant } from './scope.types'

@Injectable()
export class ScopeResolverRegistry {
  private readonly resolvers: ReadonlyMap<DataScope, ScopeResolver>

  constructor(private readonly departments: DepartmentRepository) {
    const entries = [
      new AllScopeResolver(),
      new SelfScopeResolver(),
      new DepartmentScopeResolver(),
      new DepartmentTreeScopeResolver(departments),
      new CustomScopeResolver(),
    ].map(resolver => [resolver.scope, resolver] as const)
    this.resolvers = new Map(entries)
  }

  async resolve(scope: DataScope, input: ScopeResolutionInput): Promise<ResolvedGrant> {
    const resolver = this.resolvers.get(scope)
    if (!resolver) return { all: false, scopes: [] }
    return resolver.resolve(input)
  }
}

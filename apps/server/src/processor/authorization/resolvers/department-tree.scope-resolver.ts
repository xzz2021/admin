import { DataScope } from '@/prisma/generated/prisma/enums'
import type { DepartmentRepository } from '@/system/department/department.repository'
import type { ScopeResolutionInput, ScopeResolver } from '../scope-resolver.interface'
import type { ResolvedGrant } from '../scope.types'

export class DepartmentTreeScopeResolver implements ScopeResolver {
  readonly scope = DataScope.DEPT_TREE

  constructor(private readonly departments: Pick<DepartmentRepository, 'findSubtreeDepartmentIds'>) {}

  async resolve(input: ScopeResolutionInput): Promise<ResolvedGrant> {
    if (!input.departmentId) return { all: false, scopes: [] }
    let pending = input.memo?.departmentSubtrees.get(input.departmentId)
    if (!pending) {
      pending = this.departments.findSubtreeDepartmentIds(input.departmentId)
      input.memo?.departmentSubtrees.set(input.departmentId, pending)
    }
    const ids = [...new Set(await pending)].sort()
    return ids.length ? { all: false, scopes: [{ type: 'DEPARTMENT', ids }] } : { all: false, scopes: [] }
  }
}

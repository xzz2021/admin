import { DataScope } from '@/prisma/generated/prisma/enums'
import type { ScopeResolutionInput, ScopeResolver } from '../scope-resolver.interface'
import type { ResolvedGrant } from '../scope.types'

export class DepartmentScopeResolver implements ScopeResolver {
  readonly scope = DataScope.DEPT

  resolve(input: ScopeResolutionInput): ResolvedGrant {
    return input.departmentId
      ? { all: false, scopes: [{ type: 'DEPARTMENT', ids: [input.departmentId] }] }
      : { all: false, scopes: [] }
  }
}

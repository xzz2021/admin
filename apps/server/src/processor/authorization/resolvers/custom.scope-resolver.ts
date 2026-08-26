import { DataScope } from '@/prisma/generated/prisma/enums'
import type { ScopeResolutionInput, ScopeResolver } from '../scope-resolver.interface'
import type { ResolvedGrant } from '../scope.types'

export class CustomScopeResolver implements ScopeResolver {
  readonly scope = DataScope.CUSTOM

  resolve(input: ScopeResolutionInput): ResolvedGrant {
    const ids = [
      ...new Set(input.customDepartments.filter(department => department.enabled).map(department => department.id)),
    ].sort()
    return ids.length ? { all: false, scopes: [{ type: 'DEPARTMENT', ids }] } : { all: false, scopes: [] }
  }
}

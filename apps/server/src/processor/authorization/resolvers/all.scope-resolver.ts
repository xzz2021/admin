import { DataScope } from '@/prisma/generated/prisma/enums'
import type { ScopeResolutionInput, ScopeResolver } from '../scope-resolver.interface'
import type { ResolvedGrant } from '../scope.types'

export class AllScopeResolver implements ScopeResolver {
  readonly scope = DataScope.ALL

  resolve(_input: ScopeResolutionInput): ResolvedGrant {
    return { all: true, scopes: [] }
  }
}

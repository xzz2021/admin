import { DataScope } from '@/prisma/generated/prisma/enums'
import type { ScopeResolutionInput, ScopeResolver } from '../scope-resolver.interface'
import type { ResolvedGrant } from '../scope.types'

export class SelfScopeResolver implements ScopeResolver {
  readonly scope = DataScope.SELF

  resolve(_input: ScopeResolutionInput): ResolvedGrant {
    return { all: false, scopes: [{ type: 'SELF' }] }
  }
}

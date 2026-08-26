import { scopeGrantStrategies } from './scope-grant-strategy.registry'
import type { ResolvedGrant } from './scope.types'

export function mergeGrants(grants: readonly ResolvedGrant[]): ResolvedGrant {
  if (grants.some(grant => grant.all)) return { all: true, scopes: [] }

  return { all: false, scopes: scopeGrantStrategies.normalize(grants.flatMap(grant => grant.scopes)) }
}

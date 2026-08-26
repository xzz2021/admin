import { scopeGrantStrategies } from './scope-grant-strategy.registry'
import type { AuthorizationDecision, AuthorizationDecisions } from './scope.types'

function immutableSet(values: readonly string[]): ReadonlySet<string> {
  const result = new Set(values)
  result.add = () => {
    throw new TypeError('AuthorizationContext is immutable')
  }
  result.delete = () => {
    throw new TypeError('AuthorizationContext is immutable')
  }
  result.clear = () => {
    throw new TypeError('AuthorizationContext is immutable')
  }
  return Object.freeze(result)
}

function freezeDecision(decision: AuthorizationDecision): AuthorizationDecision {
  if (!decision.scoped) return Object.freeze({ scoped: false })
  const scopes = decision.grant.scopes.map(scope => scopeGrantStrategies.freeze(scope))
  return Object.freeze({
    scoped: true,
    grant: Object.freeze({ all: decision.grant.all, scopes: Object.freeze(scopes) }),
  }) as AuthorizationDecision
}

export class AuthorizationContext {
  readonly permissionCodes: ReadonlySet<string>
  private readonly decisions: AuthorizationDecisions

  constructor(
    readonly userId: string,
    permissionCodes: readonly string[],
    decisions: Readonly<Record<string, AuthorizationDecision>>,
  ) {
    this.permissionCodes = immutableSet(permissionCodes)
    this.decisions = Object.freeze(
      Object.fromEntries(Object.entries(decisions).map(([code, decision]) => [code, freezeDecision(decision)])),
    )
    Object.freeze(this)
  }

  hasPermission(code: string): boolean {
    return this.permissionCodes.has('*') || this.permissionCodes.has(code)
  }

  decisionFor(code: string): AuthorizationDecision | undefined {
    return this.decisions[code]
  }
}

export type ScopeGrant = { type: 'SELF' } | { type: 'DEPARTMENT'; ids: string[] }

export interface ResolvedGrant {
  all: boolean
  scopes: ScopeGrant[]
}

export type AuthorizationDecision = { scoped: false } | { scoped: true; grant: ResolvedGrant }

export type AuthorizationDecisions = Readonly<Record<string, AuthorizationDecision>>

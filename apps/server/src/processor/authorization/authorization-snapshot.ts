import type { AuthorizationDecision } from './scope.types'

export interface AuthorizationSnapshot {
  permissionCodes: string[]
  decisions: Record<string, AuthorizationDecision>
}

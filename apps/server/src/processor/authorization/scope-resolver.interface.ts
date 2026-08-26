import type { DataScope } from '@/prisma/generated/prisma/enums'
import type { ResolvedGrant } from './scope.types'

export interface CustomDepartmentInput {
  id: string
  enabled: boolean
}

export interface ScopeResolutionMemo {
  departmentSubtrees: Map<string, Promise<string[]>>
}

export interface ScopeResolutionInput {
  userId: string
  departmentId: string | null
  customDepartments: readonly CustomDepartmentInput[]
  memo?: ScopeResolutionMemo
}

export interface ScopeResolver {
  readonly scope: DataScope
  resolve(input: ScopeResolutionInput): ResolvedGrant | Promise<ResolvedGrant>
}

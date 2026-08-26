import { Prisma } from '@/prisma/generated/prisma/client'
import { CustomerStatus, type CustomerStatus as CustomerStatusValue } from '@/prisma/generated/prisma/enums'
import { AuthorizationContext } from '@/processor/authorization/authorization-context'
import type { ScopeGrant } from '@/processor/authorization/scope.types'
import { createMongoAbility, subject, type ForcedSubject, type MongoAbility, type RawRuleOf } from '@casl/ability'

export const CUSTOMER_HIGH_VALUE_THRESHOLD = 100000

export type CustomerCapability = 'update' | 'delete' | 'assign'
type CustomerAbilityAction = CustomerCapability | 'read-sensitive' | 'update-sensitive'

interface CustomerAbilityAttributes {
  id: string
  status: CustomerStatusValue
  highValue: boolean
  frozen: boolean
  won: boolean
}

type CustomerAbilityObject = CustomerAbilityAttributes & ForcedSubject<'Customer'>
type CustomerAbility = MongoAbility<[CustomerAbilityAction, 'Customer' | CustomerAbilityObject]>

export interface CustomerPolicyRecord {
  id: string
  status: CustomerStatusValue
  dealAmount: string | number | { toString(): string }
  confidential: boolean
  ownerId: string
  departmentId: string
  internalCost?: string | number | { toString(): string }
  [key: string]: unknown
}

export type CustomerProjection = Omit<CustomerPolicyRecord, 'dealAmount' | 'internalCost'> & {
  dealAmount: string
  internalCost?: string
  capabilities: CustomerCapability[]
}

const DENY_ALL_WHERE: Prisma.CustomerWhereInput = { id: { in: [] } }

export class CustomerPolicy {
  private readonly ability: CustomerAbility
  private readonly superAdmin: boolean

  constructor(private readonly context: AuthorizationContext) {
    this.superAdmin = context.permissionCodes.has('*')
    this.ability = this.buildAbility()
  }

  whereFor(permissionCode: string): Prisma.CustomerWhereInput {
    if (this.superAdmin) return {}
    const decision = this.context.decisionFor(permissionCode)
    if (!decision?.scoped) return DENY_ALL_WHERE
    if (decision.grant.all) return {}
    if (decision.grant.scopes.length === 0) return DENY_ALL_WHERE
    return { OR: decision.grant.scopes.map(scope => this.scopeWhere(scope)) }
  }

  queryWhere(permissionCode: string, businessWhere: Prisma.CustomerWhereInput): Prisma.CustomerWhereInput {
    return {
      AND: [this.whereFor(permissionCode), this.canReadSensitive() ? {} : { confidential: false }, businessWhere],
    }
  }

  mutationWhere(
    permissionCode: 'customer:update' | 'customer:delete',
    businessWhere: Prisma.CustomerWhereInput = {},
  ): Prisma.CustomerWhereInput {
    const attributeWhere: Prisma.CustomerWhereInput[] = []
    if (!this.superAdmin) {
      attributeWhere.push({ status: { not: CustomerStatus.FROZEN } })
      if (permissionCode === 'customer:update' && !this.context.hasPermission('customer:high-value:update')) {
        attributeWhere.push({ dealAmount: { lt: CUSTOMER_HIGH_VALUE_THRESHOLD } })
      }
      if (permissionCode === 'customer:delete' && !this.context.hasPermission('customer:won:delete')) {
        attributeWhere.push({ status: { not: CustomerStatus.WON } })
      }
    }
    return {
      AND: [
        this.whereFor(permissionCode),
        this.canReadSensitive() ? {} : { confidential: false },
        ...attributeWhere,
        businessWhere,
      ],
    }
  }

  can(action: CustomerAbilityAction, record: CustomerPolicyRecord, field?: string): boolean {
    const permissionCode =
      action === 'delete'
        ? 'customer:delete'
        : action === 'update' || action === 'assign' || action === 'update-sensitive'
          ? 'customer:update'
          : undefined
    if (permissionCode && !this.recordMatchesGrant(permissionCode, record)) return false
    const attributes = this.abilityAttributes(record)
    return field
      ? this.ability.can(action, subject('Customer', attributes), field)
      : this.ability.can(action, subject('Customer', attributes))
  }

  canReadSensitive(): boolean {
    return this.context.hasPermission('customer:sensitive:view')
  }

  canUpdateSensitive(record: CustomerPolicyRecord, field: 'internalCost' | 'confidential'): boolean {
    return this.can('update-sensitive', record, field)
  }

  capabilities(record: CustomerPolicyRecord): CustomerCapability[] {
    const result: CustomerCapability[] = []
    if (this.can('update', record)) result.push('update')
    if (this.can('delete', record)) result.push('delete')
    if (this.can('assign', record)) result.push('assign')
    return result
  }

  project<T extends CustomerPolicyRecord>(record: T, capabilities = this.capabilities(record)): CustomerProjection {
    const { internalCost, dealAmount, ...rest } = record
    return {
      ...rest,
      dealAmount: dealAmount.toString(),
      ...(this.canReadSensitive() && internalCost !== undefined ? { internalCost: internalCost.toString() } : {}),
      capabilities,
    }
  }

  targetMatchesGrant(permissionCode: string, ownerId: string, departmentId: string): boolean {
    if (this.superAdmin) return true
    const decision = this.context.decisionFor(permissionCode)
    if (!decision?.scoped) return false
    if (decision.grant.all) return true
    return decision.grant.scopes.some(scope =>
      scope.type === 'SELF' ? ownerId === this.context.userId : scope.ids.includes(departmentId),
    )
  }

  private recordMatchesGrant(permissionCode: string, record: CustomerPolicyRecord): boolean {
    if (this.superAdmin) return true
    const decision = this.context.decisionFor(permissionCode)
    if (!decision?.scoped) return false
    if (decision.grant.all) return true
    return decision.grant.scopes.some(scope =>
      scope.type === 'SELF' ? record.ownerId === this.context.userId : scope.ids.includes(record.departmentId),
    )
  }

  private buildAbility(): CustomerAbility {
    const rules: RawRuleOf<CustomerAbility>[] = []
    const allow = (
      action: CustomerAbilityAction,
      conditions?: Partial<CustomerAbilityAttributes>,
      fields?: string[],
    ) => {
      rules.push({
        action,
        subject: 'Customer',
        ...(conditions ? { conditions } : {}),
        ...(fields ? { fields } : {}),
      })
    }

    if (this.superAdmin) {
      for (const action of ['update', 'delete', 'assign', 'read-sensitive', 'update-sensitive'] as const) allow(action)
      return createMongoAbility(rules)
    }

    const updateConditions: Partial<CustomerAbilityAttributes> = {
      frozen: false,
      ...(this.context.hasPermission('customer:high-value:update') ? {} : { highValue: false }),
    }
    if (this.context.hasPermission('customer:update')) allow('update', updateConditions)
    if (this.context.hasPermission('customer:delete')) {
      allow('delete', {
        frozen: false,
        ...(this.context.hasPermission('customer:won:delete') ? {} : { won: false }),
      })
    }
    if (this.context.hasPermission('customer:assign') && this.context.hasPermission('customer:update')) {
      allow('assign', updateConditions)
    }
    if (this.context.hasPermission('customer:sensitive:view')) allow('read-sensitive')
    if (this.context.hasPermission('customer:sensitive:update')) {
      allow('update-sensitive', updateConditions, ['internalCost', 'confidential'])
    }
    return createMongoAbility(rules)
  }

  private abilityAttributes(record: CustomerPolicyRecord): CustomerAbilityAttributes {
    return {
      id: record.id,
      status: record.status,
      frozen: record.status === CustomerStatus.FROZEN,
      won: record.status === CustomerStatus.WON,
      highValue: Number(record.dealAmount.toString()) >= CUSTOMER_HIGH_VALUE_THRESHOLD,
    }
  }

  private scopeWhere(scope: ScopeGrant): Prisma.CustomerWhereInput {
    return scope.type === 'SELF' ? { ownerId: this.context.userId } : { departmentId: { in: scope.ids } }
  }
}

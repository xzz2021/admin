import { DataScope } from '@/prisma/generated/prisma/enums'
import type { AuthorizationRepository, AuthorizationSource } from './authorization.repository'
import { AuthorizationService } from './authorization.service'
import type { AuthorizationSnapshotCacheService } from './authorization-snapshot-cache.service'
import { ScopeResolverRegistry } from './scope-resolver.registry'

describe('AuthorizationService', () => {
  const loadUserAuthorization = jest.fn()
  const resolve = jest.fn()
  const getOrLoad = jest.fn((_userId: string, loader: () => Promise<unknown>) => loader())
  const service = new AuthorizationService(
    { loadUserAuthorization } as unknown as AuthorizationRepository,
    { resolve } as unknown as ScopeResolverRegistry,
    { getOrLoad } as unknown as AuthorizationSnapshotCacheService,
  )

  const source = (
    roles: AuthorizationSource['roles'],
    departmentId: string | null = 'dept-1',
    permissionCatalog: AuthorizationSource['permissionCatalog'] = [],
  ): AuthorizationSource => ({
    userId: 'user-1',
    departmentId,
    roles,
    permissionCatalog,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    getOrLoad.mockImplementation((_userId: string, loader: () => Promise<unknown>) => loader())
    resolve.mockImplementation((scope: DataScope) => {
      if (scope === DataScope.ALL) return { all: true, scopes: [] }
      if (scope === DataScope.SELF) return { all: false, scopes: [{ type: 'SELF' }] }
      return { all: false, scopes: [{ type: 'DEPARTMENT', ids: ['dept-1'] }] }
    })
  })

  it('returns an empty immutable context when the user does not exist', async () => {
    loadUserAuthorization.mockResolvedValue(null)

    const context = await service.createContext('missing', ['customer:list'])

    expect(context.hasPermission('customer:list')).toBe(false)
    expect(context.decisionFor('customer:list')).toBeUndefined()
  })

  it('returns unscoped decisions when scopeEnabled is false', async () => {
    loadUserAuthorization.mockResolvedValue(
      source([
        {
          code: 'staff',
          permissions: [
            {
              code: 'customer:list',
              scopeEnabled: false,
              dataScope: null,
              customDepartments: [],
            },
          ],
        },
      ]),
    )

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.hasPermission('customer:list')).toBe(true)
    expect(context.decisionFor('customer:list')).toEqual({ scoped: false })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('treats a newly scope-enabled permission with null dataScope as scoped deny all', async () => {
    loadUserAuthorization.mockResolvedValue(
      source([
        {
          code: 'staff',
          permissions: [
            {
              code: 'customer:list',
              scopeEnabled: true,
              dataScope: null,
              customDepartments: [],
            },
          ],
        },
      ]),
    )

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.hasPermission('customer:list')).toBe(true)
    expect(context.decisionFor('customer:list')).toEqual({
      scoped: true,
      grant: { all: false, scopes: [] },
    })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('unions multiple role grants and preserves SELF', async () => {
    loadUserAuthorization.mockResolvedValue(
      source([
        {
          code: 'sales',
          permissions: [
            { code: 'customer:list', scopeEnabled: true, dataScope: DataScope.SELF, customDepartments: [] },
          ],
        },
        {
          code: 'manager',
          permissions: [
            { code: 'customer:list', scopeEnabled: true, dataScope: DataScope.DEPT, customDepartments: [] },
          ],
        },
      ]),
    )

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.decisionFor('customer:list')).toEqual({
      scoped: true,
      grant: {
        all: false,
        scopes: [{ type: 'SELF' }, { type: 'DEPARTMENT', ids: ['dept-1'] }],
      },
    })
  })

  it('short-circuits multiple role grants on ALL', async () => {
    loadUserAuthorization.mockResolvedValue(
      source([
        {
          code: 'staff',
          permissions: [
            { code: 'customer:list', scopeEnabled: true, dataScope: DataScope.SELF, customDepartments: [] },
          ],
        },
        {
          code: 'director',
          permissions: [{ code: 'customer:list', scopeEnabled: true, dataScope: DataScope.ALL, customDepartments: [] }],
        },
      ]),
    )

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.decisionFor('customer:list')).toEqual({
      scoped: true,
      grant: { all: true, scopes: [] },
    })
  })

  it('keeps CUSTOM with only disabled departments as scoped deny all', async () => {
    loadUserAuthorization.mockResolvedValue(
      source([
        {
          code: 'staff',
          permissions: [
            {
              code: 'customer:list',
              scopeEnabled: true,
              dataScope: DataScope.CUSTOM,
              customDepartments: [{ id: 'disabled', enabled: false }],
            },
          ],
        },
      ]),
    )
    resolve.mockResolvedValue({ all: false, scopes: [] })

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.decisionFor('customer:list')).toEqual({
      scoped: true,
      grant: { all: false, scopes: [] },
    })
  })

  it('gives super_admin wildcard permission and ALL for scoped permissions without role links', async () => {
    loadUserAuthorization.mockResolvedValue(
      source(
        [
          {
            code: 'super_admin',
            permissions: [],
          },
        ],
        'dept-1',
        [
          { code: 'customer:list', scopeEnabled: true },
          { code: 'health:read', scopeEnabled: false },
        ],
      ),
    )

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.hasPermission('anything')).toBe(true)
    expect(context.decisionFor('customer:list')).toEqual({
      scoped: true,
      grant: { all: true, scopes: [] },
    })
    expect(context.decisionFor('health:read')).toEqual({ scoped: false })
  })

  it('uses the cached expanded snapshot without resolving DEPT_TREE again', async () => {
    getOrLoad.mockResolvedValue({
      permissionCodes: ['customer:list'],
      decisions: {
        'customer:list': {
          scoped: true,
          grant: { all: false, scopes: [{ type: 'DEPARTMENT', ids: ['dept-1', 'dept-2'] }] },
        },
      },
    })

    const context = await service.createContext('user-1', ['customer:list'])

    expect(context.decisionFor('customer:list')).toEqual({
      scoped: true,
      grant: { all: false, scopes: [{ type: 'DEPARTMENT', ids: ['dept-1', 'dept-2'] }] },
    })
    expect(loadUserAuthorization).not.toHaveBeenCalled()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('expands the same DEPT_TREE only once across permissions and roles in one snapshot build', async () => {
    const findSubtreeDepartmentIds = jest.fn().mockResolvedValue(['dept-1', 'dept-2'])
    const actualService = new AuthorizationService(
      { loadUserAuthorization } as unknown as AuthorizationRepository,
      new ScopeResolverRegistry({ findSubtreeDepartmentIds }),
      {
        getOrLoad: (_userId: string, loader: () => Promise<unknown>) => loader(),
      } as unknown as AuthorizationSnapshotCacheService,
    )
    loadUserAuthorization.mockResolvedValue(
      source([
        {
          code: 'manager-a',
          permissions: [
            { code: 'customer:list', scopeEnabled: true, dataScope: DataScope.DEPT_TREE, customDepartments: [] },
          ],
        },
        {
          code: 'manager-b',
          permissions: [
            { code: 'customer:export', scopeEnabled: true, dataScope: DataScope.DEPT_TREE, customDepartments: [] },
            { code: 'customer:list', scopeEnabled: true, dataScope: DataScope.DEPT_TREE, customDepartments: [] },
          ],
        },
      ]),
    )

    await actualService.createContext('user-1', ['customer:list', 'customer:export'])

    expect(findSubtreeDepartmentIds).toHaveBeenCalledTimes(1)
  })
})

import { DataScope } from '@/prisma/generated/prisma/enums'
import { AuthorizationContext } from './authorization-context'
import { mergeGrants } from './grant-merger'
import { ScopeResolverRegistry } from './scope-resolver.registry'
import type { ScopeResolutionInput } from './scope-resolver.interface'

describe('authorization core', () => {
  describe('mergeGrants', () => {
    it('keeps an empty grant as deny all', () => {
      expect(mergeGrants([])).toEqual({ all: false, scopes: [] })
    })

    it('deduplicates SELF and unions sorted department ids', () => {
      expect(
        mergeGrants([
          { all: false, scopes: [{ type: 'SELF' }] },
          {
            all: false,
            scopes: [{ type: 'DEPARTMENT', ids: ['dept-b', 'dept-a', 'dept-a'] }, { type: 'SELF' }],
          },
          { all: false, scopes: [{ type: 'DEPARTMENT', ids: ['dept-c', 'dept-b'] }] },
        ]),
      ).toEqual({
        all: false,
        scopes: [{ type: 'SELF' }, { type: 'DEPARTMENT', ids: ['dept-a', 'dept-b', 'dept-c'] }],
      })
    })

    it('short-circuits on ALL', () => {
      expect(
        mergeGrants([
          { all: false, scopes: [{ type: 'SELF' }] },
          { all: true, scopes: [] },
        ]),
      ).toEqual({ all: true, scopes: [] })
    })
  })

  describe('AuthorizationContext', () => {
    it('supports wildcard permissions and immutable decisions', () => {
      const context = new AuthorizationContext('user-1', ['*'], {
        'customer:list': { scoped: true, grant: { all: false, scopes: [] } },
      })

      expect(context.hasPermission('anything')).toBe(true)
      expect(context.decisionFor('customer:list')).toEqual({
        scoped: true,
        grant: { all: false, scopes: [] },
      })
      expect(context.decisionFor('missing')).toBeUndefined()
      const readonlyPermissionCodes: ReadonlySet<string> = context.permissionCodes
      expect(readonlyPermissionCodes.has('*')).toBe(true)
      const mutatePublicType = (permissionCodes: typeof context.permissionCodes) => {
        // @ts-expect-error AuthorizationContext 仅公开只读权限集合
        permissionCodes.add('changed')
      }
      expect(() => mutatePublicType(context.permissionCodes)).toThrow()
    })
  })

  describe('ScopeResolverRegistry', () => {
    const departments = {
      findSubtreeDepartmentIds: jest.fn(),
    }
    const registry = new ScopeResolverRegistry(departments)
    const input: ScopeResolutionInput = {
      userId: 'user-1',
      departmentId: 'dept-1',
      customDepartments: [],
    }

    beforeEach(() => jest.clearAllMocks())

    it('resolves ALL and SELF', async () => {
      await expect(registry.resolve(DataScope.ALL, input)).resolves.toEqual({ all: true, scopes: [] })
      await expect(registry.resolve(DataScope.SELF, input)).resolves.toEqual({
        all: false,
        scopes: [{ type: 'SELF' }],
      })
    })

    it('resolves DEPT and fails closed without an enabled department', async () => {
      await expect(registry.resolve(DataScope.DEPT, input)).resolves.toEqual({
        all: false,
        scopes: [{ type: 'DEPARTMENT', ids: ['dept-1'] }],
      })
      await expect(registry.resolve(DataScope.DEPT, { ...input, departmentId: null })).resolves.toEqual({
        all: false,
        scopes: [],
      })
    })

    it('expands DEPT_TREE through DepartmentRepository', async () => {
      departments.findSubtreeDepartmentIds.mockResolvedValue(['dept-b', 'dept-1'])

      await expect(registry.resolve(DataScope.DEPT_TREE, input)).resolves.toEqual({
        all: false,
        scopes: [{ type: 'DEPARTMENT', ids: ['dept-1', 'dept-b'] }],
      })
    })

    it('filters disabled CUSTOM departments and fails closed when all are disabled', async () => {
      await expect(
        registry.resolve(DataScope.CUSTOM, {
          ...input,
          customDepartments: [
            { id: 'dept-b', enabled: false },
            { id: 'dept-a', enabled: true },
          ],
        }),
      ).resolves.toEqual({
        all: false,
        scopes: [{ type: 'DEPARTMENT', ids: ['dept-a'] }],
      })
      await expect(
        registry.resolve(DataScope.CUSTOM, {
          ...input,
          customDepartments: [{ id: 'dept-b', enabled: false }],
        }),
      ).resolves.toEqual({ all: false, scopes: [] })
    })
  })
})

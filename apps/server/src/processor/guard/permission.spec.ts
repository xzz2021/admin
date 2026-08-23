import { PERMISSION_KEY } from '@/processor/decorator/permission'
import { ALL_PERMISSIONS } from '@/processor/rbac/rbac-permission'
import type { RbacPermissionCacheService } from '@/processor/rbac/rbac-permission-cache.service'
import type { UserRepository } from '@/system/user/user.repository'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PermissionGuard } from './permission'

describe('PermissionGuard', () => {
  const findEnabledRolePermissionTree = jest.fn()
  const getOrLoad = jest.fn()

  const createGuard = () =>
    new PermissionGuard(
      { findEnabledRolePermissionTree } as unknown as UserRepository,
      { getOrLoad } as unknown as RbacPermissionCacheService,
      new Reflector(),
    )

  const createContext = (permission?: string, userId?: string): ExecutionContext => {
    const handler = () => undefined
    class TestController {}
    if (permission) Reflect.defineMetadata(PERMISSION_KEY, permission, handler)

    return {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { id: userId } : undefined }),
      }),
    } as unknown as ExecutionContext
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getOrLoad.mockImplementation(async (_userId: string, loader: () => Promise<string[]>) =>
      loader(),
    )
  })

  it('allows routes without permission metadata', async () => {
    await expect(createGuard().canActivate(createContext())).resolves.toBe(true)
    expect(getOrLoad).not.toHaveBeenCalled()
  })

  it('rejects protected routes without an authenticated user', async () => {
    await expect(createGuard().canActivate(createContext('user:update'))).resolves.toBe(false)
    expect(getOrLoad).not.toHaveBeenCalled()
  })

  it('uses cached permissions without querying the repository', async () => {
    getOrLoad.mockResolvedValue(['user:update'])

    await expect(createGuard().canActivate(createContext('user:update', 'user-1'))).resolves.toBe(
      true,
    )
    expect(getOrLoad).toHaveBeenCalledWith('user-1', expect.any(Function))
    expect(findEnabledRolePermissionTree).not.toHaveBeenCalled()
  })

  it('loads enabled role permissions from the user repository on cache miss', async () => {
    findEnabledRolePermissionTree.mockResolvedValue({
      roles: [
        {
          role: {
            code: 'admin',
            enabled: true,
            permissions: [{ permission: { code: 'user:update', enabled: true } }],
          },
        },
      ],
    })

    await expect(createGuard().canActivate(createContext('user:update', 'user-1'))).resolves.toBe(
      true,
    )
    expect(findEnabledRolePermissionTree).toHaveBeenCalledWith('user-1')
  })

  it('grants all permissions to an enabled super admin role', async () => {
    getOrLoad.mockResolvedValue([ALL_PERMISSIONS])

    await expect(createGuard().canActivate(createContext('user:update', 'user-1'))).resolves.toBe(
      true,
    )
  })

  it('rejects a request when the required permission is missing', async () => {
    getOrLoad.mockResolvedValue(['user:view'])

    await expect(createGuard().canActivate(createContext('user:update', 'user-1'))).resolves.toBe(
      false,
    )
  })
})

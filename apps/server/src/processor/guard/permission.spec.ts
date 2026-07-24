import type { PgService } from '@/prisma/pg.service'
import { PERMISSION_KEY } from '@/processor/decorator/permission'
import { RbacPermissionCacheService } from '@/processor/rbac'
import type { RedisService } from '@liaoliaots/nestjs-redis'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PermissionGuard } from './permission'

jest.mock('@/prisma/pg.service', () => ({
  PgService: class PgService {},
}))

describe('PermissionGuard', () => {
  const findUnique = jest.fn()
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }

  const createGuard = () => {
    const cache = new RbacPermissionCacheService({
      getOrThrow: () => redis,
    } as unknown as RedisService)
    return new PermissionGuard(
      { user: { findUnique } } as unknown as PgService,
      cache,
      new Reflector(),
    )
  }

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
    redis.get.mockResolvedValue(null)
    redis.set.mockResolvedValue('OK')
    redis.del.mockResolvedValue(1)
  })

  it('allows routes without permission metadata', async () => {
    await expect(createGuard().canActivate(createContext())).resolves.toBe(true)
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('rejects protected routes without an authenticated user', async () => {
    await expect(createGuard().canActivate(createContext('user:update'))).resolves.toBe(false)
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('uses cached permissions without querying the database', async () => {
    redis.get.mockResolvedValue(JSON.stringify(['user:update']))

    await expect(createGuard().canActivate(createContext('user:update', 'user-1'))).resolves.toBe(
      true,
    )
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('loads enabled role permissions from the database and caches them', async () => {
    findUnique.mockResolvedValue({
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
    expect(redis.set).toHaveBeenCalledWith(
      'rbac:permissions:user-1',
      JSON.stringify(['user:update']),
      'EX',
      300,
    )
  })

  it('grants all permissions to an enabled super admin role', async () => {
    findUnique.mockResolvedValue({
      roles: [
        {
          role: {
            code: 'super_admin',
            enabled: true,
            permissions: [],
          },
        },
      ],
    })

    await expect(createGuard().canActivate(createContext('user:update', 'user-1'))).resolves.toBe(
      true,
    )
  })
})

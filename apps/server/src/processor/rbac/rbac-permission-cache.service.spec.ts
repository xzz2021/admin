import type { PgService } from '@/prisma/pg.service'
import type { RedisService } from '@liaoliaots/nestjs-redis'
import { RbacPermissionCacheService } from './rbac-permission-cache.service'

describe('RbacPermissionCacheService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }
  const userRoleFindMany = jest.fn()
  const rolePermissionFindMany = jest.fn()

  const createService = () =>
    new RbacPermissionCacheService({ getOrThrow: () => redis } as unknown as RedisService)

  const pgService = {
    userRole: { findMany: userRoleFindMany },
    rolePermission: { findMany: rolePermissionFindMany },
  } as unknown as PgService

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reads and writes permission cache with ttl', async () => {
    const service = createService()
    redis.get.mockResolvedValue(JSON.stringify(['user:update']))
    redis.set.mockResolvedValue('OK')

    await expect(service.get('user-1')).resolves.toEqual(['user:update'])
    await service.set('user-1', ['user:update'])

    expect(redis.set).toHaveBeenCalledWith(
      'rbac:permissions:user-1',
      JSON.stringify(['user:update']),
      'EX',
      300,
    )
  })

  it('invalidates users by role membership', async () => {
    const service = createService()
    userRoleFindMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-1' },
      { userId: 'user-2' },
    ])
    redis.del.mockResolvedValue(2)

    await service.invalidateByRoleIds(['role-1'], pgService)

    expect(userRoleFindMany).toHaveBeenCalledWith({
      where: { roleId: { in: ['role-1'] } },
      select: { userId: true },
    })
    expect(redis.del).toHaveBeenCalledWith('rbac:permissions:user-1', 'rbac:permissions:user-2')
  })

  it('invalidates users by permission through roles', async () => {
    const service = createService()
    rolePermissionFindMany.mockResolvedValue([{ roleId: 'role-1' }])
    userRoleFindMany.mockResolvedValue([{ userId: 'user-9' }])
    redis.del.mockResolvedValue(1)

    await service.invalidateByPermissionIds(['perm-1'], pgService)

    expect(rolePermissionFindMany).toHaveBeenCalledWith({
      where: { permissionId: { in: ['perm-1'] } },
      select: { roleId: true },
    })
    expect(redis.del).toHaveBeenCalledWith('rbac:permissions:user-9')
  })
})

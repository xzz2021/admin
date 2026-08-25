import type { RbacPermissionCacheService } from '@/processor/rbac'
import type { PgService } from '@/prisma/pg.service'
import { RoleRepository } from './role.repository'
import { RoleService } from './role.service'

describe('RoleService seed and queries', () => {
  const roleFindMany = jest.fn()
  const roleCount = jest.fn()
  const roleFindUnique = jest.fn()
  const roleCreateMany = jest.fn()
  const roleUpsert = jest.fn()
  const menuFindMany = jest.fn()
  const roleMenuFindMany = jest.fn()
  const rolePermissionFindMany = jest.fn()
  const userFindUnique = jest.fn()
  const executeRaw = jest.fn()
  const transaction = jest.fn(
    async (
      callback: (tx: {
        role: {
          findMany: typeof roleFindMany
          createMany: typeof roleCreateMany
          upsert: typeof roleUpsert
        }
        $executeRaw: typeof executeRaw
      }) => Promise<unknown>,
    ) =>
      callback({
        role: { findMany: roleFindMany, createMany: roleCreateMany, upsert: roleUpsert },
        $executeRaw: executeRaw,
      }),
  )

  const service = new RoleService(
    new RoleRepository({
      $transaction: transaction,
      $executeRaw: executeRaw,
      role: {
        findMany: roleFindMany,
        count: roleCount,
        findUnique: roleFindUnique,
        createMany: roleCreateMany,
        upsert: roleUpsert,
      },
      user: { findUnique: userFindUnique },
      menu: { findMany: menuFindMany },
      roleMenu: { findMany: roleMenuFindMany },
      rolePermission: { findMany: rolePermissionFindMany },
    } as unknown as PgService),
    {} as unknown as RbacPermissionCacheService,
    { record: jest.fn() } as unknown as import('@/core/logger/audit-log.service').AuditLogService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    roleCreateMany.mockResolvedValue({ count: 1 })
    executeRaw.mockResolvedValue(1)
    roleUpsert.mockResolvedValue({})
  })

  it('seeds roles with createMany and one update statement instead of looping upsert', async () => {
    roleFindMany.mockResolvedValue([{ code: 'admin' }])

    await service.generateRoleSeed([
      { code: 'admin', name: '管理员', enabled: true, description: 'all' },
      { code: 'user', name: '用户', enabled: true, description: 'user' },
    ])

    expect(roleUpsert).not.toHaveBeenCalled()
    expect(roleCreateMany).toHaveBeenCalledTimes(1)
    expect(roleCreateMany).toHaveBeenCalledWith({
      data: [{ code: 'user', name: '用户', enabled: true, description: 'user' }],
    })
    expect(executeRaw).toHaveBeenCalledTimes(1)
    const sql = executeRaw.mock.calls[0][0] as { sql: string }
    expect(sql.sql).toMatch(/UPDATE\s+"Role"/i)
  })

  it('loads role menus and permissions in parallel', async () => {
    let resolveMenus!: (value: unknown[]) => void
    let resolveRoleMenus!: (value: unknown[]) => void
    let resolveRolePermissions!: (value: unknown[]) => void
    menuFindMany.mockReturnValue(
      new Promise(resolve => {
        resolveMenus = resolve
      }),
    )
    roleMenuFindMany.mockReturnValue(
      new Promise(resolve => {
        resolveRoleMenus = resolve
      }),
    )
    rolePermissionFindMany.mockReturnValue(
      new Promise(resolve => {
        resolveRolePermissions = resolve
      }),
    )

    const pending = service.getRoleMenuAndPerList('role-1')

    expect(menuFindMany).toHaveBeenCalled()
    expect(roleMenuFindMany).toHaveBeenCalled()
    expect(rolePermissionFindMany).toHaveBeenCalled()

    resolveMenus([])
    resolveRoleMenus([])
    resolveRolePermissions([])
    await expect(pending).resolves.toEqual({
      list: [],
      message: '获取角色菜单及权限列表成功',
    })
  })

  it('loads assigned menus and permissions in parallel for a user', async () => {
    let resolveRoleMenus!: (value: unknown[]) => void
    let resolveRolePermissions!: (value: unknown[]) => void
    roleMenuFindMany.mockReturnValue(
      new Promise(resolve => {
        resolveRoleMenus = resolve
      }),
    )
    rolePermissionFindMany.mockReturnValue(
      new Promise(resolve => {
        resolveRolePermissions = resolve
      }),
    )

    const pending = service.getUserMenusWithPermissionCodes(['role-1'])

    expect(roleMenuFindMany).toHaveBeenCalled()
    expect(rolePermissionFindMany).toHaveBeenCalled()

    resolveRoleMenus([])
    resolveRolePermissions([])
    await expect(pending).resolves.toEqual([])
  })

  it('throws when the role list is empty', async () => {
    roleFindMany.mockResolvedValue([])
    roleCount.mockResolvedValue(0)

    await expect(service.getRoleList({ pageIndex: 1, pageSize: 10 })).rejects.toThrow('角色列表数据为空')
  })

  it('reads creator name from the included user relation', async () => {
    roleFindUnique.mockResolvedValue({
      id: 'role-1',
      name: '管理员',
      code: 'admin',
      createdById: 'user-1',
      createdBy: { id: 'user-1', username: 'admin' },
      _count: { users: 1, menus: 2, permissions: 3 },
    })

    const result = await service.getRoleDetail('role-1')

    expect(result.creatorName).toBe('admin')
    expect(result).not.toHaveProperty('createdBy')
    expect(userFindUnique).not.toHaveBeenCalled()
  })
})

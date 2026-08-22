import type { PgService } from '@/prisma/pg.service'
import type { RbacPermissionCacheService } from '@/processor/rbac'
import { RoleService } from './role.service'

describe('RoleService seed and queries', () => {
  const roleFindMany = jest.fn()
  const roleCreateMany = jest.fn()
  const roleUpsert = jest.fn()
  const menuFindMany = jest.fn()
  const roleMenuFindMany = jest.fn()
  const rolePermissionFindMany = jest.fn()
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
    {
      $transaction: transaction,
      $executeRaw: executeRaw,
      role: { findMany: roleFindMany, createMany: roleCreateMany, upsert: roleUpsert },
      menu: { findMany: menuFindMany },
      roleMenu: { findMany: roleMenuFindMany },
      rolePermission: { findMany: rolePermissionFindMany },
    } as unknown as PgService,
    {} as unknown as RbacPermissionCacheService,
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
})

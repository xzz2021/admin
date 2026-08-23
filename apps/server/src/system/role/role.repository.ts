import { Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { Injectable } from '@nestjs/common'

type Db = PgService | Prisma.TransactionClient
/*
按DDD分层原则 应该属于领域层 但是为了方便 还是放在了仓储层
引入Repository之后专注于数据库的可复用操作 而不用关心业务逻辑(Service负责)
*/
@Injectable()
export class RoleRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn)
  }

  findById(id: string, tx: Db = this.db) {
    return tx.role.findUnique({ where: { id } })
  }

  findByIdWithCounts(id: string) {
    return this.db.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            menus: true,
            permissions: true,
          },
        },
      },
    })
  }

  findByCode(code: string, tx: Db = this.db) {
    return tx.role.findUnique({ where: { code } })
  }

  findByIdCode(id: string, tx: Db = this.db) {
    return tx.role.findUnique({
      where: { id },
      select: { id: true, code: true },
    })
  }

  findPage(where: Prisma.RoleWhereInput, skip: number, take: number) {
    return Promise.all([
      this.db.role.findMany({
        skip,
        take,
        where,
        orderBy: { sort: 'asc' },
      }),
      this.db.role.count({ where }),
    ])
  }

  findEnabledMenusWithPermissions() {
    return this.db.menu.findMany({
      where: { enabled: true },
      include: { permissions: { orderBy: { sort: 'asc' } } },
      orderBy: { sort: 'asc' },
    })
  }

  findRoleMenuIds(roleId: string) {
    return this.db.roleMenu.findMany({
      where: { roleId },
      select: { menuId: true },
    })
  }

  findRolePermissionIds(roleId: string) {
    return this.db.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    })
  }

  findUserRoles(userId: string) {
    return this.db.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: { id: true, code: true },
        },
      },
    })
  }

  findEnabledMenusWithAllPermissions() {
    return this.db.menu.findMany({
      where: { enabled: true },
      include: { permissions: true },
    })
  }

  findMenusByRoleIds(roleIds: string[]) {
    return this.db.roleMenu.findMany({
      where: { roleId: { in: roleIds } },
      include: { menu: true },
    })
  }

  findPermissionsByRoleIds(roleIds: string[]) {
    return this.db.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    })
  }

  findEnabledMenusByIds(ids: string[], tx: Db = this.db) {
    return tx.menu.findMany({
      where: { id: { in: ids }, enabled: true },
      select: { id: true },
    })
  }

  findEnabledPermissionsByIds(ids: string[], tx: Db = this.db) {
    return tx.permission.findMany({
      where: { id: { in: ids }, enabled: true },
      select: { id: true, menuId: true },
    })
  }

  findUsernameById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: { username: true },
    })
  }

  findUserIdsByRoleId(roleId: string, tx: Db = this.db) {
    return tx.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    })
  }

  findUserIdsByPermissionIds(permissionIds: string[]): Promise<Array<{ userId: string }>> {
    const uniqueIds = [...new Set(permissionIds.filter(Boolean))]
    if (!uniqueIds.length) return Promise.resolve([])
    return this.db.userRole.findMany({
      where: {
        role: {
          permissions: { some: { permissionId: { in: uniqueIds } } },
        },
      },
      select: { userId: true },
    })
  }

  findCodes(codes: string[], tx: Db = this.db) {
    return tx.role.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    })
  }

  create(
    data: { name: string; code: string; enabled: boolean; description?: string | null },
    tx: Db = this.db,
  ) {
    return tx.role.create({
      data,
      select: { id: true },
    })
  }

  createMany(
    data: Array<{
      code: string
      name: string
      enabled?: boolean
      description?: string | null
    }>,
    tx: Db = this.db,
  ) {
    return tx.role.createMany({ data })
  }

  createMenus(roleId: string, menuIds: string[], tx: Db = this.db) {
    if (!menuIds.length) return
    return tx.roleMenu.createMany({
      data: menuIds.map(menuId => ({ roleId, menuId })),
    })
  }

  createPermissions(roleId: string, permissionIds: string[], tx: Db = this.db) {
    if (!permissionIds.length) return
    return tx.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({ roleId, permissionId })),
    })
  }

  updateWithMenus(
    id: string,
    data: Prisma.RoleUpdateInput,
    menuIds: string[],
    permissionIds: string[],
    tx: Db = this.db,
  ) {
    return tx.role.update({
      where: { id },
      data: {
        ...data,
        menus: {
          deleteMany: {},
          ...(menuIds.length
            ? { create: menuIds.map(menuId => ({ menu: { connect: { id: menuId } } })) }
            : {}),
        },
        permissions: {
          deleteMany: {},
          ...(permissionIds.length
            ? {
                create: permissionIds.map(permissionId => ({
                  permission: { connect: { id: permissionId } },
                })),
              }
            : {}),
        },
      },
      select: { id: true },
    })
  }

  deleteById(id: string, tx: Db = this.db) {
    return tx.role.delete({
      where: { id },
      select: { id: true },
    })
  }

  deleteMenus(roleId: string, tx: Db = this.db) {
    return tx.roleMenu.deleteMany({ where: { roleId } })
  }

  deletePermissions(roleId: string, tx: Db = this.db) {
    return tx.rolePermission.deleteMany({ where: { roleId } })
  }

  executeRaw(sql: Prisma.Sql, tx: Db = this.db) {
    return tx.$executeRaw(sql)
  }
}

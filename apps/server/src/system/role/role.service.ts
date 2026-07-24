import { PgService } from '@/prisma/pg.service'
import { RbacPermissionCacheService } from '@/processor/rbac'
import { uniqueBy } from '@/processor/utils/array'
import { listToTree } from '@/processor/utils/list2tree.util'
import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/lib/prisma'
import { CreateRoleDto, QueryRoleParams, RoleSeedDto, UpdateRoleDto } from './dto/role.dto'
@Injectable()
export class RoleService {
  constructor(
    private readonly pgService: PgService,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
  ) {}

  private buildMenuPermissionData(menus: CreateRoleDto['menus']) {
    const menuMap = new Map<string, Set<string>>()
    for (const item of menus) {
      const permissionSet = menuMap.get(item.id) ?? new Set<string>()
      for (const permissionId of item.permissionIds) {
        permissionSet.add(permissionId)
      }
      menuMap.set(item.id, permissionSet)
    }
    const menuIds = [...menuMap.keys()]
    const permissionIds = [...new Set([...menuMap.values()].flatMap(item => [...item]))]
    return { menuMap, menuIds, permissionIds }
  }

  private async validateMenuPermissions(menuMap: Map<string, Set<string>>, menuIds: string[], permissionIds: string[], tx: Prisma.TransactionClient) {
    const menus = await tx.menu.findMany({
      where: { id: { in: menuIds }, enabled: true },
      select: { id: true },
    })
    if (menus.length !== menuIds.length) throw new BadRequestException('存在无效或被禁用的菜单')

    if (!permissionIds.length) return

    const permissions = await tx.permission.findMany({
      where: { id: { in: permissionIds }, enabled: true },
      select: { id: true, menuId: true },
    })
    if (permissions.length !== permissionIds.length) throw new BadRequestException('存在无效或被禁用的权限')

    const permissionMenuMap = new Map<string, string>()
    for (const permission of permissions) {
      permissionMenuMap.set(permission.id, permission.menuId)
    }
    for (const [menuId, permissionSet] of menuMap) {
      for (const permissionId of permissionSet) {
        const permissionMenuId = permissionMenuMap.get(permissionId)
        if (permissionMenuId !== menuId) {
          throw new BadRequestException(`权限 ${permissionId} 不属于菜单 ${menuId}`)
        }
      }
    }
  }

  async createRoleInfo(dto: CreateRoleDto) {
    const { menuMap, menuIds, permissionIds } = this.buildMenuPermissionData(dto.menus)
    const res = await this.pgService.$transaction(async tx => {
      const existRole = await tx.role.findUnique({
        where: { code: dto.code },
      })
      if (existRole) throw new BadRequestException('角色编码已存在')
      await this.validateMenuPermissions(menuMap, menuIds, permissionIds, tx)
      const role = await tx.role.create({
        data: {
          name: dto.name,
          code: dto.code,
          enabled: dto.enabled ?? true,
          description: dto.description,
        },
        select: { id: true },
      })
      if (menuIds.length) await tx.roleMenu.createMany({ data: menuIds.map(menuId => ({ roleId: role.id, menuId })) })
      if (permissionIds.length) await tx.rolePermission.createMany({ data: permissionIds.map(permissionId => ({ roleId: role.id, permissionId })) })
      return role
    })
    return { message: '创建角色成功', id: res.id }
  }

  async getRoleDetail(id: string) {
    const role = await this.pgService.role.findUnique({
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
    if (!role) throw new BadRequestException('角色不存在')

    let creatorName = '-'
    if (role.createdBy) {
      const creator = await this.pgService.user.findUnique({
        where: { id: role.createdBy },
        select: { username: true },
      })
      creatorName = creator?.username || role.createdBy
    }

    const { _count, ...roleInfo } = role
    return {
      ...roleInfo,
      creatorName,
      menuCount: _count.menus,
      permissionCount: _count.permissions,
      userCount: _count.users,
      message: '获取角色详情成功',
    }
  }

  // 管理模块 获取角色列表 用于展示
  async getRoleList(searchParam: QueryRoleParams) {
    const { pageIndex = 1, pageSize = 10, keyword, enabled } = searchParam
    const skip = (pageIndex - 1) * pageSize
    const take = pageSize
    const keywordText = keyword?.trim()
    const where = {
      ...(keywordText
        ? {
            OR: [{ name: { contains: keywordText } }, { code: { contains: keywordText } }],
          }
        : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    }
    const [list, total] = await Promise.all([
      this.pgService.role.findMany({
        skip,
        take,
        where,
        orderBy: { sort: 'asc' },
      }),
      this.pgService.role.count({ where }),
    ])
    return { list, total, message: '获取角色列表成功' }
  }

  // 管理模块 获取指定角色菜单及对应拥有的权限列表,用于回显
  async getRoleMenuAndPerList(id: string) {
    // 如果id== "__new__" 说明是新增角色 则直接查出所有菜单和权限
    if (id === '__new__') {
      const list = await this.pgService.menu.findMany({
        where: { enabled: true },
        include: { permissions: { orderBy: { sort: 'asc' } } },
        orderBy: { sort: 'asc' },
      })
      return { list: listToTree(list), message: '获取角色菜单及权限列表成功' }
    }
    // 1. 查出所有menu 2. 查出角色所拥有的menu 3. 查出角色所拥有的permission 4. 将拥有的项加上checked  5. 将menu和permission组装成树形结构
    const menus = await this.pgService.menu.findMany({
      where: { enabled: true },
      include: { permissions: { orderBy: { sort: 'asc' } } },
      orderBy: { sort: 'asc' },
    })
    const roleMenus = await this.pgService.roleMenu.findMany({
      where: { roleId: id },
      select: { menuId: true },
    })
    const rolePermissions = await this.pgService.rolePermission.findMany({
      where: { roleId: id },
      select: { permissionId: true },
    })
    const menuSet = new Set(roleMenus.map(i => i.menuId))
    const permissionSet = new Set(rolePermissions.map(i => i.permissionId))
    const nodes = menus.map(menu => ({
      ...menu,

      checked: menuSet.has(menu.id),

      permissions: menu.permissions.map(permission => ({
        ...permission,

        checked: permissionSet.has(permission.id) && permission.enabled,
      })),

      children: [],
    }))
    return { list: listToTree(nodes), message: '获取角色菜单及权限列表成功' }
  }

  //  登录瞬间获取菜单表和对应的权限值字符串数组
  async findRoleMenu(userid: string) {
    //  通过userid查询当前用户角色是否其中之一是super_admin
    const users = await this.pgService.userRole.findMany({
      where: { userId: userid },
      select: {
        role: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    })
    if (users.some(u => u.role.code === 'super_admin')) {
      return { list: await this.getRoleMenuWithPermissionOfAdmin(), message: '获取用户菜单成功' }
    }
    const roleIds = users.map(u => u.role.id)

    const list = await this.getUserMenusWithPermissionCodes(roleIds)
    if (list.length === 0) {
      return { list, message: '请联系管理员分配角色菜单' }
    }

    return { list, message: '获取用户菜单成功' }
  }

  // 获取全部菜单及对应权限
  async getRoleMenuWithPermissionOfAdmin() {
    const roleWithMenusAndPermissions = await this.pgService.menu.findMany({
      where: { enabled: true },
      include: {
        permissions: true,
      },
    })
    if (!roleWithMenusAndPermissions || roleWithMenusAndPermissions.length === 0) {
      return []
    }
    // 整理权限名数组到每个菜单的 meta.permission 中
    const result = roleWithMenusAndPermissions.map(menu => {
      const { permissions, ...rest } = menu
      const permissionCodes = permissions.map(p => p.code)

      return {
        ...rest,
        permissions: permissionCodes,
      }
    })
    return result
  }

  async getUserMenusWithPermissionCodes(roleIds: string[]) {
    if (roleIds.length === 0) return []
    // 先查询roleMenu表 获取到每个角色拥有的菜单并去重
    const roleMenus = await this.pgService.roleMenu.findMany({
      where: { roleId: { in: roleIds } },
      include: {
        menu: true,
      },
    })
    const rolePermissions = await this.pgService.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: {
        permission: true,
      },
    })
    const menus = uniqueBy(
      roleMenus.map(r => r.menu),
      menu => menu.id,
    )
    const permissions = uniqueBy(
      rolePermissions.map(r => r.permission),
      permission => permission.code,
    )

    // 4) 把 permission.code 注入到对应菜单的 meta 里
    const shaped = menus.map(m => {
      const codes = permissions.filter(p => p.menuId === m.id).map(p => p.code)

      return { ...m, permissions: codes }
    })

    return shaped
  }

  async update(dto: UpdateRoleDto) {
    const { id, menus, ...rest } = dto
    const { menuMap, menuIds, permissionIds } = this.buildMenuPermissionData(menus)
    const res = await this.pgService.$transaction(async tx => {
      const existRole = await tx.role.findUnique({
        where: { id },
        select: { id: true, code: true },
      })
      if (!existRole) throw new BadRequestException('角色不存在')

      if (rest.code && rest.code !== existRole.code) {
        const codeUsed = await tx.role.findUnique({ where: { code: rest.code } })
        if (codeUsed) throw new BadRequestException('角色编码已存在')
      }

      await this.validateMenuPermissions(menuMap, menuIds, permissionIds, tx)

      const role = await tx.role.update({
        where: { id },
        data: {
          ...rest,
          menus: {
            deleteMany: {},
            ...(menuIds.length
              ? {
                  create: menuIds.map(menuId => ({
                    menu: { connect: { id: menuId } },
                  })),
                }
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
      return role
    })
    await this.rbacPermissionCache.invalidateByRoleIds([id], this.pgService)
    return { id: res.id, message: '更新角色成功' }
  }

  async remove(id: string) {
    const res = await this.pgService.$transaction(async tx => {
      const users = await tx.userRole.findMany({
        where: { roleId: id },
        select: { userId: true },
      })
      const role = await tx.role.delete({
        where: { id },
        select: { id: true },
      })
      await tx.roleMenu.deleteMany({ where: { roleId: id } })
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      return { role, userIds: users.map(item => item.userId) }
    })
    await this.rbacPermissionCache.invalidateUsers(res.userIds)
    return { id: res.role.id, message: '删除角色成功' }
  }

  async generateRoleSeed(data: RoleSeedDto[]) {
    // 创建或更新  如果当前项已存在相同的name 和code  则只更新当前项

    await this.pgService.$transaction(async tx => {
      for (const role of data) {
        await tx.role.upsert({
          where: { code: role.code },
          update: { ...role, id: undefined },
          create: { ...role, id: undefined },
        })
      }
    })
    return { message: '生成角色种子数据成功', success: true }
  }
}

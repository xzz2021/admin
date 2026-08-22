import { Prisma } from '@/prisma/generated/prisma/client'
import { RbacPermissionCacheService } from '@/processor/rbac'
import { uniqueBy } from '@/processor/utils/array'
import { listToTree } from '@/processor/utils/list2tree.util'
import { sqlBatchUpdateRoles } from '@/processor/utils/sql-batch'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CreateRoleDto, QueryRoleParams, RoleSeedDto, UpdateRoleDto } from './dto/role.dto'
import { RoleRepository } from './role.repository'

@Injectable()
export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
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

  private async validateMenuPermissions(
    menuMap: Map<string, Set<string>>,
    menuIds: string[],
    permissionIds: string[],
    tx: Prisma.TransactionClient,
  ) {
    const [menus, permissions] = await Promise.all([
      this.roles.findEnabledMenusByIds(menuIds, tx),
      permissionIds.length
        ? this.roles.findEnabledPermissionsByIds(permissionIds, tx)
        : Promise.resolve([]),
    ])
    if (menus.length !== menuIds.length) throw new BadRequestException('存在无效或被禁用的菜单')

    if (!permissionIds.length) return

    if (permissions.length !== permissionIds.length)
      throw new BadRequestException('存在无效或被禁用的权限')

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
    const res = await this.roles.transaction(async tx => {
      const existRole = await this.roles.findByCode(dto.code, tx)
      if (existRole) throw new BadRequestException('角色编码已存在')
      await this.validateMenuPermissions(menuMap, menuIds, permissionIds, tx)
      const role = await this.roles.create(
        {
          name: dto.name,
          code: dto.code,
          enabled: dto.enabled ?? true,
          description: dto.description,
        },
        tx,
      )
      await this.roles.createMenus(role.id, menuIds, tx)
      await this.roles.createPermissions(role.id, permissionIds, tx)
      return role
    })
    return { message: '创建角色成功', id: res.id }
  }

  async getRoleDetail(id: string) {
    const role = await this.roles.findByIdWithCounts(id)
    if (!role) throw new BadRequestException('角色不存在')

    let creatorName = '-'
    if (role.createdBy) {
      const creator = await this.roles.findUsernameById(role.createdBy)
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
    const [list, total] = await this.roles.findPage(where, skip, take)
    return { list, total, message: '获取角色列表成功' }
  }

  // 管理模块 获取指定角色菜单及对应拥有的权限列表,用于回显
  async getRoleMenuAndPerList(id: string) {
    // 如果id== "__new__" 说明是新增角色 则直接查出所有菜单和权限
    if (id === '__new__') {
      const list = await this.roles.findEnabledMenusWithPermissions()
      return { list: listToTree(list), message: '获取角色菜单及权限列表成功' }
    }
    const [menus, roleMenus, rolePermissions] = await Promise.all([
      this.roles.findEnabledMenusWithPermissions(),
      this.roles.findRoleMenuIds(id),
      this.roles.findRolePermissionIds(id),
    ])
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
    const users = await this.roles.findUserRoles(userid)
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
    const roleWithMenusAndPermissions = await this.roles.findEnabledMenusWithAllPermissions()
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
    const [roleMenus, rolePermissions] = await Promise.all([
      this.roles.findMenusByRoleIds(roleIds),
      this.roles.findPermissionsByRoleIds(roleIds),
    ])
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
    const res = await this.roles.transaction(async tx => {
      const existRole = await this.roles.findByIdCode(id, tx)
      if (!existRole) throw new BadRequestException('角色不存在')

      if (rest.code && rest.code !== existRole.code) {
        const codeUsed = await this.roles.findByCode(rest.code, tx)
        if (codeUsed) throw new BadRequestException('角色编码已存在')
      }

      await this.validateMenuPermissions(menuMap, menuIds, permissionIds, tx)

      return this.roles.updateWithMenus(id, rest, menuIds, permissionIds, tx)
    })
    await this.rbacPermissionCache.invalidateByRoleIds([id], this.roles.prisma)
    return { id: res.id, message: '更新角色成功' }
  }

  async remove(id: string) {
    const res = await this.roles.transaction(async tx => {
      const users = await this.roles.findUserIdsByRoleId(id, tx)
      const role = await this.roles.deleteById(id, tx)
      await this.roles.deleteMenus(id, tx)
      await this.roles.deletePermissions(id, tx)
      return { role, userIds: users.map(item => item.userId) }
    })
    await this.rbacPermissionCache.invalidateUsers(res.userIds)
    return { id: res.role.id, message: '删除角色成功' }
  }

  async generateRoleSeed(data: RoleSeedDto[]) {
    const roles = uniqueBy(data, role => role.code)
    if (roles.length === 0) {
      return { message: '生成角色种子数据成功', success: true }
    }

    await this.roles.transaction(async tx => {
      const existing = await this.roles.findCodes(
        roles.map(role => role.code),
        tx,
      )
      const existingCodes = new Set(existing.map(role => role.code))
      const toCreate = roles.filter(role => !existingCodes.has(role.code))
      const toUpdate = roles.filter(role => existingCodes.has(role.code))

      if (toCreate.length) {
        await this.roles.createMany(
          toCreate.map(role => ({
            code: role.code,
            name: role.name,
            ...(role.enabled !== undefined ? { enabled: role.enabled } : {}),
            ...(role.description !== undefined ? { description: role.description } : {}),
          })),
          tx,
        )
      }
      if (toUpdate.length) {
        await this.roles.executeRaw(
          sqlBatchUpdateRoles(
            toUpdate.map(role => ({
              code: role.code,
              name: role.name,
              description: role.description ?? null,
              enabled: role.enabled ?? null,
            })),
          ),
          tx,
        )
      }
    })
    return { message: '生成角色种子数据成功', success: true }
  }
}

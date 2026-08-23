import { PgService } from '@/prisma/pg.service'
import { RbacPermissionCacheService } from '@/processor/rbac'
import { RoleRepository } from '@/system/role/role.repository'
import { Injectable } from '@nestjs/common'
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto'

@Injectable()
export class PermissionService {
  constructor(
    private readonly pgService: PgService,
    private readonly roles: RoleRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto) {
    const res = await this.pgService.permission.create({
      data: createPermissionDto,
      select: { id: true },
    })
    return { id: res.id, message: '创建权限成功' }
  }

  async update(updatePermissionDto: UpdatePermissionDto) {
    const { id, ...rest } = updatePermissionDto
    const res = await this.pgService.permission.update({
      where: { id },
      data: rest,
      select: { id: true },
    })
    const users = await this.roles.findUserIdsByPermissionIds([id])
    await this.rbacPermissionCache.invalidateUsers(users.map(item => item.userId))
    return { id: res.id, message: '更新权限成功' }
  }

  async remove(id: string) {
    const users = await this.roles.findUserIdsByPermissionIds([id])
    await this.rbacPermissionCache.invalidateUsers(users.map(item => item.userId))
    const res = await this.pgService.permission.delete({
      where: { id },
      select: { id: true },
    })
    return { id: res.id, message: '删除权限成功' }
  }
}

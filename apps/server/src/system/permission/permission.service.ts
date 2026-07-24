import { PgService } from '@/prisma/pg.service';
import { RbacPermissionCacheService } from '@/processor/rbac';
import { Injectable } from '@nestjs/common';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    private readonly pgService: PgService,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
  ) {}

  async create(createPermissionDto: CreatePermissionDto) {
    const res = await this.pgService.permission.create({
      data: createPermissionDto,
      select: { id: true },
    });
    return { id: res.id, message: '创建权限成功' };
  }

  async update(updatePermissionDto: UpdatePermissionDto) {
    const { id, ...rest } = updatePermissionDto;
    const res = await this.pgService.permission.update({
      where: { id },
      data: rest,
      select: { id: true },
    });
    await this.rbacPermissionCache.invalidateByPermissionIds([id], this.pgService);
    return { id: res.id, message: '更新权限成功' };
  }

  async remove(id: string) {
    try {
      await this.rbacPermissionCache.invalidateByPermissionIds([id], this.pgService);
      const res = await this.pgService.permission.delete({
        where: { id },
        select: { id: true },
      });
      return { id: res.id, message: '删除权限成功' };
    } catch (error) {
      return { code: 400, message: error instanceof Error ? error.message : '删除权限失败' };
    }
  }
}

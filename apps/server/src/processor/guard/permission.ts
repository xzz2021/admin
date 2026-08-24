import { PERMISSION_KEY } from '@/processor/decorator/permission'
import { isTransientDbError } from '@/processor/filter/prisma.exception'
import { ALL_PERMISSIONS, resolvePermissionCodes } from '@/processor/rbac/rbac-permission'
import { RbacPermissionCacheService } from '@/processor/rbac/rbac-permission-cache.service'
import { UserRepository } from '@/system/user/user.repository'
import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
/*

此guard 通过rbac定义 控制了 所有 路由 调用 和 按钮操作 的权限

还需要casl 控制 更 细颗粒度 的 表格 及 字段 操作 的权限

*/
interface AuthenticatedRequest {
  user?: {
    id?: string
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly users: UserRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredPermission) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const userId = request.user?.id
    if (!userId) return false

    let permissions: string[]
    try {
      permissions = await this.rbacPermissionCache.getOrLoad(userId, async () => {
        const user = await this.users.findEnabledRolePermissionTree(userId)
        return resolvePermissionCodes(user)
      })
    } catch (error) {
      if (isTransientDbError(error)) {
        throw new ServiceUnavailableException('数据库暂不可用，请稍后重试')
      }
      // Redis 短暂故障时也不要伪装成鉴权失败
      const msg = error instanceof Error ? error.message : String(error)
      if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|Connection is closed|READONLY/i.test(msg)) {
        throw new ServiceUnavailableException('缓存服务暂不可用，请稍后重试')
      }
      throw error
    }

    return permissions.includes(ALL_PERMISSIONS) || permissions.includes(requiredPermission)
  }
}

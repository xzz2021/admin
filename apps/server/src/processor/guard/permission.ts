import { PgService } from '@/prisma/pg.service'
import { PERMISSION_KEY } from '@/processor/decorator/permission'
import { isTransientDbError } from '@/processor/filter/prisma.exception'
import { RbacPermissionCacheService } from '@/processor/rbac'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
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
  private static readonly SUPER_ADMIN_ROLE = 'super_admin'
  private static readonly ALL_PERMISSIONS = '*'

  constructor(
    private readonly pgService: PgService,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
    private readonly reflector: Reflector,
  ) {}

  async getPermissions(userId: string): Promise<string[]> {
    const user = await this.pgService.user.findUnique({
      where: {
        id: userId,
        enabled: true,
      },
      select: {
        roles: {
          select: {
            role: {
              select: {
                code: true,
                enabled: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                        enabled: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) return []
    const enabledRoles = user.roles.map(item => item.role).filter(role => role.enabled)
    if (enabledRoles.some(role => role.code === PermissionGuard.SUPER_ADMIN_ROLE)) {
      return [PermissionGuard.ALL_PERMISSIONS]
    }

    return [
      ...new Set(
        enabledRoles.flatMap(role =>
          role.permissions
            .filter(item => item.permission.enabled)
            .map(item => item.permission.code),
        ),
      ),
    ]
  }

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
      permissions = await this.rbacPermissionCache.getOrLoad(userId, () =>
        this.getPermissions(userId),
      )
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

    return (
      permissions.includes(PermissionGuard.ALL_PERMISSIONS) ||
      permissions.includes(requiredPermission)
    )
  }
}

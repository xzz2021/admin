import type { AuthorizationContext } from '@/processor/authorization/authorization-context'
import { AuthorizationService } from '@/processor/authorization/authorization.service'
import { PERMISSION_KEY } from '@/processor/decorator/permission'
import { isTransientDbError } from '@/processor/filter/prisma.exception'
import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
/*

此guard 通过rbac定义 控制了 所有 路由 调用 和 按钮操作 的权限

还需要casl 控制 更 细颗粒度 的 表格 及 字段 操作 的权限

*/
export interface AuthorizedJwtRequest extends Request {
  user?: {
    id?: string
  }
  authorizationContext?: AuthorizationContext
}

/** @deprecated 使用 AuthorizedJwtRequest。 */
export type AuthorizedRequest = AuthorizedJwtRequest

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredPermission) return true

    const request = context.switchToHttp().getRequest<AuthorizedJwtRequest>()
    const userId = request.user?.id
    if (!userId) return false

    try {
      const authorizationContext = await this.authorization.createContext(userId, [requiredPermission])
      request.authorizationContext = authorizationContext
      return authorizationContext.hasPermission(requiredPermission)
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error
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
    // return permissions.includes(ALL_PERMISSIONS) || permissions.includes(requiredPermission)
  }
}

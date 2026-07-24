import { RedisKeys } from '@/processor/constants/cache'
import { PgService } from '@/prisma/pg.service'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
export class RbacPermissionCacheService {
  static readonly TTL_SECONDS = 5 * 60

  private readonly redis: Redis

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow()
  }

  key(userId: string) {
    return `${RedisKeys.RBAC_PERMISSIONS_PREFIX}${userId}`
  }

  async get(userId: string): Promise<string[] | null> {
    const cached = await this.redis.get(this.key(userId))
    if (cached === null) return null

    try {
      const parsed: unknown = JSON.parse(cached)
      if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
        throw new Error('Invalid permission cache')
      }
      return parsed
    } catch {
      await this.redis.del(this.key(userId))
      return null
    }
  }

  async set(userId: string, permissions: string[]) {
    await this.redis.set(this.key(userId), JSON.stringify(permissions), 'EX', RbacPermissionCacheService.TTL_SECONDS)
  }

  async invalidateUsers(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))]
    if (!uniqueIds.length) return
    await this.redis.del(...uniqueIds.map(id => this.key(id)))
  }

  async invalidateByRoleIds(roleIds: string[], pgService: PgService) {
    const uniqueRoleIds = [...new Set(roleIds.filter(Boolean))]
    if (!uniqueRoleIds.length) return

    const links = await pgService.userRole.findMany({
      where: { roleId: { in: uniqueRoleIds } },
      select: { userId: true },
    })
    await this.invalidateUsers(links.map(item => item.userId))
  }

  async invalidateByPermissionIds(permissionIds: string[], pgService: PgService) {
    const uniquePermissionIds = [...new Set(permissionIds.filter(Boolean))]
    if (!uniquePermissionIds.length) return

    const links = await pgService.rolePermission.findMany({
      where: { permissionId: { in: uniquePermissionIds } },
      select: { roleId: true },
    })
    await this.invalidateByRoleIds(
      links.map(item => item.roleId),
      pgService,
    )
  }
}

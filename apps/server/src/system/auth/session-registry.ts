import { randomUUID } from 'crypto'
import Redis from 'ioredis'

export interface SessionRegistryOptions {
  listPrefix: string
  expiryPrefix: string
  blacklistPrefix: string
  lockPrefix: string
  ttlSeconds: number
  maxSessions: number
  lockTtlMs?: number
  lockMaxWaitMs?: number
}

/**
 * Redis 会话注册表：统一管理会话列表、过期时间、逐出、轮换和黑名单。
 */
export class SessionRegistry {
  private readonly lockTtlMs: number
  private readonly lockMaxWaitMs: number

  constructor(
    private readonly redis: Redis,
    private readonly options: SessionRegistryOptions,
  ) {
    this.lockTtlMs = options.lockTtlMs ?? 400
    this.lockMaxWaitMs = options.lockMaxWaitMs ?? 300
  }

  private listKey(userId: string) {
    return `${this.options.listPrefix}${userId}`
  }

  private expiryKey(jti: string) {
    return `${this.options.expiryPrefix}${jti}`
  }

  private blacklistKey(jti: string) {
    return `${this.options.blacklistPrefix}${jti}`
  }

  private lockKey(userId: string) {
    return `${this.options.lockPrefix}${userId}`
  }

  private async withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const key = this.lockKey(userId)
    const owner = randomUUID()
    const startedAt = Date.now()
    let acquired = false

    while (!acquired && Date.now() - startedAt <= this.lockMaxWaitMs) {
      acquired = (await this.redis.set(key, owner, 'PX', this.lockTtlMs, 'NX')) === 'OK'
      if (!acquired) {
        await new Promise(resolve => setTimeout(resolve, Math.floor(10 + Math.random() * 20)))
      }
    }

    try {
      return await fn()
    } finally {
      if (acquired && (await this.redis.get(key)) === owner) {
        await this.redis.del(key)
      }
    }
  }

  private async loadList(userId: string): Promise<string[]> {
    const raw = await this.redis.get(this.listKey(userId))
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : []
    } catch {
      return []
    }
  }

  private async saveList(userId: string, list: string[]) {
    if (!list.length) {
      await this.redis.del(this.listKey(userId))
      return
    }
    await this.redis.set(this.listKey(userId), JSON.stringify(list), 'EX', this.options.ttlSeconds)
  }

  private async getExpiry(jti: string): Promise<number> {
    const stored = await this.redis.get(this.expiryKey(jti))
    const fallback = Math.floor(Date.now() / 1000) + this.options.ttlSeconds
    if (!stored) return fallback
    const parsed = Number(stored)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  async register(userId: string, jti: string, exp: number, oldJti?: string): Promise<void> {
    await this.redis.set(this.expiryKey(jti), String(exp), 'EX', this.options.ttlSeconds)

    await this.withUserLock(userId, async () => {
      let list = await this.loadList(userId)

      if (oldJti) {
        list = list.filter(item => item !== oldJti)
        await this.blacklist(oldJti, await this.getExpiry(oldJti))
        await this.redis.del(this.expiryKey(oldJti))
      }

      list = [jti, ...list.filter(item => item !== jti)]
      const evicted = list.slice(this.options.maxSessions)
      await this.saveList(userId, list.slice(0, this.options.maxSessions))

      for (const evictedJti of evicted) {
        await this.blacklist(evictedJti, await this.getExpiry(evictedJti))
        await this.redis.del(this.expiryKey(evictedJti))
      }
    })
  }

  async revoke(userId: string, jti: string): Promise<void> {
    await this.withUserLock(userId, async () => {
      const list = await this.loadList(userId)
      await this.saveList(
        userId,
        list.filter(item => item !== jti),
      )
    })
    await this.blacklist(jti, await this.getExpiry(jti))
    await this.redis.del(this.expiryKey(jti))
  }

  async revokeAll(userId: string, exceptJti?: string): Promise<void> {
    let revoked: string[] = []
    await this.withUserLock(userId, async () => {
      const list = await this.loadList(userId)
      revoked = exceptJti ? list.filter(item => item !== exceptJti) : list
      await this.saveList(userId, exceptJti && list.includes(exceptJti) ? [exceptJti] : [])
    })

    for (const jti of revoked) {
      await this.blacklist(jti, await this.getExpiry(jti))
      await this.redis.del(this.expiryKey(jti))
    }
  }

  async blacklist(jti: string, exp: number): Promise<void> {
    let ttl = exp - Math.floor(Date.now() / 1000)
    if (ttl <= 0) ttl = this.options.ttlSeconds
    await this.redis.set(this.blacklistKey(jti), '1', 'EX', ttl)
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return (await this.redis.get(this.blacklistKey(jti))) === '1'
  }

  async listSessions(userId: string): Promise<string[]> {
    return this.loadList(userId)
  }
}

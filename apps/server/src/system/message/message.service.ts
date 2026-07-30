import { MessageType, NoticeLevel, Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { isRichTextEmpty, sanitizeRichText } from '@/processor/utils'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { InjectQueue } from '@nestjs/bullmq'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Queue } from 'bullmq'
import type Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { MESSAGE_JOB, MESSAGE_QUEUE, MESSAGE_UNREAD_PREFIX } from './message.constants'
import type { MessageDispatchJob, MessageListItem } from './message.types'

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name)
  private readonly redis: Redis

  constructor(
    private readonly pgService: PgService,
    redisService: RedisService,
    @InjectQueue(MESSAGE_QUEUE) private readonly queue: Queue,
  ) {
    this.redis = redisService.getOrThrow('default')
  }

  /** 入队异步发送（站内信） */
  async enqueueMail(input: {
    senderId: string
    receiverIds: string[]
    title: string
    content: string
    level?: NoticeLevel
    meta?: Record<string, unknown>
  }) {
    const receiverIds = [...new Set(input.receiverIds)]
    if (receiverIds.includes(input.senderId)) {
      throw new BadRequestException('不能给自己发送站内信')
    }
    const receivers = await this.pgService.user.findMany({
      where: { id: { in: receiverIds }, enabled: true },
      select: { id: true },
    })
    if (receivers.length !== receiverIds.length) {
      throw new BadRequestException('部分接收人不存在或已禁用')
    }

    await this.addJob({
      type: MessageType.MAIL,
      title: input.title,
      content: input.content,
      level: input.level ?? NoticeLevel.INFO,
      senderId: input.senderId,
      receiverIds,
      meta: input.meta ?? null,
    })
    return { message: `站内信已加入发送队列，共 ${receiverIds.length} 位接收人` }
  }

  /** 入队系统通知（全体启用用户） */
  async enqueueSystem(input: {
    senderId?: string
    title: string
    content: string
    level?: NoticeLevel
    meta?: Record<string, unknown>
  }) {
    await this.addJob({
      type: MessageType.SYSTEM,
      title: input.title,
      content: input.content,
      level: input.level ?? NoticeLevel.INFO,
      senderId: input.senderId ?? null,
      meta: input.meta ?? null,
    })
    return { message: '系统通知已加入发送队列' }
  }

  /** 入队告警（发给超级管理员） */
  async enqueueAlert(input: {
    title: string
    content: string
    level?: NoticeLevel
    meta?: Record<string, unknown>
  }) {
    await this.addJob({
      type: MessageType.ALERT,
      title: input.title,
      content: input.content,
      level: input.level ?? NoticeLevel.WARNING,
      senderId: null,
      meta: input.meta ?? null,
    })
    return { message: '告警通知已加入发送队列' }
  }

  /**
   * 监控等场景防抖告警：同一 key 在 ttlSec 内只入队一次。
   * 返回是否成功入队。
   */
  async enqueueAlertDebounced(
    debounceKey: string,
    input: { title: string; content: string; level?: NoticeLevel; meta?: Record<string, unknown> },
    ttlSec = 600,
  ): Promise<boolean> {
    const key = `message:alert:debounce:${debounceKey}`
    try {
      const ok = await this.redis.set(key, '1', 'EX', ttlSec, 'NX')
      if (ok !== 'OK') return false
    } catch (error) {
      this.logger.debug(
        `告警防抖锁失败，仍尝试发送: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    try {
      await this.enqueueAlert(input)
      return true
    } catch (error) {
      this.logger.warn(`告警入队失败: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async list(
    userId: string,
    query: { pageIndex?: number; pageSize?: number; type?: MessageType; unreadOnly?: boolean },
  ) {
    const pageIndex = Math.max(1, query.pageIndex ?? 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))
    const where: Prisma.MessageWhereInput = { receiverId: userId }
    if (query.type) where.type = query.type
    if (query.unreadOnly) where.readAt = null

    const [list, total, unread] = await Promise.all([
      this.pgService.message.findMany({
        where,
        skip: (pageIndex - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, username: true } },
        },
      }),
      this.pgService.message.count({ where }),
      this.getUnreadCount(userId),
    ])

    console.log('TCL: list -> 获取消息列表成功')
    return {
      list: list as MessageListItem[],
      total,
      unread,
      pageIndex,
      pageSize,
      message: '获取消息列表成功',
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const key = `${MESSAGE_UNREAD_PREFIX}${userId}`
    try {
      const cached = await this.redis.get(key)
      if (cached != null && Number.isFinite(Number(cached))) {
        return Math.max(0, Number(cached))
      }
    } catch {
      // fallback DB
    }
    const count = await this.pgService.message.count({
      where: { receiverId: userId, readAt: null },
    })
    await this.setUnread(userId, count)
    return count
  }

  /** 缓存未命中时以 DB 为准（新消息已落库），避免 incr 从 0 起算导致少计 */
  async syncUnreadFromDb(userIds: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(userIds)]
    const result = new Map<string, number>()
    if (!unique.length) return result

    const grouped = await this.pgService.message.groupBy({
      by: ['receiverId'],
      where: { receiverId: { in: unique }, readAt: null },
      _count: { _all: true },
    })
    const countMap = new Map(grouped.map(item => [item.receiverId, item._count._all]))
    for (const userId of unique) {
      const count = countMap.get(userId) ?? 0
      result.set(userId, count)
      await this.setUnread(userId, count)
    }
    return result
  }

  async setUnread(userId: string, count: number): Promise<void> {
    const key = `${MESSAGE_UNREAD_PREFIX}${userId}`
    try {
      await this.redis.set(key, String(Math.max(0, count)), 'EX', 3600)
    } catch {
      // ignore
    }
  }

  async markRead(userId: string, ids: string[]) {
    if (!ids.length) throw new BadRequestException('请选择消息')
    const result = await this.pgService.message.updateMany({
      where: { id: { in: ids }, receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    })
    if (result.count > 0) {
      const unread = await this.pgService.message.count({
        where: { receiverId: userId, readAt: null },
      })
      await this.setUnread(userId, unread)
    }
    return { message: '已标记已读', count: result.count, unread: await this.getUnreadCount(userId) }
  }

  async markAllRead(userId: string) {
    const result = await this.pgService.message.updateMany({
      where: { receiverId: userId, readAt: null },
      data: { readAt: new Date() },
    })
    await this.setUnread(userId, 0)
    return { message: '已全部标记已读', count: result.count, unread: 0 }
  }

  async remove(userId: string, ids: string[]) {
    if (!ids.length) throw new BadRequestException('请选择消息')
    const result = await this.pgService.message.deleteMany({
      where: { id: { in: ids }, receiverId: userId },
    })
    const unread = await this.pgService.message.count({
      where: { receiverId: userId, readAt: null },
    })
    await this.setUnread(userId, unread)
    return { message: '删除成功', count: result.count, unread }
  }

  /** 发送站内信时搜索接收人（不依赖 user:view） */
  async searchReceivers(keyword?: string, excludeUserId?: string) {
    const q = keyword?.trim()
    const list = await this.pgService.user.findMany({
      where: {
        enabled: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        ...(q
          ? {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { nickname: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      select: { id: true, username: true, nickname: true, phone: true },
      orderBy: { username: 'asc' },
    })
    return { list, message: 'ok' }
  }

  async resolveReceivers(job: MessageDispatchJob): Promise<string[]> {
    if (job.type === MessageType.MAIL) {
      return [...new Set(job.receiverIds ?? [])]
    }
    if (job.type === MessageType.ALERT) {
      const admins = await this.pgService.user.findMany({
        where: {
          enabled: true,
          roles: { some: { role: { code: 'super_admin', enabled: true } } },
        },
        select: { id: true },
      })
      return admins.map(item => item.id)
    }
    const users = await this.pgService.user.findMany({
      where: { enabled: true },
      select: { id: true },
    })
    return users.map(item => item.id)
  }

  /** 所有入队路径的唯一出口，在此统一清洗，保证落库内容不含 XSS 载荷 */
  private async addJob(payload: Omit<MessageDispatchJob, 'dispatchId'>) {
    // 标题始终以纯文本渲染，只做裁剪；内容会被 v-html 渲染，必须过滤
    const title = payload.title.trim()
    const content = sanitizeRichText(payload.content)
    if (!title || isRichTextEmpty(content)) {
      throw new BadRequestException('消息标题和内容不能为空')
    }

    const dispatchId = randomUUID()
    const job = { ...payload, title, content, dispatchId } satisfies MessageDispatchJob
    await this.queue.add(MESSAGE_JOB, job, {
      jobId: dispatchId,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    })
  }
}

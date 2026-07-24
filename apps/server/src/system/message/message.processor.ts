import { MessageType, NoticeLevel, Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import type Redis from 'ioredis'
import { MESSAGE_PUSH_CHANNEL, MESSAGE_QUEUE } from './message.constants'
import { MessageService } from './message.service'
import type { MessageDispatchJob, MessagePushItem, MessagePushPayload } from './message.types'

@Processor(MESSAGE_QUEUE)
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name)
  private readonly redis: Redis

  constructor(
    private readonly pgService: PgService,
    private readonly messageService: MessageService,
    redisService: RedisService,
  ) {
    super()
    this.redis = redisService.getOrThrow('default')
  }

  async process(job: Job<MessageDispatchJob>): Promise<{ count: number }> {
    const data = job.data
    if (!data.dispatchId) {
      this.logger.error(`消息任务缺少 dispatchId job=${job.id}`)
      return { count: 0 }
    }

    const receiverIds = await this.messageService.resolveReceivers(data)
    if (!receiverIds.length) {
      this.logger.warn(`消息任务无接收人 type=${data.type} title=${data.title}`)
      return { count: 0 }
    }

    const level = data.level ?? (data.type === MessageType.ALERT ? NoticeLevel.WARNING : NoticeLevel.INFO)
    const now = new Date()
    const rows: Prisma.MessageCreateManyInput[] = receiverIds.map(receiverId => ({
      dispatchId: data.dispatchId,
      type: data.type,
      title: data.title.slice(0, 200),
      content: data.content,
      level,
      senderId: data.senderId ?? null,
      receiverId,
      meta: data.meta == null ? Prisma.DbNull : (data.meta as Prisma.InputJsonValue),
      createdAt: now,
    }))

    const batchSize = 200
    const created: Array<{
      id: string
      type: MessageType
      title: string
      content: string
      level: NoticeLevel
      senderId: string | null
      receiverId: string
      createdAt: Date
      sender: { id: string; username: string } | null
    }> = []

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize)
      const inserted = await this.pgService.message.createManyAndReturn({
        data: chunk,
        skipDuplicates: true,
        include: { sender: { select: { id: true, username: true } } },
      })
      created.push(...inserted)
    }

    // 未读以 DB 为准，避免重试/缓存过期导致计数漂移
    const unreadMap = await this.messageService.syncUnreadFromDb(receiverIds)

    const byUser = new Map<string, typeof created>()
    for (const item of created) {
      const list = byUser.get(item.receiverId) ?? []
      list.push(item)
      byUser.set(item.receiverId, list)
    }

    for (const [userId, items] of byUser) {
      const payload: MessagePushPayload = {
        userId,
        unread: unreadMap.get(userId) ?? items.length,
        items: items.map((m): MessagePushItem => ({
          id: m.id,
          type: m.type,
          title: m.title,
          content: m.content.slice(0, 200),
          level: m.level,
          createdAt: m.createdAt.toISOString(),
          senderId: m.senderId,
          senderName: m.sender?.username ?? null,
        })),
      }
      try {
        await this.redis.publish(MESSAGE_PUSH_CHANNEL, JSON.stringify(payload))
      } catch (error) {
        this.logger.warn(`消息推送发布失败 user=${userId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { count: created.length }
  }
}

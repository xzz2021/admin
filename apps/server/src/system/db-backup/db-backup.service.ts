import { BackupStatus, BackupTrigger, Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { FileCleanupService } from '@/system/file-cleanup/file-cleanup.service'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { InjectQueue } from '@nestjs/bullmq'
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Job, Queue } from 'bullmq'
import type Redis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'

import { MessageService } from '../message/message.service'
import {
  DB_BACKUP_CONFIG_ID,
  DB_BACKUP_DEFAULT_CRON,
  DB_BACKUP_DEFAULT_GZIP,
  DB_BACKUP_DEFAULT_PREFIX,
  DB_BACKUP_DEFAULT_RETENTION_MAX,
  DB_BACKUP_DEFAULT_TIMEZONE,
  DB_BACKUP_JOB_RUN,
  DB_BACKUP_JOB_SCHEDULED,
  DB_BACKUP_LEGACY_SCHEDULER_IDS,
  DB_BACKUP_LOCK_KEY,
  DB_BACKUP_LOCK_TTL_MS,
  DB_BACKUP_MANUAL_JOB_ID,
  DB_BACKUP_MAX_PAGE_SIZE,
  DB_BACKUP_QUEUE,
  DB_BACKUP_SCHEDULED_SCHEDULER_ID,
} from './db-backup.constants'
import type {
  BackupConfigPayload,
  BackupExecutionResult,
  BackupJobListItem,
  BackupJobQuery,
  BackupRuntimeConfig,
  DbBackupQueueJob,
} from './db-backup.types'
import { PgDumpRunner } from './pg-dump.runner'

@Injectable()
export class DbBackupService implements OnModuleInit {
  private readonly logger = new Logger(DbBackupService.name)
  private readonly redis: Redis

  constructor(
    private readonly pgService: PgService,
    private readonly configService: ConfigService,
    private readonly pgDumpRunner: PgDumpRunner,
    redisService: RedisService,
    @InjectQueue(DB_BACKUP_QUEUE) private readonly queue: Queue,
    private readonly fileCleanupService: FileCleanupService,
    @Optional() private readonly messageService?: MessageService,
  ) {
    this.redis = redisService.getOrThrow('default')
  }

  async onModuleInit(): Promise<void> {
    await this.failOrphanRunningJobs()
    await this.reconcile()
    await this.syncSchedule()
  }

  async getConfigPayload(): Promise<BackupConfigPayload> {
    const [config, nextRunAt] = await Promise.all([this.getOrCreateConfig(), this.getNextRunAt()])
    return {
      ...config,
      nextRunAt,
    }
  }

  async updateConfig(input: {
    enabled: boolean
    cron: string
    timezone: string
    retentionMax: number
    filePrefix: string
    gzip: boolean
  }) {
    const config = await this.pgService.dbBackupConfig.upsert({
      where: { id: DB_BACKUP_CONFIG_ID },
      create: {
        id: DB_BACKUP_CONFIG_ID,
        ...input,
      },
      update: input,
    })
    await this.syncSchedule()
    return {
      ...config,
      nextRunAt: await this.getNextRunAt(),
      message: '备份配置已更新',
    }
  }

  async getRuntimeConfig(): Promise<BackupRuntimeConfig> {
    const config = await this.getOrCreateConfig()
    return {
      dir: resolve(this.getBackupDir()),
      enabled: config.enabled,
      cron: config.cron,
      timezone: config.timezone,
      retentionMax: config.retentionMax,
      filePrefix: config.filePrefix,
      gzip: config.gzip,
    }
  }

  async listJobs(query: BackupJobQuery) {
    const pageIndex = Math.max(1, query.pageIndex ?? 1)
    const pageSize = Math.min(DB_BACKUP_MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? 10))
    const where: Prisma.DbBackupJobWhereInput = {}
    if (query.status) where.status = query.status
    if (query.trigger) where.trigger = query.trigger

    const [total, list] = await Promise.all([
      this.pgService.dbBackupJob.count({ where }),
      this.pgService.dbBackupJob.findMany({
        where,
        skip: (pageIndex - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
    ])

    return {
      total,
      list: list.map(item => this.serializeJob(item)),
      pageIndex,
      pageSize,
      message: '获取备份任务列表成功',
    }
  }

  async getJobFile(id: string) {
    const job = await this.pgService.dbBackupJob.findUnique({ where: { id } })
    if (!job) {
      throw new NotFoundException('备份任务不存在')
    }
    if (job.status !== BackupStatus.SUCCESS && job.status !== BackupStatus.EXPIRED) {
      throw new ConflictException('该备份尚未生成可下载文件')
    }
    await this.assertFileExists(job.filePath)
    if (job.status === BackupStatus.EXPIRED) {
      throw new NotFoundException('备份文件已失效')
    }
    return job
  }

  async deleteJob(id: string) {
    const job = await this.pgService.dbBackupJob.findUnique({ where: { id } })
    if (!job) {
      throw new NotFoundException('备份任务不存在')
    }
    if (job.status === BackupStatus.RUNNING) {
      throw new ConflictException('备份任务执行中，无法删除')
    }
    if (job.status !== BackupStatus.EXPIRED) {
      await this.pgService.dbBackupJob.update({
        where: { id },
        data: { status: BackupStatus.EXPIRED },
      })
    }
    await this.fileCleanupService.enqueue([
      { kind: 'backup-job', backupJobId: job.id, path: job.filePath },
    ])
    return { message: '备份任务已删除' }
  }

  async cleanup() {
    const config = await this.getRuntimeConfig()
    const removed = await this.applyRetention(config.retentionMax)
    return { count: removed, message: `已清理 ${removed} 个历史备份` }
  }

  async reconcile(): Promise<number> {
    const jobs = await this.pgService.dbBackupJob.findMany({
      where: {
        status: BackupStatus.SUCCESS,
      },
      select: {
        id: true,
        filePath: true,
      },
    })

    const expiredIds: string[] = []
    for (const job of jobs) {
      try {
        await fs.access(job.filePath)
      } catch {
        expiredIds.push(job.id)
      }
    }

    if (!expiredIds.length) return 0
    await this.pgService.dbBackupJob.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: BackupStatus.EXPIRED },
    })
    return expiredIds.length
  }

  /** 手动备份：固定 jobId 幂等入队，队列中已有则拒绝 */
  async enqueueBackup(trigger: BackupTrigger, userId?: string | null) {
    await this.assertNoActiveJob()
    await this.assertManualJobIdle()

    const job = await this.createRunningJob(trigger, userId)
    const payload: DbBackupQueueJob = { dbJobId: job.id, trigger }

    let queued: Job<DbBackupQueueJob>
    try {
      queued = await this.queue.add(DB_BACKUP_JOB_RUN, payload, {
        jobId: DB_BACKUP_MANUAL_JOB_ID,
        attempts: 1,
        // 完成后立刻释放幂等 jobId，避免挡住下一次手动备份
        removeOnComplete: true,
        removeOnFail: true,
      })
    } catch (error) {
      await this.finishFailure(job.id, job.startedAt, getErrorMessage(error))
      throw new ConflictException(`备份任务入队失败: ${getErrorMessage(error)}`)
    }

    // jobId 已存在时 BullMQ 不报错而是返回旧任务，此时新记录不会被消费，需回滚为失败
    if (queued.data?.dbJobId !== job.id) {
      await this.finishFailure(job.id, job.startedAt, '已有手动备份任务在队列中')
      throw new ConflictException('已有手动备份任务在队列中，请稍后再试')
    }

    return { id: job.id, message: '备份任务已加入队列' }
  }

  /** 定时任务触发：在 Processor 内创建记录并执行 */
  async executeBackup(trigger: BackupTrigger, userId?: string | null) {
    await this.assertNoActiveJob()
    const job = await this.createRunningJob(trigger, userId)
    await this.performBackup(job.id)
  }

  /** 手动任务消费：按已有记录执行 */
  async executeBackupJob(dbJobId: string) {
    await this.performBackup(dbJobId)
  }

  /**
   * 同步定时备份调度：
   * - 关闭：按稳定 schedulerId 删除
   * - 开启且配置未变：不重设
   * - 开启且配置变化：upsertJobScheduler 幂等更新
   */
  async syncSchedule(): Promise<void> {
    await this.removeLegacyRepeatableJobs()

    const config = await this.getRuntimeConfig()
    if (!config.enabled) {
      await this.queue.removeJobScheduler(DB_BACKUP_SCHEDULED_SCHEDULER_ID)
      return
    }

    const existing = await this.queue.getJobScheduler(DB_BACKUP_SCHEDULED_SCHEDULER_ID)
    if (
      existing &&
      existing.pattern === config.cron &&
      (existing.tz || undefined) === (config.timezone || undefined)
    ) {
      return
    }

    await this.queue.upsertJobScheduler(
      DB_BACKUP_SCHEDULED_SCHEDULER_ID,
      {
        pattern: config.cron,
        tz: config.timezone,
      },
      {
        name: DB_BACKUP_JOB_SCHEDULED,
        data: { trigger: BackupTrigger.SCHEDULED },
        opts: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      },
    )
  }

  async getNextRunAt(): Promise<string | null> {
    const scheduler = await this.queue.getJobScheduler(DB_BACKUP_SCHEDULED_SCHEDULER_ID)
    if (!scheduler?.next) return null
    return new Date(scheduler.next).toISOString()
  }

  private async performBackup(dbJobId: string) {
    const job = await this.pgService.dbBackupJob.findUnique({ where: { id: dbJobId } })
    if (!job) {
      throw new NotFoundException('备份任务不存在')
    }
    if (job.status !== BackupStatus.RUNNING) {
      this.logger.warn(`跳过非 RUNNING 状态的备份任务 id=${dbJobId} status=${job.status}`)
      return
    }

    const token = randomUUID()
    await this.acquireLock(token)
    const runtimeConfig = await this.getRuntimeConfig()
    const startedAt = new Date()

    try {
      await this.pgService.dbBackupJob.update({
        where: { id: dbJobId },
        data: { startedAt },
      })
      const result = await this.pgDumpRunner.run(runtimeConfig, this.getDatabaseUrl())
      const durationMs = result.finishedAt.getTime() - result.startedAt.getTime()
      await this.finishSuccess(dbJobId, result, durationMs)
      await this.applyRetention(runtimeConfig.retentionMax)
    } catch (error) {
      const message = getErrorMessage(error)
      await this.finishFailure(dbJobId, startedAt, message)
      await this.sendFailureAlert(message)
      throw error
    } finally {
      await this.releaseLock(token)
    }
  }

  private async createRunningJob(trigger: BackupTrigger, userId?: string | null) {
    const runtimeConfig = await this.getRuntimeConfig()
    const startedAt = new Date()
    return this.pgService.dbBackupJob.create({
      data: {
        trigger,
        status: BackupStatus.RUNNING,
        fileName: 'pending',
        filePath: resolve(runtimeConfig.dir, 'pending'),
        createdById: userId ?? null,
        startedAt,
      },
    })
  }

  private async assertNoActiveJob() {
    const active = await this.pgService.dbBackupJob.findFirst({
      where: { status: BackupStatus.RUNNING },
      select: { id: true },
    })
    if (active) {
      throw new ConflictException('已有备份任务正在执行，请稍后再试')
    }
  }

  /** 手动备份幂等：队列中仍存在同 jobId 时拒绝重复入队 */
  private async assertManualJobIdle() {
    const existing = await this.queue.getJob(DB_BACKUP_MANUAL_JOB_ID)
    if (!existing) return

    const state = await existing.getState()
    if (state === 'completed' || state === 'failed') {
      await existing.remove()
      return
    }

    throw new ConflictException('已有手动备份任务在队列中，请稍后再试')
  }

  /** 清理历史调度 ID 与旧版 remove+re-add 产生的 repeatable key，避免与当前 Job Scheduler 双触发 */
  private async removeLegacyRepeatableJobs() {
    try {
      for (const legacyId of DB_BACKUP_LEGACY_SCHEDULER_IDS) {
        if (legacyId === DB_BACKUP_SCHEDULED_SCHEDULER_ID) continue
        await this.queue.removeJobScheduler(legacyId)
      }

      const legacyJobs = await this.queue.getRepeatableJobs()
      for (const job of legacyJobs) {
        if (job.name !== DB_BACKUP_JOB_SCHEDULED) continue
        if (job.key === DB_BACKUP_SCHEDULED_SCHEDULER_ID) continue
        await this.queue.removeRepeatableByKey(job.key)
      }
    } catch (error) {
      this.logger.warn(`清理旧版定时备份任务失败: ${getErrorMessage(error)}`)
    }
  }

  private async failOrphanRunningJobs() {
    const finishedAt = new Date()
    const result = await this.pgService.dbBackupJob.updateMany({
      where: { status: BackupStatus.RUNNING },
      data: {
        status: BackupStatus.FAILED,
        finishedAt,
        errorMessage: '服务重启，备份中断',
      },
    })
    if (result.count > 0) {
      this.logger.warn(`已将 ${result.count} 个中断的备份任务标记为失败`)
    }
  }

  private async finishSuccess(jobId: string, result: BackupExecutionResult, durationMs: number) {
    await this.pgService.$transaction([
      this.pgService.dbBackupJob.update({
        where: { id: jobId },
        data: {
          status: BackupStatus.SUCCESS,
          fileName: result.fileName,
          filePath: result.filePath,
          fileSize: result.fileSize,
          checksum: result.checksum,
          startedAt: result.startedAt,
          finishedAt: result.finishedAt,
          durationMs,
          errorMessage: null,
        },
      }),
      this.pgService.dbBackupConfig.update({
        where: { id: DB_BACKUP_CONFIG_ID },
        data: {
          lastRunAt: result.finishedAt,
          lastStatus: BackupStatus.SUCCESS,
          lastError: null,
        },
      }),
    ])
  }

  private async finishFailure(jobId: string, startedAt: Date, message: string) {
    const finishedAt = new Date()
    await this.pgService.$transaction([
      this.pgService.dbBackupJob.update({
        where: { id: jobId },
        data: {
          status: BackupStatus.FAILED,
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorMessage: message,
        },
      }),
      this.pgService.dbBackupConfig.update({
        where: { id: DB_BACKUP_CONFIG_ID },
        data: {
          lastRunAt: finishedAt,
          lastStatus: BackupStatus.FAILED,
          lastError: message.slice(0, 1000),
        },
      }),
    ])
  }

  private async sendFailureAlert(message: string) {
    if (!this.messageService) return
    try {
      await this.messageService.enqueueAlertDebounced(
        'db-backup-failed',
        {
          title: '数据库备份失败',
          content: message,
          meta: { source: 'db-backup' },
        },
        600,
      )
    } catch (error) {
      this.logger.warn(`发送备份失败告警失败: ${getErrorMessage(error)}`)
    }
  }

  private async applyRetention(retentionMax: number): Promise<number> {
    const successJobs = await this.pgService.dbBackupJob.findMany({
      where: { status: BackupStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
    })
    const removable = successJobs.slice(Math.max(retentionMax, 0))
    if (!removable.length) return 0
    await this.pgService.dbBackupJob.updateMany({
      where: { id: { in: removable.map(item => item.id) } },
      data: { status: BackupStatus.EXPIRED },
    })
    await this.fileCleanupService.enqueue(
      removable.map(job => ({
        kind: 'backup-job' as const,
        backupJobId: job.id,
        path: job.filePath,
      })),
    )
    return removable.length
  }

  private async getOrCreateConfig() {
    return this.pgService.dbBackupConfig.upsert({
      where: { id: DB_BACKUP_CONFIG_ID },
      create: {
        id: DB_BACKUP_CONFIG_ID,
        enabled: true,
        cron: this.configService.get<string>('dbBackup.cron') || DB_BACKUP_DEFAULT_CRON,
        timezone: this.configService.get<string>('dbBackup.timezone') || DB_BACKUP_DEFAULT_TIMEZONE,
        retentionMax:
          this.configService.get<number>('dbBackup.retentionMax') ||
          DB_BACKUP_DEFAULT_RETENTION_MAX,
        filePrefix:
          this.configService.get<string>('dbBackup.filePrefix') || DB_BACKUP_DEFAULT_PREFIX,
        gzip: this.configService.get<boolean>('dbBackup.gzip') ?? DB_BACKUP_DEFAULT_GZIP,
      },
      update: {},
    })
  }

  private getBackupDir(): string {
    return (
      this.configService.get<string>('dbBackup.dir') ||
      this.configService.get<string>('DB_BACKUP_DIR') ||
      resolve(process.cwd(), 'backups')
    )
  }

  private getDatabaseUrl(): string {
    return (
      this.configService.get<string>('pgDatabaseUrl') ||
      this.configService.get<string>('PG_DATABASE_URL') ||
      ''
    )
  }

  private async acquireLock(token: string) {
    const ok = await this.redis.set(DB_BACKUP_LOCK_KEY, token, 'PX', DB_BACKUP_LOCK_TTL_MS, 'NX')
    if (ok !== 'OK') {
      throw new ConflictException('已有备份任务正在执行，请稍后再试')
    }
  }

  private async releaseLock(token: string) {
    try {
      await this.redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        DB_BACKUP_LOCK_KEY,
        token,
      )
    } catch (error) {
      this.logger.warn(`释放备份锁失败: ${getErrorMessage(error)}`)
    }
  }

  private async assertFileExists(path: string) {
    try {
      await fs.access(path)
    } catch {
      await this.pgService.dbBackupJob.updateMany({
        where: { filePath: path, status: BackupStatus.SUCCESS },
        data: { status: BackupStatus.EXPIRED },
      })
      throw new NotFoundException('备份文件不存在或已失效')
    }
  }

  private serializeJob(item: BackupJobListItem) {
    return {
      ...item,
      fileSize: item.fileSize == null ? null : item.fileSize.toString(),
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

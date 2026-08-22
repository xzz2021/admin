import { BackupStatus } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { getStaticFileRoot, tryResolvePathInsideRoot } from '@/system/staticfile/multer.config'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { FILE_CLEANUP_QUEUE, FILE_CLEANUP_UNLINK } from './file-cleanup.constants'
import type { FileCleanupJob } from './file-cleanup.types'

@Injectable()
export class FileCleanupService implements OnModuleInit {
  private readonly logger = new Logger(FileCleanupService.name)

  constructor(
    private readonly pgService: PgService,
    private readonly configService: ConfigService,
    @InjectQueue(FILE_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.reconcile()
    } catch (error) {
      this.logger.warn(
        `文件清理对账失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async enqueue(jobs: FileCleanupJob[]) {
    if (jobs.length === 0) return
    await Promise.all(
      jobs.map(data =>
        this.queue.add(FILE_CLEANUP_UNLINK, data, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        }),
      ),
    )
  }

  async process(job: FileCleanupJob) {
    const safePath = this.resolveSafePath(job.path)
    if (safePath) {
      await unlinkIgnoringMissing(safePath)
    } else {
      this.logger.warn(`跳过无法解析或不在允许目录内的路径 path=${job.path}`)
    }
    await this.finalize(job)
  }

  async reconcile() {
    const [files, backups] = await Promise.all([
      this.pgService.file.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, path: true },
      }),
      this.pgService.dbBackupJob.findMany({
        where: { status: BackupStatus.EXPIRED },
        select: { id: true, filePath: true },
      }),
    ])
    await this.enqueue([
      ...files.map((file): FileCleanupJob => ({
        kind: 'managed-file',
        fileId: file.id,
        path: file.path,
      })),
      ...backups.map((item): FileCleanupJob => ({
        kind: 'backup-job',
        backupJobId: item.id,
        path: item.filePath,
      })),
    ])
  }

  private async finalize(job: FileCleanupJob) {
    if (job.kind === 'managed-file') {
      await this.pgService.file.deleteMany({
        where: { id: job.fileId, deletedAt: { not: null } },
      })
      return
    }
    if (job.kind === 'backup-job') {
      await this.pgService.dbBackupJob.deleteMany({
        where: { id: job.backupJobId, status: BackupStatus.EXPIRED },
      })
    }
  }

  private resolveSafePath(target: string): string | null {
    const roots: string[] = []
    try {
      roots.push(getStaticFileRoot())
    } catch {
      // 静态目录未配置时仍允许清理备份目录
    }
    const backupDir =
      this.configService.get<string>('dbBackup.dir') ||
      this.configService.get<string>('DB_BACKUP_DIR')
    if (backupDir) {
      roots.push(backupDir)
      roots.push(resolve(backupDir))
    }
    for (const root of roots) {
      const safePath = tryResolvePathInsideRoot(root, target)
      if (safePath) return safePath
    }
    return null
  }
}

async function unlinkIgnoringMissing(path: string) {
  try {
    await fs.unlink(path)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return
    throw error
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

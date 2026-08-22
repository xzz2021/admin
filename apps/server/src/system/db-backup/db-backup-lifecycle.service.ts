import { BackupStatus } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { FileCleanupService } from '@/system/file-cleanup/file-cleanup.service'
import { Injectable, NotFoundException } from '@nestjs/common'
import { promises as fs } from 'node:fs'

@Injectable()
export class DbBackupLifecycleService {
  constructor(
    private readonly pgService: PgService,
    private readonly fileCleanupService: FileCleanupService,
  ) {}

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

  async applyRetention(retentionMax: number): Promise<number> {
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

  async expireAndEnqueue(job: {
    id: string
    filePath: string
    status: BackupStatus
  }): Promise<void> {
    if (job.status !== BackupStatus.EXPIRED) {
      await this.pgService.dbBackupJob.update({
        where: { id: job.id },
        data: { status: BackupStatus.EXPIRED },
      })
    }
    await this.enqueueCleanup(job)
  }

  async enqueueCleanup(job: { id: string; filePath: string }): Promise<void> {
    await this.fileCleanupService.enqueue([
      { kind: 'backup-job', backupJobId: job.id, path: job.filePath },
    ])
  }

  async assertFileExists(path: string): Promise<void> {
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
}

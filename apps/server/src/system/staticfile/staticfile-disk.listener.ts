import { DiskCleanupEventBus } from '@/system/file-cleanup/disk-cleanup.events'
import type { FileCleanupJob } from '@/system/file-cleanup/file-cleanup.types'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { StaticfileService } from './staticfile.service'

@Injectable()
export class StaticfileDiskListener implements OnModuleInit {
  constructor(
    private readonly events: DiskCleanupEventBus,
    private readonly staticfiles: StaticfileService,
  ) {}

  onModuleInit(): void {
    this.events.onUnlinked(job => this.onUnlinked(job))
  }

  private async onUnlinked(job: FileCleanupJob): Promise<void> {
    if (job.kind !== 'managed-file') return
    await this.staticfiles.purgeAfterUnlink(job.fileId)
  }
}

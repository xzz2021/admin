import { FileCleanupModule } from '@/system/file-cleanup/file-cleanup.module'
import { MessageModule } from '@/system/message/message.module'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'

import { DbBackupConfigService } from './db-backup-config.service'
import { DbBackupLifecycleService } from './db-backup-lifecycle.service'
import { BackupDiskListener } from './backup-disk.listener'
import { DB_BACKUP_QUEUE } from './db-backup.constants'
import { DbBackupController } from './db-backup.controller'
import { DbBackupProcessor } from './db-backup.processor'
import { DbBackupRepository } from './db-backup.repository'
import { DbBackupService } from './db-backup.service'
import { PgDumpRunner } from './pg-dump.runner'

@Module({
  imports: [MessageModule, FileCleanupModule, BullModule.registerQueue({ name: DB_BACKUP_QUEUE })],
  controllers: [DbBackupController],
  providers: [
    DbBackupService,
    DbBackupRepository,
    DbBackupProcessor,
    PgDumpRunner,
    DbBackupConfigService,
    DbBackupLifecycleService,
    BackupDiskListener,
  ],
  exports: [DbBackupService],
})
export class DbBackupModule {}

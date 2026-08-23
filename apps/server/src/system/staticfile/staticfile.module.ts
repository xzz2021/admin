import { FileCleanupModule } from '@/system/file-cleanup/file-cleanup.module'
import { Module } from '@nestjs/common'
import { FileRepository } from './file.repository'
import { StaticfileDiskListener } from './staticfile-disk.listener'
import { StaticfileController } from './staticfile.controller'
import { StaticfileService } from './staticfile.service'

@Module({
  imports: [FileCleanupModule],
  controllers: [StaticfileController],
  providers: [FileRepository, StaticfileService, StaticfileDiskListener],
  exports: [StaticfileService],
})
export class StaticfileModule {}

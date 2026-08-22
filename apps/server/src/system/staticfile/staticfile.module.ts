import { FileCleanupModule } from '@/system/file-cleanup/file-cleanup.module'
import { Module } from '@nestjs/common'
import { StaticfileController } from './staticfile.controller'
import { StaticfileService } from './staticfile.service'

@Module({
  imports: [FileCleanupModule],
  controllers: [StaticfileController],
  providers: [StaticfileService],
  exports: [StaticfileService],
})
export class StaticfileModule {}

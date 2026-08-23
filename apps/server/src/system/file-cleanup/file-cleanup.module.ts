import { buildRedisOptions, type AppRedisConfig } from '@/core/cache/redis-options'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DiskCleanupEventBus } from './disk-cleanup.events'
import { FILE_CLEANUP_QUEUE } from './file-cleanup.constants'
import { FileCleanupProcessor } from './file-cleanup.processor'
import { FileCleanupService } from './file-cleanup.service'

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get<AppRedisConfig>('redis')
        return {
          connection: buildRedisOptions(redis, {
            maxRetriesPerRequest: null,
          }),
        }
      },
    }),
    BullModule.registerQueue({ name: FILE_CLEANUP_QUEUE }),
  ],
  providers: [DiskCleanupEventBus, FileCleanupService, FileCleanupProcessor],
  exports: [FileCleanupService, DiskCleanupEventBus],
})
export class FileCleanupModule {}

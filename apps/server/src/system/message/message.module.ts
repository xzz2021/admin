import { AuthModule } from '@/system/auth/auth.module'
import { buildRedisOptions, type AppRedisConfig } from '@/core/cache/redis-options'
import { BullModule } from '@nestjs/bullmq'
import { Module, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { MESSAGE_QUEUE } from './message.constants'
import { MessageAdminController } from './message-admin.controller'
import { MessageGateway } from './message.gateway'
import { MessageInboxController } from './message-inbox.controller'
import { MessageProcessor } from './message.processor'
import { MessageService } from './message.service'

@Module({
  imports: [
    forwardRef(() => AuthModule),
    JwtModule.register({}),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get<AppRedisConfig>('redis')
        return {
          connection: buildRedisOptions(redis, {
            // BullMQ 要求
            maxRetriesPerRequest: null,
          }),
        }
      },
    }),
    BullModule.registerQueue({ name: MESSAGE_QUEUE }),
  ],
  controllers: [MessageInboxController, MessageAdminController],
  providers: [MessageService, MessageProcessor, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}

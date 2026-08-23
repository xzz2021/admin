import { buildRedisOptions, type AppRedisConfig } from '@/core/cache/redis-options'
import { SessionModule } from '@/system/session/session.module'
import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { MessageInboxController } from './message-inbox.controller'
import { MessageDeliveryService } from './message-delivery.service'
import { MESSAGE_QUEUE } from './message.constants'
import { MessageGateway } from './message.gateway'
import { MessageProcessor } from './message.processor'
import { MessageRepository } from './message.repository'
import { MessageService } from './message.service'
import { NotificationController } from './notification.controller'

@Module({
  imports: [
    SessionModule,
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
  controllers: [MessageInboxController, NotificationController],
  providers: [
    MessageRepository,
    MessageDeliveryService,
    MessageService,
    MessageProcessor,
    MessageGateway,
  ],
  exports: [MessageDeliveryService],
})
export class MessageModule {}

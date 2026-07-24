import { AuthModule } from '@/system/auth/auth.module'
import { BullModule } from '@nestjs/bullmq'
import { Module, forwardRef } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { MESSAGE_QUEUE } from './message.constants'
import { MessageController } from './message.controller'
import { MessageGateway } from './message.gateway'
import { MessageProcessor } from './message.processor'
import { MessageService } from './message.service'

@Module({
  imports: [
    forwardRef(() => AuthModule),
    JwtModule.register({}),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redis = configService.get<{ host?: string; port?: number; password?: string; db?: number }>('redis') ?? {}
        return {
          connection: {
            host: redis.host || '127.0.0.1',
            port: redis.port || 6379,
            password: redis.password || undefined,
            db: redis.db ?? 0,
            // BullMQ 要求
            maxRetriesPerRequest: null,
          },
        }
      },
    }),
    BullModule.registerQueue({ name: MESSAGE_QUEUE }),
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageProcessor, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}

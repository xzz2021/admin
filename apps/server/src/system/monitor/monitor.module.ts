import { MessageModule } from '@/system/message/message.module'
import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { MonitorErrorBuffer } from './monitor-error.buffer'
import { MonitorLatencyInterceptor } from './monitor-latency.interceptor'
import { MonitorLatencyTracker } from './monitor-latency.tracker'
import { MonitorController } from './monitor.controller'
import { MonitorGateway } from './monitor.gateway'
import { MonitorService } from './monitor.service'

@Module({
  imports: [ScheduleModule.forRoot(), JwtModule.register({}), MessageModule],
  controllers: [MonitorController],
  providers: [
    MonitorService,
    MonitorGateway,
    MonitorLatencyTracker,
    MonitorErrorBuffer,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitorLatencyInterceptor,
    },
  ],
  exports: [MonitorService, MonitorErrorBuffer],
})
export class MonitorModule {}

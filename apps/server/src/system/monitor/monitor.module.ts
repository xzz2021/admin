import { APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitorController } from './monitor.controller';
import { MonitorErrorBuffer } from './monitor-error.buffer';
import { MonitorGateway } from './monitor.gateway';
import { MonitorLatencyInterceptor } from './monitor-latency.interceptor';
import { MonitorLatencyTracker } from './monitor-latency.tracker';
import { MonitorService } from './monitor.service';

@Module({
  imports: [ScheduleModule.forRoot(), JwtModule.register({})],
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

import { SessionModule } from '@/system/session/session.module'
import { Module } from '@nestjs/common'
import { OnlineController } from './online.controller'
import { OnlineGateway } from './online.gateway'
import { OnlineSessionListener } from './online.session.listener'
import { OnlineService } from './online.service'

@Module({
  imports: [SessionModule],
  controllers: [OnlineController],
  providers: [OnlineService, OnlineGateway, OnlineSessionListener],
  exports: [OnlineService, OnlineGateway],
})
export class OnlineModule {}

import { AuthModule } from '@/system/auth/auth.module'
import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { OnlineController } from './online.controller'
import { OnlineGateway } from './online.gateway'
import { OnlineService } from './online.service'

@Module({
  imports: [forwardRef(() => AuthModule), JwtModule.register({})],
  controllers: [OnlineController],
  providers: [OnlineService, OnlineGateway],
  exports: [OnlineService, OnlineGateway],
})
export class OnlineModule {}

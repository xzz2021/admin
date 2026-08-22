import { SessionRevocationService } from '@/system/auth/session-revocation.service'
import { RtTokenService } from '@/system/auth/rt.token.service'
import { TokenService } from '@/system/auth/token.service'
import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SessionEventBus } from './session.events'

@Module({
  imports: [JwtModule.register({})],
  providers: [SessionEventBus, TokenService, RtTokenService, SessionRevocationService],
  exports: [JwtModule, SessionEventBus, TokenService, RtTokenService, SessionRevocationService],
})
export class SessionModule {}

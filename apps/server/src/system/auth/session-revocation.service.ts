import { OnlineGateway } from '@/system/online/online.gateway'
import { OnlineService } from '@/system/online/online.service'
import { forwardRef, Inject, Injectable, Optional } from '@nestjs/common'

import { RtTokenService } from './rt.token.service'
import { TokenService } from './token.service'

@Injectable()
export class SessionRevocationService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
    @Optional()
    @Inject(forwardRef(() => OnlineService))
    private readonly onlineService?: OnlineService,
    @Optional()
    @Inject(forwardRef(() => OnlineGateway))
    private readonly onlineGateway?: OnlineGateway,
  ) {}

  /** 改密 / 禁用 / 删除：吊销全部会话并通知在线端 */
  async revokeAll(userId: string, reason: 'revoked' | 'forced' = 'revoked'): Promise<void> {
    if (this.onlineService) {
      const jtis = await this.onlineService.terminateUser(userId)
      this.onlineGateway?.notifyForceLogout(jtis, reason)
      this.onlineGateway?.notifyForceLogoutByUser(userId, reason)
      return
    }
    await Promise.all([this.tokenService.revokeAll(userId), this.rtTokenService.revokeAll(userId)])
  }
}

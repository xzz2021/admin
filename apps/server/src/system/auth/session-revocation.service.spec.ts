import type { OnlineGateway } from '@/system/online/online.gateway'
import type { OnlineService } from '@/system/online/online.service'
import type { RtTokenService } from './rt.token.service'
import type { TokenService } from './token.service'
import { SessionRevocationService } from './session-revocation.service'

describe('SessionRevocationService', () => {
  const revokeAllAccess = jest.fn()
  const revokeAllRt = jest.fn()
  const terminateUser = jest.fn()
  const notifyForceLogout = jest.fn()
  const notifyForceLogoutByUser = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses presence when online module is available', async () => {
    terminateUser.mockResolvedValue(['jti-1'])
    const service = new SessionRevocationService(
      { revokeAll: revokeAllAccess } as unknown as TokenService,
      { revokeAll: revokeAllRt } as unknown as RtTokenService,
      { terminateUser } as unknown as OnlineService,
      { notifyForceLogout, notifyForceLogoutByUser } as unknown as OnlineGateway,
    )

    await service.revokeAll('user-1')

    expect(terminateUser).toHaveBeenCalledWith('user-1')
    expect(notifyForceLogout).toHaveBeenCalledWith(['jti-1'], 'revoked')
    expect(notifyForceLogoutByUser).toHaveBeenCalledWith('user-1', 'revoked')
    expect(revokeAllAccess).not.toHaveBeenCalled()
  })

  it('falls back to token blacklist when online module is absent', async () => {
    const service = new SessionRevocationService(
      { revokeAll: revokeAllAccess } as unknown as TokenService,
      { revokeAll: revokeAllRt } as unknown as RtTokenService,
    )

    await service.revokeAll('user-1')

    expect(revokeAllAccess).toHaveBeenCalledWith('user-1')
    expect(revokeAllRt).toHaveBeenCalledWith('user-1')
  })
})

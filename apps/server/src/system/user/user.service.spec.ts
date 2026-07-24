import type { PgService } from '@/prisma/pg.service'
import type { RbacPermissionCacheService } from '@/processor/rbac'
import type { RtTokenService } from '@/system/auth/rt.token.service'
import type { TokenService } from '@/system/auth/token.service'
import type { OnlineGateway } from '@/system/online/online.gateway'
import type { OnlineService } from '@/system/online/online.service'
import type { RedisService } from '@liaoliaots/nestjs-redis'
import { UserService } from './user.service'

jest.mock('@/processor/utils', () => ({
  formatDateToYMDHMS: jest.fn(),
  hashPayPassword: jest.fn(() => Promise.resolve('hashed')),
  verifyPayPassword: jest.fn(() => Promise.resolve(true)),
}))

describe('UserService session revocation', () => {
  const userUpdate = jest.fn()
  const userFindUnique = jest.fn()
  const invalidateUsers = jest.fn()
  const revokeAllAccess = jest.fn()
  const revokeAllRt = jest.fn()
  const terminateUser = jest.fn()
  const notifyForceLogout = jest.fn()
  const notifyForceLogoutByUser = jest.fn()

  const createService = () =>
    new UserService(
      {
        user: { update: userUpdate, findUnique: userFindUnique },
        $transaction: jest.fn(),
      } as unknown as PgService,
      { getOrThrow: () => ({}) } as unknown as RedisService,
      { invalidateUsers } as unknown as RbacPermissionCacheService,
      { revokeAll: revokeAllAccess } as unknown as TokenService,
      { revokeAll: revokeAllRt } as unknown as RtTokenService,
      { get: () => 'api/public' } as unknown as import('@nestjs/config').ConfigService,
      { terminateUser } as unknown as OnlineService,
      { notifyForceLogout, notifyForceLogoutByUser } as unknown as OnlineGateway,
    )

  beforeEach(() => {
    jest.clearAllMocks()
    userUpdate.mockResolvedValue({ id: 'user-1' })
    invalidateUsers.mockResolvedValue(undefined)
    revokeAllAccess.mockResolvedValue(undefined)
    revokeAllRt.mockResolvedValue(undefined)
    terminateUser.mockResolvedValue(['jti-1'])
  })

  it('revokes all sessions after password change', async () => {
    userFindUnique.mockResolvedValue({ id: 'user-1', password: 'old-hash' })
    const service = createService()

    await service.updatePassword({ id: 'user-1', password: 'old-pass', newPassword: 'new-pass-1' })

    expect(terminateUser).toHaveBeenCalledWith('user-1')
    expect(notifyForceLogout).toHaveBeenCalledWith(['jti-1'], 'revoked')
    expect(notifyForceLogoutByUser).toHaveBeenCalledWith('user-1', 'revoked')
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordChangedAt: expect.any(Date) }),
      }),
    )
  })

  it('revokes all sessions after admin password reset', async () => {
    const service = createService()

    await service.resetPassword({ id: 'user-1', password: 'NewPass_123!', operateId: 'admin-1' })

    expect(terminateUser).toHaveBeenCalledWith('user-1')
  })

  it('revokes all sessions when user is disabled', async () => {
    const service = createService()

    await service.update({
      id: 'user-1',
      username: 'alice',
      phone: '13800138000',
      department: 'dept-1',
      roles: [],
      enabled: false,
    })

    expect(invalidateUsers).toHaveBeenCalledWith(['user-1'])
    expect(terminateUser).toHaveBeenCalledWith('user-1')
  })

  it('does not revoke sessions when user remains enabled', async () => {
    const service = createService()

    await service.update({
      id: 'user-1',
      username: 'alice',
      phone: '13800138000',
      department: 'dept-1',
      roles: [],
      enabled: true,
    })

    expect(terminateUser).not.toHaveBeenCalled()
  })
})

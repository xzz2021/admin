import type { RtTokenService } from '@/system/auth/rt.token.service'
import type { TokenService } from '@/system/auth/token.service'
import type { ExecutionContext } from '@nestjs/common'
import { UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { RtJwtAuthGuard } from './rt-jwt-auth'

describe('RtJwtAuthGuard', () => {
  const isAccessBlacklisted = jest.fn()
  const isRtBlacklisted = jest.fn()
  const tokenService = { isBlacklisted: isAccessBlacklisted } as unknown as TokenService
  const rtTokenService = { isBlacklisted: isRtBlacklisted } as unknown as RtTokenService

  const createContext = (user?: { jti?: string }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ url: '/user/list', user }),
      }),
      getHandler: () => ({}),
      getClass: () => class {},
    }) as unknown as ExecutionContext

  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true)
  })

  it('rejects access tokens blacklisted by either token service', async () => {
    const guard = new RtJwtAuthGuard(new Reflector(), tokenService, rtTokenService)
    isAccessBlacklisted.mockResolvedValue(false)
    isRtBlacklisted.mockResolvedValue(true)

    await expect(guard.canActivate(createContext({ jti: 'jti-1' }))).rejects.toBeInstanceOf(UnauthorizedException)
    expect(isAccessBlacklisted).toHaveBeenCalledWith('jti-1')
    expect(isRtBlacklisted).toHaveBeenCalledWith('jti-1')
  })

  it('allows non-blacklisted access tokens', async () => {
    const guard = new RtJwtAuthGuard(new Reflector(), tokenService, rtTokenService)
    isAccessBlacklisted.mockResolvedValue(false)
    isRtBlacklisted.mockResolvedValue(false)

    await expect(guard.canActivate(createContext({ jti: 'jti-1' }))).resolves.toBe(true)
  })
})

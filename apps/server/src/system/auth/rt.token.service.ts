import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import type { Response } from 'express'
import { SessionRegistry } from './session-registry'

interface JwtTokenConfig {
  secret: string
  refreshSecret: string
  expiresTime: number
  refreshExpiresTime: number
}

@Injectable()
export class RtTokenService {
  private readonly tokenConfig: JwtTokenConfig
  private readonly sessions: SessionRegistry

  constructor(
    private readonly jwt: JwtService,
    redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.tokenConfig = configService.get<JwtTokenConfig>('token') ?? {
      secret: '',
      refreshSecret: '',
      expiresTime: 60,
      refreshExpiresTime: 120,
    }
    this.sessions = new SessionRegistry(redisService.getOrThrow(), {
      listPrefix: 'user:cookies:',
      expiryPrefix: 'cookies:exp:',
      blacklistPrefix: 'rt:jwt:blacklist:',
      lockPrefix: 'user:cookies:lock:',
      ttlSeconds: this.tokenConfig.refreshExpiresTime,
      maxSessions: configService.get<number>('ssoCount') ?? 2,
    })
  }

  async issue(
    userId: string,
    extraPayload: Record<string, unknown> = {},
    res: Response,
    oldJti?: string,
  ) {
    const jti = randomUUID()
    const refreshExp = Math.floor(Date.now() / 1000) + this.tokenConfig.refreshExpiresTime
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, id: userId, ...extraPayload },
        {
          expiresIn: this.tokenConfig.expiresTime,
          jwtid: jti,
          secret: this.tokenConfig.secret,
        },
      ),
      this.jwt.signAsync(
        { id: userId },
        {
          expiresIn: this.tokenConfig.refreshExpiresTime,
          jwtid: jti,
          secret: this.tokenConfig.refreshSecret,
        },
      ),
    ])

    await this.sessions.register(userId, jti, refreshExp, oldJti)
    this.setRtCookie(res, refreshToken)
    return { jti, exp: refreshExp, accessToken, refreshToken }
  }

  setRtCookie(res: Response, refreshToken: string) {
    res.cookie('rt', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<boolean>('isProduction') ?? false,
      sameSite: 'lax',
      path: '/',
      maxAge: this.tokenConfig.refreshExpiresTime * 1000,
    })
  }

  clearRtCookie(res: Response) {
    res.clearCookie('rt', {
      httpOnly: true,
      secure: this.configService.get<boolean>('isProduction') ?? false,
      sameSite: 'lax',
      path: '/',
    })
  }

  async signToken(
    userId: string,
    extraPayload: Record<string, unknown> = {},
    res: Response,
    oldJti?: string,
  ) {
    const { accessToken, refreshToken } = await this.issue(userId, extraPayload, res, oldJti)
    return { accessToken, refreshToken }
  }

  async revoke(userId: string, jti: string) {
    await this.sessions.revoke(userId, jti)
  }

  async revokeAll(userId: string, exceptJti?: string) {
    await this.sessions.revokeAll(userId, exceptJti)
  }

  async blacklistByJti(jti: string, exp: number) {
    await this.sessions.blacklist(jti, exp)
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return this.sessions.isBlacklisted(jti)
  }

  async listSessions(userId: string) {
    return this.sessions.listSessions(userId)
  }

  async logout(userId: string, jti: string) {
    await this.revoke(userId, jti)
    return { ok: true }
  }
}

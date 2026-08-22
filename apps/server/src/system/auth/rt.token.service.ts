import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { randomUUID } from 'crypto'
import type { CookieOptions, Response } from 'express'
import { REFRESH_SESSION_KEYS, TokenSessionService, type TokenAppConfig } from './token.session'

@Injectable()
export class RtTokenService extends TokenSessionService {
  private readonly tokenConfig: TokenAppConfig

  constructor(
    jwt: JwtService,
    redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const tokenConfig = configService.get<TokenAppConfig>('token') ?? {
      secret: '',
      refreshSecret: '',
      expiresTime: 60,
      refreshExpiresTime: 120,
    }
    super(jwt, redisService.getOrThrow(), {
      ...REFRESH_SESSION_KEYS,
      ttlSeconds: tokenConfig.refreshExpiresTime,
      maxSessions: configService.get<number>('ssoCount') ?? 2,
    })
    this.tokenConfig = tokenConfig
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
      this.signJwt(
        { sub: userId, id: userId, ...extraPayload },
        this.tokenConfig.secret,
        this.tokenConfig.expiresTime,
        jti,
      ),
      this.signJwt(
        { id: userId },
        this.tokenConfig.refreshSecret,
        this.tokenConfig.refreshExpiresTime,
        jti,
      ),
    ])

    await this.sessions.register(userId, jti, refreshExp, oldJti)
    this.setRtCookie(res, refreshToken)
    return { jti, exp: refreshExp, accessToken, refreshToken }
  }

  setRtCookie(res: Response, refreshToken: string) {
    res.cookie('rt', refreshToken, {
      ...this.rtCookieBase(),
      maxAge: this.tokenConfig.refreshExpiresTime * 1000,
    })
  }

  clearRtCookie(res: Response) {
    res.clearCookie('rt', this.rtCookieBase())
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

  private rtCookieBase(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<boolean>('isProduction') ?? false,
      sameSite: 'lax',
      path: '/',
    }
  }
}

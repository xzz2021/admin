import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { SessionRegistry } from './session-registry';

interface JwtTokenConfig {
  secret: string;
  expiresTime: number;
}

@Injectable()
export class TokenService {
  private readonly tokenConfig: JwtTokenConfig;
  private readonly sessions: SessionRegistry;

  constructor(
    private readonly jwt: JwtService,
    redisService: RedisService,
    configService: ConfigService,
  ) {
    this.tokenConfig = configService.get<JwtTokenConfig>('token') ?? {
      secret: '',
      expiresTime: 60 * 60 * 24 * 7,
    };
    this.sessions = new SessionRegistry(redisService.getOrThrow(), {
      listPrefix: 'user:sessions:',
      expiryPrefix: 'session:exp:',
      blacklistPrefix: 'jwt:blacklist:',
      lockPrefix: 'user:sessions:lock:',
      ttlSeconds: this.tokenConfig.expiresTime,
      maxSessions: configService.get<number>('ssoCount') ?? 2,
    });
  }

  async issue(userId: string, extraPayload: Record<string, unknown> = {}) {
    const jti = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + this.tokenConfig.expiresTime;
    const token = await this.jwt.signAsync(
      { sub: userId, ...extraPayload },
      {
        expiresIn: this.tokenConfig.expiresTime,
        jwtid: jti,
        secret: this.tokenConfig.secret,
      },
    );
    await this.sessions.register(userId, jti, exp);
    return { jti, exp, token };
  }

  async signToken(userId: string, extraPayload: Record<string, unknown> = {}) {
    return (await this.issue(userId, extraPayload)).token;
  }

  async revoke(userId: string, jti: string) {
    await this.sessions.revoke(userId, jti);
  }

  async revokeAll(userId: string, exceptJti?: string) {
    await this.sessions.revokeAll(userId, exceptJti);
  }

  async blacklistByJti(jti: string, exp: number) {
    await this.sessions.blacklist(jti, exp);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return this.sessions.isBlacklisted(jti);
  }

  async listSessions(userId: string) {
    return this.sessions.listSessions(userId);
  }

  async logout(userId: string, jti: string) {
    await this.revoke(userId, jti);
    return { ok: true };
  }

  async kickOthers(userId: string, currentJti?: string) {
    await this.revokeAll(userId, currentJti);
    return { ok: true };
  }
}

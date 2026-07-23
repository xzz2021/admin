import { IS_PUBLIC_KEY } from '@/processor/decorator';
import { RtTokenService } from '@/system/auth/rt.token.service';
import { TokenService } from '@/system/auth/token.service';
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

// 用于全局 配合 短token 拦截
@Injectable()
export class RtJwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // 允许对 `/public/` 开头的资源访问
    if (request.url.startsWith('/public/')) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) return false;
    // 验签后检查双通道黑名单，被踢的 access token 立刻 401
    const jti = request.user?.jti as string | undefined;
    if (!jti) return true;

    if ((await this.tokenService.isBlacklisted(jti)) || (await this.rtTokenService.isBlacklisted(jti))) {
      throw new UnauthorizedException('token 已失效');
    }

    return true;
  }
}

// captcha.guard.ts
import { CAPTCHA_ID_COOKIE, CAPTCHA_TEXT_COOKIE, CaptchaService } from '@/system/captcha/captcha.service';
import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(private readonly svc: CaptchaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const captchaId = req.cookies?.[CAPTCHA_ID_COOKIE] as string | undefined;
    const captchaText = req.cookies?.[CAPTCHA_TEXT_COOKIE] as string | undefined;
    if (!captchaId || !captchaText) {
      throw new BadRequestException('验证码不能为空');
    }
    const ok: boolean = await this.svc.verify(captchaId, captchaText);
    if (!ok) {
      throw new BadRequestException('验证码有误');
    }
    return true;
  }
}

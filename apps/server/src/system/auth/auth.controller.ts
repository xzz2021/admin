import { Public, RequiredPermission, Serialize } from '@/processor/decorator'
import { CaptchaGuard, JwtRefreshAuthGuard } from '@/processor/guard'
import { extractIP } from '@/processor/utils'
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { AuthService } from './auth.service'
import type { JwtReqDto } from './dto/auth.dto'
import { ForceLogoutDto, LoginInfoDto, RegisterDto, RegisterResDto } from './dto/auth.dto'
import { applyCookieCommand } from './http-cookie'

@ApiTags('帐号权限')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Serialize(RegisterResDto)
  @ApiOperation({ summary: '用户注册' })
  create(@Body() createUserinfo: RegisterDto) {
    return this.authService.create(createUserinfo)
  }

  @Post('rt/login')
  @Public()
  @ApiOperation({ summary: '用户登录(refreshToken版本)' })
  @UseGuards(CaptchaGuard)
  async rtLogin(
    @Body() loginInfo: LoginInfoDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, cookie } = await this.authService.rtLogin(
      loginInfo,
      extractIP((req as any)['ip'] as string) ?? '',
    )
    applyCookieCommand(res, cookie)
    return body
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  async refresh(@Req() req: JwtReqDto, @Res({ passthrough: true }) res: Response) {
    const { id: userId, jti: oldJti } = req.user
    const { body, cookie } = await this.authService.rtRefresh(userId, oldJti)
    applyCookieCommand(res, cookie)
    return body
  }

  @Post('logout')
  @ApiOperation({ summary: '用户主动退出登录' })
  async logout(
    @Body() body: ForceLogoutDto,
    @Req() req: JwtReqDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body: result, cookie } = await this.authService.logout(body.id, req.user.jti)
    applyCookieCommand(res, cookie)
    return result
  }

  @Post('forceLogout')
  @RequiredPermission('user:update')
  @ApiOperation({ summary: '强制用户下线' })
  forceLogout(@Body() body: ForceLogoutDto, @Req() req: JwtReqDto) {
    return this.authService.forceLogout(body.id, req.user.id)
  }
}

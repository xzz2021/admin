import { Public, RequiredPermission, Serialize } from '@/processor/decorator';
import { CaptchaGuard, JwtRefreshAuthGuard } from '@/processor/guard';
import { extractIP } from '@/processor/utils';
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import type { JwtReqDto } from './dto/auth.dto';
import { ForceLogoutDto, LoginInfoDto, RegisterDto, RegisterResDto } from './dto/auth.dto';

@ApiTags('帐号权限')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Serialize(RegisterResDto)
  @ApiOperation({ summary: '用户注册' })
  create(@Body() createUserinfo: RegisterDto) {
    return this.authService.create(createUserinfo);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: '用户登录' })
  @UseGuards(CaptchaGuard)
  login(@Body() loginInfo: LoginInfoDto, @Req() req: Request) {
    return this.authService.login(loginInfo, extractIP((req as any)['ip'] as string) ?? '');
  }

  @Post('rt/login')
  @Public()
  @ApiOperation({ summary: '用户登录(refreshToken版本)' })
  @UseGuards(CaptchaGuard)
  rtLogin(@Body() loginInfo: LoginInfoDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.rtLogin(loginInfo, extractIP((req as any)['ip'] as string) ?? '', res);
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  refresh(@Req() req: JwtReqDto, @Res({ passthrough: true }) res: Response) {
    // console.log('xzz2021: AuthController -> refresh -> userId:', req.user);
    const { id: userId, jti: oldJti } = req.user;
    return this.authService.rtRefresh(userId, res, oldJti);
  }

  @Post('logout')
  @ApiOperation({ summary: '用户主动退出登录' })
  logout(@Body() body: ForceLogoutDto, @Req() req: JwtReqDto, @Res({ passthrough: true }) res: Response) {
    const jti: string = req.user.jti;
    return this.authService.logout(body.id, jti, res);
  }

  @Post('forceLogout')
  @RequiredPermission('user:update')
  @ApiOperation({ summary: '强制用户下线' })
  forceLogout(@Body() body: ForceLogoutDto) {
    return this.authService.forceLogout(body.id);
  }
}

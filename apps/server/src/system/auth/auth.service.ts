import { PgService } from '@/prisma/pg.service'
import { hashPayPassword, verifyPayPassword } from '@/processor/utils'
import { OnlineGateway } from '@/system/online/online.gateway'
import { OnlineService } from '@/system/online/online.service'
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { LoginInfoDto, RegisterDto } from './dto/auth.dto'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import Redis from 'ioredis'
import { RtTokenService } from './rt.token.service'
import { TokenService } from './token.service'

@Injectable()
export class AuthService {
  private readonly redis: Redis
  private wxAppSecret: string
  private wxAppId: string
  constructor(
    private readonly pgService: PgService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
    @Optional()
    @Inject(forwardRef(() => OnlineService))
    private readonly onlineService?: OnlineService,
    @Optional()
    @Inject(forwardRef(() => OnlineGateway))
    private readonly onlineGateway?: OnlineGateway,
  ) {
    const wechat = this.configService.get<{ appId: string; appSecret: string }>('wechat')
    this.wxAppSecret = wechat?.appSecret || ''
    this.wxAppId = wechat?.appId || ''
    this.redis = this.redisService.getOrThrow()
  }

  async create(
    createUserDto: RegisterDto,
    checkCode: boolean = true,
  ): Promise<{ message: string; res?: { id: string } }> {
    const { phone, password, username } = createUserDto
    const user = await this.isUserExist(phone)
    if (user) {
      throw new ConflictException(phone + '手机号已存在')
    }

    // 注册前需要请求验证码 请求时已经将验证码存入cache  此处比对验证码 是否正确
    // if (checkCode) {
    //   // if 是为了复用create方法
    //   const smsCheck = await this.smsService.checkSmsCode('register_' + phone, code);
    //   if (!smsCheck.status) return smsCheck;
    // }

    const hashedPassword = await hashPayPassword(password)
    const res = await this.pgService.user.create({
      data: {
        phone,
        username,
        password: hashedPassword,
      },
      select: {
        id: true,
      },
    })
    await this.redis.del('register_' + phone) // 删除缓存的 验证码
    return { message: phone + '注册成功', res }
  }

  private async getUserForLogin(phone: string) {
    const user = await this.pgService.user.findUnique({
      where: { phone, enabled: true },
      select: {
        id: true,
        username: true,
        phone: true,
        password: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        avatar: true,
        email: true,
      },
    })
    return user
  }

  async login(loginInfo: LoginInfoDto, ip: string) {
    const user = await this.getUserForLogin(loginInfo.phone)

    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    const ok = await verifyPayPassword(user.password, loginInfo.password)
    if (!ok) {
      throw new BadRequestException('账号或密码错误')
    }

    const { password, ...result } = user
    const { username, phone, id, roles } = result
    const accessToken = await this.tokenService.signToken(id, {
      username,
      phone,
      id,
      roles: roles.map(item => item.role),
    })

    return {
      message: `${username}登录成功`,
      userinfo: result,
      access_token: accessToken,
    }
  }

  async rtLogin(loginInfo: LoginInfoDto, ip: string, res: Response) {
    const user = await this.getUserForLogin(loginInfo.phone)

    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    const ok = await verifyPayPassword(user.password, loginInfo.password)
    if (!ok) {
      throw new BadRequestException('账号或密码错误')
    }

    const { password, ...result } = user
    const { username, phone, id, roles } = result
    const { accessToken } = await this.rtTokenService.signToken(
      id,
      { username, phone, id, roles: roles.map(item => item.role) },
      res,
    )

    /*
      注意使用res设置cookie后   直接返回数据是无效的
      1. 使用return res.status(200).json({ accessToken });
      2. 使用@Res({ passthrough: true }), 让 Nest 继续负责序列化（JSON）, 因为NestJS接管了响应

      */
    return {
      message: `${username}登录成功`,
      userinfo: result,
      access_token: accessToken,
    }
  }

  async isUserExist(phone: string) {
    const user = await this.pgService.user.findUnique({
      where: { phone },
      select: {
        id: true,
      },
    })
    return !!user
  }

  // async updateTokenVersion(phone: string) {
  //   const tokenVersionKey = 'tokenVersion_' + phone;
  //   const tokenVersion = (await this.redis.get(tokenVersionKey)) as number;
  //   const newTokenVersion = tokenVersion ? tokenVersion + 1 : 1;
  //   await this.redis.set(
  //     tokenVersionKey,
  //     newTokenVersion,
  //     //  过期时间与token的过期时间一致
  //     this.configService.get<number>('TOKEN_VERSION_EXPIRES_IN', 1000 * 60 * 60 * 24 * 3),
  //   );
  //   return newTokenVersion;
  // }

  async getSmsCode(phone: string, cachekey: string) {
    if (cachekey === 'register') {
      const user = await this.isUserExist(phone)
      if (user) {
        throw new BadRequestException('用户已存在, 请直接登录!')
      }
    }
    return { code: 200, message: '演示模式, 模拟验证码已发送,请60秒后再试!' }
    // return this.smsService.generateSmsCode(phone, cachekey);
  }

  async forceLogout(id: string, operatorId: string) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作者信息')
    }
    if (!this.onlineService || !this.onlineGateway) {
      throw new BadRequestException('在线用户模块不可用')
    }
    const jtis = await this.onlineService.terminateUserByOperator(operatorId, id)
    this.onlineGateway.notifyForceLogout(jtis, 'forced')
    this.onlineGateway.notifyForceLogoutByUser(id, 'forced')

    return { message: '强制用户下线成功', id }
  }

  async logout(id: string, jti: string, res?: Response) {
    await Promise.all([this.tokenService.logout(id, jti), this.rtTokenService.logout(id, jti)])
    await this.onlineService?.remove(jti)
    if (res) {
      this.rtTokenService.clearRtCookie(res)
    }
    return { message: '退出登录成功', id }
  }

  /**
   * 验证Token是否正确,如果正确则返回所属用户对象
   * @param token
   */
  async verifyAccessToken(token: string): Promise<any> {
    return await this.jwtService.verifyAsync(token)
  }

  async login2(loginInfo: { phone: string; password: string }) {
    const user = await this.pgService.user.findUnique({
      where: { phone: loginInfo.phone },
      select: {
        id: true,
        username: true,
        phone: true,
        password: true,
        roles: true,
        avatar: true,
        email: true,
      },
    })

    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    const ok = await verifyPayPassword(user.password, loginInfo.password)
    if (!ok) {
      throw new BadRequestException('账号或密码错误')
    }

    const { password, ...result } = user
    const access_token = await this.tokenService.signToken(user.id, result)
    return {
      message: `${user.username}登录成功`,
      userinfo: result,
      access_token,
    }
  }

  async rtRefresh(userId: string, res: Response, oldJti: string) {
    const user = await this.pgService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        phone: true,
        enabled: true,
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        avatar: true,
        email: true,
      },
    })
    if (!user || !user.enabled) {
      throw new UnauthorizedException('用户不存在或已禁用')
    }
    const { username, phone, id, roles } = user
    const { accessToken } = await this.rtTokenService.signToken(
      userId,
      { username, phone, id, roles: roles.map(item => item.role) },
      res,
      oldJti,
    )
    // refresh 会轮换 jti：清理旧 presence，避免同一用户短暂双记录
    await this.onlineService?.remove(oldJti)
    return { access_token: accessToken, message: '获取新的token成功' }
  }
}

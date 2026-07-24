import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtRefreshStrategy } from './jwt.refresh.strategy'
import { JwtStrategy } from './jwt.strategy'
// import { SmsModule } from '@/utils/sms/sms.module';
// import { ConfigService } from '@nestjs/config';
import { CaptchaModule } from '@/system/captcha/captcha.module'
import { OnlineModule } from '@/system/online/online.module'
import { JwtRefreshAuthGuard } from '@/processor/guard'
import { RtTokenService } from './rt.token.service'
import { TokenService } from './token.service'

@Module({
  imports: [
    PassportModule,
    JwtModule, // 不用传递参数 一律在生成时传递
    CaptchaModule,
    forwardRef(() => OnlineModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    RtTokenService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtRefreshAuthGuard,
  ],
  exports: [AuthService, TokenService, RtTokenService],
})
export class AuthModule {}

/*
2种token注意事项

1. 一般jwttoken 前端存入localstroage  后端从header取   多点登录 根据 数组长度限制  以及单个jwtid记录 用于加黑剔除
1.2 token到期自动失效


2. 双token  弱化jwttoken  一般校验有效期即可    而rttoken依据第一点的逻辑 进行处理
2.1  区别在于 rttoken取自cookies  且token需要不断刷新 换取2个新token 同时移除旧的


*/

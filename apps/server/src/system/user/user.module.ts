import { Module, forwardRef } from '@nestjs/common'
import { AuthModule } from '@/system/auth/auth.module'
import { OnlineModule } from '@/system/online/online.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [AuthModule, forwardRef(() => OnlineModule)],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

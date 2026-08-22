import { AuthModule } from '@/system/auth/auth.module'
import { FileCleanupModule } from '@/system/file-cleanup/file-cleanup.module'
import { OnlineModule } from '@/system/online/online.module'
import { Module, forwardRef } from '@nestjs/common'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [AuthModule, FileCleanupModule, forwardRef(() => OnlineModule)],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

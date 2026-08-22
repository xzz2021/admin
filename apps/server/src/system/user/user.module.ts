import { AuthModule } from '@/system/auth/auth.module'
import { FileCleanupModule } from '@/system/file-cleanup/file-cleanup.module'
import { Module } from '@nestjs/common'
import { UserPersistenceModule } from './user-persistence.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [UserPersistenceModule, AuthModule, FileCleanupModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

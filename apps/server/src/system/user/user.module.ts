import { FileCleanupModule } from '@/system/file-cleanup/file-cleanup.module'
import { SessionModule } from '@/system/session/session.module'
import { Module } from '@nestjs/common'
import { UserPersistenceModule } from './user-persistence.module'
import { UserController } from './user.controller'
import { UserService } from './user.service'

@Module({
  imports: [UserPersistenceModule, SessionModule, FileCleanupModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}

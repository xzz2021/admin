import { RoleModule } from '@/system/role/role.module'
import { Module } from '@nestjs/common'
import { PermissionController } from './permission.controller'
import { PermissionService } from './permission.service'

@Module({
  imports: [RoleModule],
  controllers: [PermissionController],
  providers: [PermissionService],
})
export class PermissionModule {}

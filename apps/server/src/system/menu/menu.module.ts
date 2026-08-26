import { Module } from '@nestjs/common'
import { RoleModule } from '@/system/role/role.module'
import { MenuController } from './menu.controller'
import { MenuRepository } from './menu.repository'
import { MenuService } from './menu.service'

@Module({
  imports: [RoleModule],
  controllers: [MenuController],
  providers: [MenuService, MenuRepository],
})
export class MenuModule {}

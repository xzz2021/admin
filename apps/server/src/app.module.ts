import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { CORE_MODULE, GLOBAL_GUARD } from './core/app.core'
import { CORE_SYSTEM_MODULE } from './system/app.system'
@Module({
  imports: [...CORE_MODULE, ...CORE_SYSTEM_MODULE],
  controllers: [AppController],
  providers: [AppService, ...GLOBAL_GUARD],
})
export class AppModule {}

import { RedisHealthService } from '@/core/cache/redis-health.service'
import { PgService } from '@/prisma/pg.service'
import { IS_PUBLIC_KEY } from '@/processor/decorator'
import { Controller, Get, Res, SetMetadata } from '@nestjs/common'
import type { Response } from 'express'
import { AppService } from './app.service'

const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly pgService: PgService,
    private readonly redisHealthService: RedisHealthService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello()
  }

  @Public()
  @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    const [redisOk, dbOk] = await Promise.all([
      this.redisHealthService.ping(),
      this.pgService.ping(),
    ])
    const ok = redisOk && dbOk

    res.status(ok ? 200 : 503)

    return {
      code: ok ? 200 : 503,
      data: {
        status: ok ? 'ok' : 'degraded',
        redis: redisOk ? 'up' : 'down',
        database: dbOk ? 'up' : 'down',
      },
      message: ok ? '服务正常' : '部分依赖不可用',
    }
  }
}

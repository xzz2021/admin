import { Global, Module } from '@nestjs/common'
import { REDIS_MODULE } from './cache-ioredis'
import { RedisHealthService } from './redis-health.service'

@Global()
@Module({
  imports: [REDIS_MODULE],
  providers: [RedisHealthService],
  exports: [REDIS_MODULE, RedisHealthService],
})
export class AppRedisModule {}

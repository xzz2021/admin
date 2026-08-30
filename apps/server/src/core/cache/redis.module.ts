import { Global, Module } from '@nestjs/common'
import { REDIS_MODULE } from './cache-ioredis'
import { RedisAtomicService } from './redis-atomic.service'
import { RedisHealthService } from './redis-health.service'

@Global()
@Module({
  imports: [REDIS_MODULE],
  providers: [RedisHealthService, RedisAtomicService],
  exports: [REDIS_MODULE, RedisHealthService, RedisAtomicService],
})
export class AppRedisModule {}

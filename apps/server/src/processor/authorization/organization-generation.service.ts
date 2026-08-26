import { RedisKeys } from '@/processor/constants/cache'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { OrganizationGenerationUnavailableException } from './authorization.errors'

@Injectable()
export class OrganizationGenerationService {
  static readonly GENERATION_TTL_SECONDS = 7 * 24 * 60 * 60
  static readonly MAX_ATTEMPTS = 3
  static readonly RETRY_DELAY_MS = 10

  private readonly redis: Redis

  constructor(redisService: RedisService) {
    this.redis = redisService.getOrThrow()
  }

  async currentGeneration(): Promise<number> {
    try {
      const raw = await this.redis.get(RedisKeys.ORGANIZATION_GENERATION)
      const generation = Number(raw ?? 0)
      return Number.isFinite(generation) ? generation : 0
    } catch (error) {
      throw new OrganizationGenerationUnavailableException(error)
    }
  }

  async bump(): Promise<void> {
    let lastError: unknown
    for (let attempt = 0; attempt < OrganizationGenerationService.MAX_ATTEMPTS; attempt++) {
      try {
        await this.bumpOnce()
        return
      } catch (error) {
        lastError = error
        if (attempt + 1 < OrganizationGenerationService.MAX_ATTEMPTS) {
          await this.sleep(OrganizationGenerationService.RETRY_DELAY_MS * 2 ** attempt)
        }
      }
    }
    throw new OrganizationGenerationUnavailableException(lastError)
  }

  private async bumpOnce(): Promise<void> {
    const pipeline = this.redis.pipeline()
    pipeline.incr(RedisKeys.ORGANIZATION_GENERATION)
    pipeline.expire(RedisKeys.ORGANIZATION_GENERATION, OrganizationGenerationService.GENERATION_TTL_SECONDS)
    const results = await pipeline.exec()
    if (!results) throw new Error('Organization generation bump failed')
    const failed = results.find(([error]) => error)
    if (failed?.[0]) throw failed[0]
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

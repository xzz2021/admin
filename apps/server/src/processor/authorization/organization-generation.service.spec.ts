import type { RedisService } from '@liaoliaots/nestjs-redis'
import { OrganizationGenerationUnavailableException } from './authorization.errors'
import { OrganizationGenerationService } from './organization-generation.service'

describe('OrganizationGenerationService', () => {
  const redis = {
    get: jest.fn(),
    pipeline: jest.fn(),
  }
  const exec = jest.fn()
  const incr = jest.fn().mockReturnThis()
  const expire = jest.fn().mockReturnThis()
  const service = new OrganizationGenerationService({
    getOrThrow: () => redis,
  } as unknown as RedisService)

  beforeEach(() => {
    jest.clearAllMocks()
    redis.get.mockResolvedValue(null)
    exec.mockResolvedValue([
      [null, 4],
      [null, 1],
    ])
    redis.pipeline.mockReturnValue({ incr, expire, exec })
  })

  it('reads zero for an absent generation and parses an existing generation', async () => {
    await expect(service.currentGeneration()).resolves.toBe(0)
    redis.get.mockResolvedValue('7')
    await expect(service.currentGeneration()).resolves.toBe(7)
  })

  it('maps generation read failures to a typed 503 error', async () => {
    redis.get.mockRejectedValue(new Error('redis down'))

    await expect(service.currentGeneration()).rejects.toBeInstanceOf(OrganizationGenerationUnavailableException)
  })

  it('bumps the global organization generation with expiry', async () => {
    await service.bump()

    expect(incr).toHaveBeenCalledWith('authorization:organization-generation')
    expect(expire).toHaveBeenCalledWith('authorization:organization-generation', expect.any(Number))
    expect(exec).toHaveBeenCalled()
  })

  it('retries a failed bump and succeeds within the limit', async () => {
    exec.mockResolvedValueOnce([[new Error('redis down'), null]]).mockResolvedValueOnce([
      [null, 4],
      [null, 1],
    ])

    await expect(service.bump()).resolves.toBeUndefined()

    expect(exec).toHaveBeenCalledTimes(2)
  })

  it('throws a typed 503 error after retry exhaustion', async () => {
    exec.mockResolvedValue([[new Error('redis down'), null]])

    await expect(service.bump()).rejects.toBeInstanceOf(OrganizationGenerationUnavailableException)
    expect(exec).toHaveBeenCalledTimes(OrganizationGenerationService.MAX_ATTEMPTS)
  })
})

import type { RedisService } from '@liaoliaots/nestjs-redis'
import { RbacPermissionCacheService } from './rbac-permission-cache.service'

describe('RbacPermissionCacheService', () => {
  const redis = {
    get: jest.fn(),
    mget: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    pipeline: jest.fn(),
  }

  const createService = () => new RbacPermissionCacheService({ getOrThrow: () => redis } as unknown as RedisService)

  const pipelineExec = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    redis.get.mockResolvedValue(null)
    redis.mget.mockResolvedValue([null, null])
    redis.set.mockResolvedValue('OK')
    redis.del.mockResolvedValue(1)
    pipelineExec.mockResolvedValue([
      [null, 1],
      [null, 1],
      [null, 1],
    ])
    redis.pipeline.mockReturnValue({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: pipelineExec,
    })
  })

  it('reads wrapped cache when generation matches', async () => {
    const service = createService()
    redis.mget.mockResolvedValue([JSON.stringify({ v: 0, p: ['user:update'] }), null])

    await expect(service.get('user-1')).resolves.toEqual(['user:update'])
  })

  it('treats leftover cache as miss when generation was bumped', async () => {
    const service = createService()
    redis.mget.mockResolvedValue([JSON.stringify({ v: 0, p: ['user:update'] }), '1'])

    await expect(service.get('user-1')).resolves.toBeNull()
  })

  it('writes permission cache with generation and jittered ttl', async () => {
    const service = createService()
    redis.get.mockResolvedValue('2')

    await service.set('user-1', ['user:update'])

    expect(redis.set).toHaveBeenCalledWith(
      'rbac:permissions:user-1',
      JSON.stringify({ v: 2, p: ['user:update'] }),
      'EX',
      expect.any(Number),
    )
    const ttl = redis.set.mock.calls[0][3] as number
    expect(ttl).toBeGreaterThanOrEqual(300)
    expect(ttl).toBeLessThanOrEqual(360)
  })

  it('caches empty permissions as negative cache', async () => {
    const service = createService()
    redis.mget.mockResolvedValue([JSON.stringify({ v: 0, p: [] }), '0'])

    await expect(service.get('user-1')).resolves.toEqual([])
  })

  it('invalidates by bumping generation then deleting cache keys', async () => {
    const service = createService()
    const incr = jest.fn().mockReturnThis()
    const expire = jest.fn().mockReturnThis()
    const del = jest.fn().mockReturnThis()
    redis.pipeline.mockReturnValue({ incr, expire, del, exec: pipelineExec })

    await service.invalidateUsers(['user-1', 'user-1', 'user-2'])

    expect(incr).toHaveBeenCalledWith('rbac:perm-gen:user-1')
    expect(incr).toHaveBeenCalledWith('rbac:perm-gen:user-2')
    expect(del).toHaveBeenCalledWith('rbac:permissions:user-1')
    expect(del).toHaveBeenCalledWith('rbac:permissions:user-2')
    expect(pipelineExec).toHaveBeenCalled()
  })

  it('throws when invalidate pipeline fails so callers do not ignore Redis errors', async () => {
    const service = createService()
    pipelineExec.mockResolvedValue([[new Error('redis down'), null]])

    await expect(service.invalidateUsers(['user-1'])).rejects.toThrow('redis down')
  })

  it('singleflight coalesces concurrent cache fills', async () => {
    const service = createService()
    let calls = 0
    const loader = jest.fn(async () => {
      calls += 1
      await new Promise(resolve => setTimeout(resolve, 30))
      return ['user:update']
    })

    const [a, b] = await Promise.all([service.getOrLoad('user-1', loader), service.getOrLoad('user-1', loader)])

    expect(a).toEqual(['user:update'])
    expect(b).toEqual(['user:update'])
    expect(calls).toBe(1)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

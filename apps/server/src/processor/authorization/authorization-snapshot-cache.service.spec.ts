import type { RedisService } from '@liaoliaots/nestjs-redis'
import type { RbacPermissionCacheService } from '../rbac/rbac-permission-cache.service'
import { AuthorizationCacheUnavailableException } from './authorization.errors'
import { AuthorizationSnapshotCacheService } from './authorization-snapshot-cache.service'

describe('AuthorizationSnapshotCacheService', () => {
  const redis = {
    mget: jest.fn(),
    eval: jest.fn(),
    del: jest.fn(),
  }
  let service: AuthorizationSnapshotCacheService
  const snapshot = {
    permissionCodes: ['customer:list'],
    decisions: {
      'customer:list': {
        scoped: true as const,
        grant: { all: false, scopes: [{ type: 'SELF' as const }] },
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AuthorizationSnapshotCacheService(
      { getOrThrow: () => redis } as unknown as RedisService,
      { genKey: (userId: string) => `rbac:perm-gen:${userId}` } as RbacPermissionCacheService,
    )
    redis.mget.mockResolvedValueOnce(['2', '3', null]).mockResolvedValueOnce(['2', '3'])
    redis.eval.mockResolvedValue(1)
    redis.del.mockResolvedValue(1)
  })

  it('atomically reads both generations and a matching complete snapshot', async () => {
    redis.mget.mockReset().mockResolvedValue(['2', '3', JSON.stringify({ pv: 2, ov: 3, snapshot })])
    const loader = jest.fn()

    await expect(service.getOrLoad('user-1', loader)).resolves.toEqual(snapshot)

    expect(loader).not.toHaveBeenCalled()
    expect(redis.mget).toHaveBeenCalledWith(
      'rbac:perm-gen:user-1',
      'authorization:organization-generation',
      'authorization:snapshot:user-1',
    )
  })

  it('maps Redis read failures to a typed 503 error', async () => {
    redis.mget.mockReset().mockRejectedValue(new Error('redis down'))

    await expect(service.getOrLoad('user-1', jest.fn())).rejects.toBeInstanceOf(AuthorizationCacheUnavailableException)
  })

  it('reloads when either generation no longer matches', async () => {
    redis.mget
      .mockReset()
      .mockResolvedValueOnce(['2', '3', JSON.stringify({ pv: 1, ov: 3, snapshot })])
      .mockResolvedValueOnce(['2', '3'])
    const loader = jest.fn().mockResolvedValue(snapshot)

    await expect(service.getOrLoad('user-1', loader)).resolves.toEqual(snapshot)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      3,
      'rbac:perm-gen:user-1',
      'authorization:organization-generation',
      'authorization:snapshot:user-1',
      '2',
      '3',
      expect.any(String),
      JSON.stringify({ pv: 2, ov: 3, snapshot }),
    )
  })

  it('retries loading when generations change while the loader is running', async () => {
    redis.mget
      .mockReset()
      .mockResolvedValueOnce(['2', '3', null])
      .mockResolvedValueOnce(['3', '3'])
      .mockResolvedValueOnce(['3', '3', null])
      .mockResolvedValueOnce(['3', '3'])
    const loader = jest
      .fn()
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ permissionCodes: [], decisions: {} })

    await expect(service.getOrLoad('user-1', loader)).resolves.toEqual({
      permissionCodes: [],
      decisions: {},
    })

    expect(loader).toHaveBeenCalledTimes(2)
    expect(redis.eval).toHaveBeenCalledTimes(1)
  })

  it('retries when CAS detects a generation change before publish', async () => {
    redis.mget
      .mockReset()
      .mockResolvedValueOnce(['2', '3', null])
      .mockResolvedValueOnce(['2', '3'])
      .mockResolvedValueOnce(['3', '3', null])
      .mockResolvedValueOnce(['3', '3'])
    redis.eval.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    const loader = jest.fn().mockResolvedValue(snapshot)

    await expect(service.getOrLoad('user-1', loader)).resolves.toEqual(snapshot)

    expect(loader).toHaveBeenCalledTimes(2)
    expect(redis.eval).toHaveBeenCalledTimes(2)
  })

  it('does not share an old-generation pending load with a new-generation request', async () => {
    let resolveOld!: (value: typeof snapshot) => void
    let resolveNew!: (value: typeof snapshot) => void
    const oldLoad = new Promise<typeof snapshot>(resolve => {
      resolveOld = resolve
    })
    const newLoad = new Promise<typeof snapshot>(resolve => {
      resolveNew = resolve
    })
    const loader = jest.fn().mockReturnValueOnce(oldLoad).mockReturnValueOnce(newLoad)
    redis.mget
      .mockReset()
      .mockResolvedValueOnce(['2', '3', null])
      .mockResolvedValueOnce(['3', '3', null])
      .mockResolvedValueOnce(['3', '3'])
      .mockResolvedValueOnce(['3', '3'])
      .mockResolvedValueOnce(['3', '3', JSON.stringify({ pv: 3, ov: 3, snapshot })])

    const oldRequest = service.getOrLoad('user-1', loader)
    await new Promise(resolve => setImmediate(resolve))
    const newRequest = service.getOrLoad('user-1', loader)
    await new Promise(resolve => setImmediate(resolve))

    expect(loader).toHaveBeenCalledTimes(2)
    resolveNew(snapshot)
    await expect(newRequest).resolves.toEqual(snapshot)
    resolveOld(snapshot)
    await expect(oldRequest).resolves.toEqual(snapshot)
  })

  it('retries all same-generation singleflight callers when their shared load becomes stale', async () => {
    let resolveInitial!: (value: typeof snapshot) => void
    const initialLoad = new Promise<typeof snapshot>(resolve => {
      resolveInitial = resolve
    })
    const refreshed = { permissionCodes: [], decisions: {} }
    const loader = jest.fn().mockReturnValueOnce(initialLoad).mockResolvedValueOnce(refreshed)
    redis.mget
      .mockReset()
      .mockResolvedValueOnce(['2', '3', null])
      .mockResolvedValueOnce(['2', '3', null])
      .mockResolvedValueOnce(['3', '3'])
      .mockResolvedValueOnce(['3', '3', null])
      .mockResolvedValueOnce(['3', '3', null])
      .mockResolvedValueOnce(['3', '3'])

    const first = service.getOrLoad('user-1', loader)
    await new Promise(resolve => setImmediate(resolve))
    const second = service.getOrLoad('user-1', loader)
    await new Promise(resolve => setImmediate(resolve))
    resolveInitial(snapshot)

    await expect(Promise.all([first, second])).resolves.toEqual([refreshed, refreshed])
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it.each([
    {
      permissionCodes: ['customer:list'],
      decisions: {},
    },
    {
      permissionCodes: ['customer:list'],
      decisions: {
        'customer:list': { scoped: false },
        extra: { scoped: false },
      },
    },
    {
      permissionCodes: ['customer:list'],
      decisions: {
        'customer:list': { scoped: true, grant: { all: true, scopes: [{ type: 'SELF' }] } },
      },
    },
    {
      permissionCodes: ['customer:list'],
      decisions: {
        'customer:list': { scoped: true, grant: { all: false, scopes: [{ type: 'SELF', ids: [] }] } },
      },
    },
    {
      permissionCodes: ['customer:list'],
      decisions: {
        'customer:list': {
          scoped: true,
          grant: { all: false, scopes: [{ type: 'DEPARTMENT', ids: ['dept-b', 'dept-a'] }] },
        },
      },
    },
    {
      permissionCodes: ['customer:list'],
      decisions: {
        'customer:list': {
          scoped: true,
          grant: { all: false, scopes: [{ type: 'DEPARTMENT', ids: ['dept-a', 'dept-a'] }] },
        },
      },
    },
  ])('rejects a snapshot that violates cross-field or grant invariants', async malformedSnapshot => {
    redis.mget
      .mockReset()
      .mockResolvedValueOnce(['2', '3', JSON.stringify({ pv: 2, ov: 3, snapshot: malformedSnapshot })])
      .mockResolvedValueOnce(['2', '3'])
    const loader = jest.fn().mockResolvedValue(snapshot)

    await expect(service.getOrLoad('user-1', loader)).resolves.toEqual(snapshot)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(redis.del).toHaveBeenCalledWith('authorization:snapshot:user-1')
  })

  it('allows wildcard snapshots to contain catalog decisions', async () => {
    const wildcardSnapshot = {
      permissionCodes: ['*'],
      decisions: { 'customer:list': { scoped: false as const } },
    }
    redis.mget.mockReset().mockResolvedValue(['2', '3', JSON.stringify({ pv: 2, ov: 3, snapshot: wildcardSnapshot })])

    await expect(service.getOrLoad('user-1', jest.fn())).resolves.toEqual(wildcardSnapshot)
  })

  it('writes cache with jittered ttl through CAS', async () => {
    const loader = jest.fn().mockResolvedValue(snapshot)

    await service.getOrLoad('user-1', loader)

    const ttl = Number(redis.eval.mock.calls[0][7])
    expect(ttl).toBeGreaterThanOrEqual(300)
    expect(ttl).toBeLessThanOrEqual(360)
  })
})

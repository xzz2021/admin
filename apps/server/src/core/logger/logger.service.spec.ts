import type { PgService } from '@/prisma/pg.service'
import { LogService } from './logger.service'

describe('LogService list queries', () => {
  const findMany = jest.fn()
  const count = jest.fn()
  const create = jest.fn()
  const error = jest.fn()
  const service = new LogService(
    { error } as never,
    {
      userOperationLog: { findMany, count, create },
    } as unknown as PgService,
  )

  it('loads operation logs and count in parallel', async () => {
    let resolveList!: (value: unknown[]) => void
    let resolveCount!: (value: number) => void
    findMany.mockReturnValue(
      new Promise(resolve => {
        resolveList = resolve
      }),
    )
    count.mockReturnValue(
      new Promise(resolve => {
        resolveCount = resolve
      }),
    )

    const pending = service.getUserOperationLogList({ pageIndex: 1, pageSize: 10 })

    expect(findMany).toHaveBeenCalled()
    expect(count).toHaveBeenCalled()

    resolveList([])
    resolveCount(0)
    await expect(pending).resolves.toEqual({
      list: [],
      total: 0,
      message: '获取日志列表成功',
    })
  })

  it('applies a DTO-parsed dateRange without JSON.parse', async () => {
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)

    await service.getUserOperationLogList({
      pageIndex: 1,
      pageSize: 10,
      dateRange: ['2026-01-01T00:00:00.000Z', '2026-01-31T23:59:59.000Z'],
    })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-01-31T23:59:59.000Z'),
          },
        },
      }),
    )
  })

  it('logs persistence failures with message, stack and context', async () => {
    create.mockRejectedValue(new Error('db down'))

    await expect(
      service.addUserOperationLog({
        userId: 'user-1',
        method: 'GET',
        ip: '127.0.0.1',
        userAgent: 'jest',
        requestUrl: '/user',
        isSuccess: true,
        duration: 12,
      }),
    ).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledWith('写入用户操作日志失败', expect.any(String), 'LogService')
  })
})

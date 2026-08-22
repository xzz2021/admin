import type { PgService } from '@/prisma/pg.service'
import { LogService } from './logger.service'

describe('LogService list queries', () => {
  const findMany = jest.fn()
  const count = jest.fn()
  const service = new LogService(
    { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } as never,
    {
      userOperationLog: { findMany, count },
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
})

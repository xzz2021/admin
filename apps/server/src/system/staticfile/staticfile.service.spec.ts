import type { PgService } from '@/prisma/pg.service'
import { StaticfileService } from './staticfile.service'

describe('StaticfileService list queries', () => {
  const findMany = jest.fn()
  const count = jest.fn()
  const service = new StaticfileService({
    file: { findMany, count },
  } as unknown as PgService)

  it('loads file list and count in parallel', async () => {
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

    const pending = service.getFileList()

    expect(findMany).toHaveBeenCalled()
    expect(count).toHaveBeenCalled()

    resolveList([])
    resolveCount(0)
    await expect(pending).resolves.toEqual({
      message: '文件列表获取成功',
      list: [],
      total: 0,
    })
  })
})

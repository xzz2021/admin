import type { PgService } from '@/prisma/pg.service'
import { DepartmentService } from './department.service'

describe('DepartmentService tree updates', () => {
  const findMany = jest.fn()
  const update = jest.fn()
  const executeRaw = jest.fn()
  const transaction = jest.fn(
    async (
      callback: (tx: {
        department: { findMany: typeof findMany; update: typeof update }
        $executeRaw: typeof executeRaw
      }) => Promise<unknown>,
    ) => callback({ department: { findMany, update }, $executeRaw: executeRaw }),
  )

  const service = new DepartmentService({ $transaction: transaction } as unknown as PgService)

  beforeEach(() => {
    jest.clearAllMocks()
    update.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id }),
    )
    executeRaw.mockResolvedValue(1)
  })

  it('updates descendant materialized paths with one SQL statement when moving a department', async () => {
    findMany.mockResolvedValue([
      { id: 'root-a', parentId: null, path: '/root-a' },
      { id: 'node', parentId: 'root-a', path: '/root-a/node' },
      { id: 'child', parentId: 'node', path: '/root-a/node/child' },
      { id: 'root-b', parentId: null, path: '/root-b' },
    ])

    await service.update({
      id: 'node',
      parentId: 'root-b',
      name: 'Node',
      enabled: true,
    })

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'node' },
        data: expect.objectContaining({ parentId: 'root-b', path: '/root-b/node' }),
      }),
    )
    expect(executeRaw).toHaveBeenCalledTimes(1)
    const sql = executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] }
    expect(sql.sql).toMatch(/regexp_replace/i)
    expect(sql.values).toEqual(expect.arrayContaining(['/root-b/node', '/root-a/node/%']))
  })

  it('does not rewrite descendant paths when the materialized path is unchanged', async () => {
    findMany.mockResolvedValue([
      { id: 'node', parentId: null, path: '/node' },
      { id: 'child', parentId: 'node', path: '/node/child' },
    ])

    await service.update({
      id: 'node',
      name: 'Renamed',
      enabled: true,
    })

    expect(update).toHaveBeenCalledTimes(1)
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('rejects moving a department under its descendant before writing', async () => {
    findMany.mockResolvedValue([
      { id: 'node', parentId: null, path: '/node' },
      { id: 'child', parentId: 'node', path: '/node/child' },
    ])

    await expect(
      service.update({
        id: 'node',
        parentId: 'child',
        name: 'Node',
        enabled: true,
      }),
    ).rejects.toThrow('不能将部门移动到自己的后代节点下')
    expect(update).not.toHaveBeenCalled()
    expect(executeRaw).not.toHaveBeenCalled()
  })
})

describe('DepartmentService list queries', () => {
  const findMany = jest.fn()
  const count = jest.fn()
  const service = new DepartmentService({
    department: { findMany, count },
  } as unknown as PgService)

  it('loads list and count in parallel', async () => {
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

    const pending = service.findAll()

    expect(findMany).toHaveBeenCalled()
    expect(count).toHaveBeenCalled()

    resolveList([])
    resolveCount(0)
    await expect(pending).resolves.toEqual({
      list: [],
      total: 0,
      message: '获取部门列表成功',
    })
  })
})

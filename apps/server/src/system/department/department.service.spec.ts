import type { PgService } from '@/prisma/pg.service'
import { DepartmentService } from './department.service'

describe('DepartmentService tree updates', () => {
  const findMany = jest.fn()
  const update = jest.fn()
  const transaction = jest.fn(
    async (
      callback: (tx: {
        department: { findMany: typeof findMany; update: typeof update }
      }) => Promise<unknown>,
    ) => callback({ department: { findMany, update } }),
  )

  const service = new DepartmentService({ $transaction: transaction } as unknown as PgService)

  beforeEach(() => {
    jest.clearAllMocks()
    update.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id }),
    )
  })

  it('updates descendant materialized paths when moving a department', async () => {
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

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'node' },
        data: expect.objectContaining({ parentId: 'root-b', path: '/root-b/node' }),
      }),
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'child' },
        data: { path: '/root-b/node/child' },
      }),
    )
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
  })
})

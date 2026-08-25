import { Prisma } from '@/prisma/generated/prisma/client'
import type { PgService } from '@/prisma/pg.service'
import { DepartmentRepository } from './department.repository'
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

  const service = new DepartmentService(
    new DepartmentRepository({ $transaction: transaction } as unknown as PgService),
    { record: jest.fn() } as unknown as import('@/core/logger/audit-log.service').AuditLogService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    update.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({ id: where.id }))
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
  const service = new DepartmentService(
    new DepartmentRepository({
      department: { findMany, count },
    } as unknown as PgService),
    { record: jest.fn() } as unknown as import('@/core/logger/audit-log.service').AuditLogService,
  )

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

    const list = [{ id: 'dept-1', name: '研发部', children: [] }]
    resolveList(list)
    resolveCount(1)
    await expect(pending).resolves.toEqual({
      list,
      total: 1,
      message: '获取部门列表成功',
    })
  })

  it('throws when the department list is empty', async () => {
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)

    await expect(service.findAll()).rejects.toThrow('部门列表为空')
  })
})

describe('DepartmentService delete rules', () => {
  const findUnique = jest.fn()
  const findFirst = jest.fn()
  const remove = jest.fn()
  const service = new DepartmentService(
    new DepartmentRepository({
      department: { findUnique, findFirst, delete: remove },
    } as unknown as PgService),
    { record: jest.fn() } as unknown as import('@/core/logger/audit-log.service').AuditLogService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('refuses to delete a department that still has children', async () => {
    findUnique.mockResolvedValue({ path: '/node' })
    findFirst.mockResolvedValue({ id: 'child' })

    await expect(service.delete('node')).rejects.toThrow('当前项有子部门无法删除')
    expect(remove).not.toHaveBeenCalled()
  })
})

describe('DepartmentService unique names', () => {
  const create = jest.fn()
  const transaction = jest.fn(async (callback: (tx: { department: { create: typeof create } }) => Promise<unknown>) =>
    callback({ department: { create } }),
  )
  const service = new DepartmentService(
    new DepartmentRepository({ $transaction: transaction } as unknown as PgService),
    { record: jest.fn() } as unknown as import('@/core/logger/audit-log.service').AuditLogService,
  )

  it('maps unique constraint failures to a sibling name conflict', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )

    await expect(service.add({ name: '研发部', enabled: true })).rejects.toThrow('同级已存在同名部门')
  })
})

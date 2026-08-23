import type { PgService } from '@/prisma/pg.service'
import { AuditLogService } from './audit-log.service'

describe('AuditLogService', () => {
  const create = jest.fn()
  const findMany = jest.fn()
  const count = jest.fn()
  const error = jest.fn()
  const service = new AuditLogService(
    { error } as never,
    {
      auditLog: { create, findMany, count },
    } as unknown as PgService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('writes a sanitized domain event and never throws when persistence fails', async () => {
    create.mockRejectedValue(new Error('db down'))

    await expect(
      service.record({
        actorId: 'user-1',
        action: 'user.update',
        resource: 'User',
        resourceId: 'user-2',
        ip: '127.0.0.1',
        metadata: { password: 'secret', enabled: true },
      }),
    ).resolves.toBeUndefined()

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        action: 'user.update',
        resource: 'User',
        resourceId: 'user-2',
        success: true,
        metadata: { password: '[Redacted]', enabled: true },
      }),
    })
    expect(error).toHaveBeenCalled()
  })

  it('loads audit logs and count in parallel', async () => {
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

    const pending = service.getAuditLogList({ pageIndex: 1, pageSize: 10 })

    expect(findMany).toHaveBeenCalled()
    expect(count).toHaveBeenCalled()

    resolveList([])
    resolveCount(0)
    await expect(pending).resolves.toEqual({
      list: [],
      total: 0,
      message: '获取操作日志成功',
    })
  })
})

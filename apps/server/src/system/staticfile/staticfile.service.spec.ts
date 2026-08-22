import type { PgService } from '@/prisma/pg.service'
import type { FileCleanupService } from '@/system/file-cleanup/file-cleanup.service'
import { StaticfileService } from './staticfile.service'

describe('StaticfileService', () => {
  const findMany = jest.fn()
  const count = jest.fn()
  const create = jest.fn()
  const updateMany = jest.fn()
  const enqueue = jest.fn()

  const service = new StaticfileService(
    { file: { findMany, count, create, updateMany } } as unknown as PgService,
    { enqueue } as unknown as FileCleanupService,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    enqueue.mockResolvedValue(undefined)
    updateMany.mockResolvedValue({ count: 1 })
  })

  it('loads active file list and count in parallel', async () => {
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

    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null } })
    expect(count).toHaveBeenCalledWith({ where: { deletedAt: null } })

    resolveList([])
    resolveCount(0)
    await expect(pending).resolves.toEqual({
      message: '文件列表获取成功',
      list: [],
      total: 0,
    })
  })

  it('marks files deleted and enqueues cleanup instead of unlinking in the request', async () => {
    findMany.mockResolvedValue([{ id: 1, path: '/static-root/a.png' }])

    await service.deleteFile([1])

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    })
    expect(enqueue).toHaveBeenCalledWith([
      { kind: 'managed-file', fileId: 1, path: '/static-root/a.png' },
    ])
  })

  it('enqueues the uploaded file for cleanup when the database write fails', async () => {
    create.mockRejectedValue(new Error('db down'))

    await expect(
      service.uploadFile({
        name: 'a.png',
        mimeType: 'image/png',
        path: '/static-root/a.png',
        size: 10,
        url: 'http://localhost/a.png',
        extension: 'png',
      }),
    ).rejects.toThrow('db down')
    expect(enqueue).toHaveBeenCalledWith([{ kind: 'orphan-path', path: '/static-root/a.png' }])
  })
})

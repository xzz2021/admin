import { BackupStatus } from '@/prisma/generated/prisma/client'
import type { PgService } from '@/prisma/pg.service'
import type { ConfigService } from '@nestjs/config'
import type { Queue } from 'bullmq'
import { promises as fs } from 'node:fs'
import { FILE_CLEANUP_UNLINK } from './file-cleanup.constants'
import { FileCleanupService } from './file-cleanup.service'

jest.mock('node:fs', () => ({
  promises: {
    unlink: jest.fn(),
  },
}))

jest.mock('@/system/staticfile/multer.config', () => ({
  getStaticFileRoot: () => '/static-root',
  tryResolvePathInsideRoot: jest.fn((root: string, target: string) => {
    const normalizedRoot = root.replace(/\\/g, '/')
    const normalizedTarget = target.replace(/\\/g, '/')
    if (normalizedTarget.startsWith(`${normalizedRoot}/`) || normalizedTarget === normalizedRoot) {
      return target
    }
    if (!target.startsWith('/') && !/^[A-Za-z]:/.test(target)) return `${root}/${target}`
    if (normalizedRoot.includes('backups') && normalizedTarget.includes('backups')) return target
    return null
  }),
}))

describe('FileCleanupService', () => {
  const unlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>
  const fileDeleteMany = jest.fn()
  const backupDeleteMany = jest.fn()
  const queueAdd = jest.fn()

  const service = new FileCleanupService(
    {
      file: { deleteMany: fileDeleteMany, findMany: jest.fn() },
      dbBackupJob: { deleteMany: backupDeleteMany, findMany: jest.fn() },
    } as unknown as PgService,
    {
      get: (key: string) => (key === 'dbBackup.dir' ? '/backups' : undefined),
    } as unknown as ConfigService,
    { add: queueAdd } as unknown as Queue,
  )

  beforeEach(() => {
    jest.clearAllMocks()
    unlink.mockResolvedValue(undefined)
    fileDeleteMany.mockResolvedValue({ count: 1 })
    backupDeleteMany.mockResolvedValue({ count: 1 })
    queueAdd.mockResolvedValue({})
  })

  it('enqueues unlink jobs without touching the filesystem', async () => {
    await service.enqueue([
      { kind: 'managed-file', fileId: 1, path: 'a.png' },
      { kind: 'orphan-path', path: '/static-root/old.png' },
    ])

    expect(queueAdd).toHaveBeenCalledTimes(2)
    expect(queueAdd).toHaveBeenCalledWith(
      FILE_CLEANUP_UNLINK,
      { kind: 'managed-file', fileId: 1, path: 'a.png' },
      expect.objectContaining({ attempts: 5 }),
    )
    expect(unlink).not.toHaveBeenCalled()
  })

  it('unlinks then hard-deletes a managed file record', async () => {
    await service.process({ kind: 'managed-file', fileId: 9, path: 'a.png' })

    expect(unlink).toHaveBeenCalledWith('/static-root/a.png')
    expect(fileDeleteMany).toHaveBeenCalledWith({
      where: { id: 9, deletedAt: { not: null } },
    })
  })

  it('retries when unlink fails for a reason other than missing file', async () => {
    unlink.mockRejectedValue(Object.assign(new Error('busy'), { code: 'EBUSY' }))

    await expect(service.process({ kind: 'orphan-path', path: 'a.png' })).rejects.toThrow('busy')
    expect(fileDeleteMany).not.toHaveBeenCalled()
  })

  it('treats missing files as success and still deletes the backup record', async () => {
    unlink.mockRejectedValue(Object.assign(new Error('gone'), { code: 'ENOENT' }))

    await service.process({
      kind: 'backup-job',
      backupJobId: 'job-1',
      path: '/backups/a.sql.gz',
    })

    expect(unlink).toHaveBeenCalledWith('/backups/a.sql.gz')
    expect(backupDeleteMany).toHaveBeenCalledWith({
      where: { id: 'job-1', status: BackupStatus.EXPIRED },
    })
  })
})

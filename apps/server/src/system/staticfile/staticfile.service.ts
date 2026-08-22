import { PgService } from '@/prisma/pg.service'
import { FileCleanupService } from '@/system/file-cleanup/file-cleanup.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { UploadFileDto } from './file.dto'

@Injectable()
export class StaticfileService {
  constructor(
    private readonly pgService: PgService,
    private readonly fileCleanupService: FileCleanupService,
  ) {}

  async getFileList() {
    const where = { deletedAt: null }
    const [fileList, total] = await Promise.all([
      this.pgService.file.findMany({ where }),
      this.pgService.file.count({ where }),
    ])
    return { message: '文件列表获取成功', list: fileList, total }
  }

  async uploadFile(file: UploadFileDto) {
    try {
      const fileData = await this.pgService.file.create({
        data: {
          ...file,
        },
      })
      return { message: '文件上传成功', fileData }
    } catch (error) {
      await this.fileCleanupService.enqueue([{ kind: 'orphan-path', path: file.path }])
      throw error
    }
  }

  async deleteFile(ids: number[]) {
    const fileList = await this.pgService.file.findMany({
      where: { id: { in: ids }, deletedAt: null },
    })
    if (fileList.length !== ids.length) {
      throw new BadRequestException('部分文件不存在')
    }
    await this.pgService.file.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    await this.fileCleanupService.enqueue(
      fileList.map(file => ({
        kind: 'managed-file' as const,
        fileId: file.id,
        path: file.path,
      })),
    )
    return { message: '文件删除成功' }
  }
}

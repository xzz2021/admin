import { PgService } from '@/prisma/pg.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import * as fs from 'fs'
import { UploadFileDto } from './file.dto'
import { getStaticFileRoot, tryResolvePathInsideRoot } from './multer.config'

@Injectable()
export class StaticfileService {
  constructor(private readonly pgService: PgService) {}

  async getFileList() {
    const fileList = await this.pgService.file.findMany()
    const total = await this.pgService.file.count()
    return { message: '文件列表获取成功', list: fileList, total }
  }

  async uploadFile(file: UploadFileDto) {
    const fileData = await this.pgService.file.create({
      data: {
        ...file,
      },
    })
    return { message: '文件上传成功', fileData }
  }

  async deleteFile(ids: number[]) {
    const fileList = await this.pgService.file.findMany({ where: { id: { in: ids } } })
    if (fileList.length !== ids.length) {
      throw new BadRequestException('部分文件不存在')
    }
    const root = getStaticFileRoot()
    let missingPathCount = 0
    for (const file of fileList) {
      const safePath = tryResolvePathInsideRoot(root, file.path)
      if (!safePath || !fs.existsSync(safePath)) {
        missingPathCount += 1
        continue
      }
      fs.unlinkSync(safePath)
    }
    await this.pgService.file.deleteMany({ where: { id: { in: ids } } })
    if (missingPathCount > 0) {
      return {
        message:
          missingPathCount === fileList.length
            ? '文件路径不存在，已清理无效数据'
            : `部分文件路径不存在（${missingPathCount}），已清理对应无效数据`,
        missingPathCount,
      }
    }
    return { message: '文件删除成功' }
  }

  async updateAvatar(avatarPath: string, userPhone: string) {
    await this.pgService.user.update({ where: { phone: userPhone }, data: { avatar: avatarPath } })
    return { message: '更新头像成功', filePath: avatarPath }
  }
}

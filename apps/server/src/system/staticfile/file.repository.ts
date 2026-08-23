import { Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class FileRepository {
  constructor(private readonly db: PgService) {}

  findActive() {
    const where = { deletedAt: null }
    return Promise.all([this.db.file.findMany({ where }), this.db.file.count({ where })])
  }

  create(data: Prisma.FileCreateInput) {
    return this.db.file.create({ data })
  }

  findActiveByIds(ids: number[]) {
    return this.db.file.findMany({
      where: { id: { in: ids }, deletedAt: null },
    })
  }

  softDeleteByIds(ids: number[]) {
    return this.db.file.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    })
  }

  findPendingCleanup() {
    return this.db.file.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, path: true },
    })
  }

  purgeSoftDeleted(id: number) {
    return this.db.file.deleteMany({
      where: { id, deletedAt: { not: null } },
    })
  }
}

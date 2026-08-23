import { Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { sqlReplaceDescendantPaths } from '@/processor/utils/sql-batch'
import { Injectable } from '@nestjs/common'

type Db = PgService | Prisma.TransactionClient

@Injectable()
export class DepartmentRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn)
  }

  create(data: Prisma.DepartmentUncheckedCreateInput, tx: Db = this.db) {
    return tx.department.create({ data })
  }

  findById(id: string, tx: Db = this.db) {
    return tx.department.findUnique({ where: { id } })
  }

  findPathById(id: string, tx: Db = this.db) {
    return tx.department.findUnique({
      where: { id },
      select: { path: true },
    })
  }

  findTreeLinks(tx: Db = this.db) {
    return tx.department.findMany({
      select: { id: true, parentId: true, path: true },
    })
  }

  findFirstChildId(parentId: string) {
    return this.db.department.findFirst({
      where: { parentId },
      select: { id: true },
    })
  }

  findRootTrees() {
    return this.db.department.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    })
  }

  count() {
    return this.db.department.count()
  }

  updateById(id: string, data: Prisma.DepartmentUncheckedUpdateInput, tx: Db = this.db) {
    return tx.department.update({
      where: { id },
      data,
      select: { id: true },
    })
  }

  deleteById(id: string) {
    return this.db.department.delete({ where: { id } })
  }

  replaceDescendantPaths(oldPath: string, nextPath: string, tx: Db = this.db) {
    return tx.$executeRaw(sqlReplaceDescendantPaths(oldPath, nextPath))
  }
}

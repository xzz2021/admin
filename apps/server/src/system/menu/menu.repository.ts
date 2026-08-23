import { Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { sqlBatchUpdateIntById } from '@/processor/utils/sql-batch'
import { Injectable } from '@nestjs/common'

type Db = PgService | Prisma.TransactionClient

@Injectable()
export class MenuRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn)
  }

  create(data: Prisma.MenuCreateInput) {
    return this.db.menu.create({
      data,
      select: { id: true },
    })
  }

  findById(id: string) {
    return this.db.menu.findUnique({
      where: { id },
      select: { id: true, name: true, path: true },
    })
  }

  findTreeLinks(tx: Db = this.db) {
    return tx.menu.findMany({
      select: { id: true, parentId: true },
    })
  }

  countChildren(parentId: string) {
    return this.db.menu.count({ where: { parentId } })
  }

  findAllWithPermissions() {
    return this.db.menu.findMany({
      orderBy: [{ sort: 'asc' }],
      include: {
        permissions: { orderBy: { sort: 'asc' } },
      },
    })
  }

  updateById(id: string, data: Prisma.MenuUpdateInput, tx: Db = this.db) {
    return tx.menu.update({
      where: { id },
      data,
      select: { id: true },
    })
  }

  deleteById(id: string) {
    return this.db.menu.delete({
      where: { id },
      select: { id: true },
    })
  }

  updateSorts(rows: Array<{ id: string; value: number }>) {
    return this.transaction(tx => tx.$executeRaw(sqlBatchUpdateIntById('"Menu"', 'sort', rows)))
  }
}

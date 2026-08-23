import type { PgService } from '@/prisma/pg.service'
import { MenuRepository } from './menu.repository'
import { MenuService } from './menu.service'

describe('MenuService tree updates', () => {
  const findMany = jest.fn()
  const update = jest.fn()
  const executeRaw = jest.fn()
  const transaction = jest.fn(
    async (
      callback: (tx: {
        menu: { findMany: typeof findMany; update: typeof update }
        $executeRaw: typeof executeRaw
      }) => Promise<unknown>,
    ) => callback({ menu: { findMany, update }, $executeRaw: executeRaw }),
  )

  const service = new MenuService(
    new MenuRepository({ $transaction: transaction } as unknown as PgService),
  )

  beforeEach(() => {
    jest.clearAllMocks()
    update.mockResolvedValue({ id: 'menu-1' })
    executeRaw.mockResolvedValue(2)
    findMany.mockResolvedValue([
      { id: 'menu-1', parentId: 'root' },
      { id: 'child', parentId: 'menu-1' },
      { id: 'root', parentId: null },
    ])
  })

  it('preserves the current parent when parentId is omitted', async () => {
    await service.update({
      id: 'menu-1',
      name: 'Menu',
      path: 'menu',
      type: 1,
      sort: 0,
      enabled: true,
      title: 'Menu',
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'menu-1' },
        data: expect.not.objectContaining({ parent: expect.anything() }),
      }),
    )
  })

  it('rejects moving a menu under its descendant', async () => {
    await expect(
      service.update({
        id: 'menu-1',
        parentId: 'child',
        name: 'Menu',
        path: 'menu',
        type: 1,
        sort: 0,
        enabled: true,
        title: 'Menu',
      }),
    ).rejects.toThrow('不能将菜单移动到自己的后代节点下')
    expect(update).not.toHaveBeenCalled()
  })

  it('sorts menus with one SQL statement instead of per-row updates', async () => {
    await service.sortMenu([
      { id: 'menu-1', sort: 2 },
      { id: 'child', sort: 1 },
    ])

    expect(update).not.toHaveBeenCalled()
    expect(executeRaw).toHaveBeenCalledTimes(1)
    const sql = executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] }
    expect(sql.sql).toMatch(/UPDATE\s+"Menu"/i)
    expect(sql.values).toEqual(expect.arrayContaining(['menu-1', 2, 'child', 1]))
  })
})

describe('MenuService delete rules', () => {
  const findUnique = jest.fn()
  const count = jest.fn()
  const remove = jest.fn()
  const service = new MenuService(
    new MenuRepository({
      menu: { findUnique, count, delete: remove },
    } as unknown as PgService),
  )

  it('refuses to delete a menu that still has children', async () => {
    findUnique.mockResolvedValue({ id: 'menu-1' })
    count.mockResolvedValue(1)

    await expect(service.remove('menu-1')).rejects.toThrow('该菜单存在子菜单，请先删除子菜单')
    expect(remove).not.toHaveBeenCalled()
  })
})

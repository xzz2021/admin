import type { Prisma } from './generated/prisma/client'
import { MenuType, PermissionType } from './generated/prisma/enums'
import { CUSTOMER_MENU, create_additional_permissions } from './seed-permissions'
import { _additional_permission } from './sql'

function createTx(opts: { menus?: Array<{ id: string; path: string }> }) {
  const menus = [...(opts.menus ?? [])]
  const upserts: Array<{ where: { code: string }; update: Record<string, unknown>; create: Record<string, unknown> }> =
    []

  const tx = {
    menu: {
      findMany: jest.fn(({ where }: { where: { path: { in: string[] } } }) =>
        Promise.resolve(menus.filter(menu => where.path.in.includes(menu.path))),
      ),
      findFirst: jest.fn(({ where }: { where: { path: string } }) =>
        Promise.resolve(menus.find(menu => menu.path === where.path) ?? null),
      ),
      upsert: jest.fn(({ where }: { where: { path: string } }) => {
        const found = menus.find(menu => menu.path === where.path)
        if (found) return Promise.resolve(found)
        const created = { id: `menu-${where.path}`, path: where.path, name: where.path }
        menus.push(created)
        return Promise.resolve(created)
      }),
    },
    permission: {
      upsert: jest.fn(
        (args: { where: { code: string }; update: Record<string, unknown>; create: Record<string, unknown> }) => {
          upserts.push(args)
          return Promise.resolve({ id: 'generated-id', code: args.where.code })
        },
      ),
    },
  }

  return { upserts, menu: tx.menu, tx: tx as unknown as Prisma.TransactionClient }
}

describe('create_additional_permissions', () => {
  it('includes the eleven customer permission codes with documented scopeEnabled', () => {
    expect(_additional_permission.map(item => `${item.resource}:${item.code}`)).toEqual([
      'customer:view',
      'customer:detail',
      'customer:add',
      'customer:update',
      'customer:delete',
      'customer:export',
      'customer:assign',
      'customer:high-value:update',
      'customer:won:delete',
      'customer:sensitive:view',
      'customer:sensitive:update',
    ])
    expect(_additional_permission.filter(item => item.scopeEnabled).map(item => item.code)).toEqual([
      'view',
      'detail',
      'add',
      'update',
      'delete',
      'export',
    ])
    expect(_additional_permission.filter(item => !item.scopeEnabled).map(item => item.code)).toEqual([
      'assign',
      'high-value:update',
      'won:delete',
      'sensitive:view',
      'sensitive:update',
    ])
  })

  it('upserts by code without id and updates existing rows', async () => {
    const { upserts, tx } = createTx({
      menus: [{ id: 'menu-customer', path: 'customer' }],
    })

    await create_additional_permissions(
      [
        {
          name: '查看',
          code: 'view',
          resource: 'customer',
          type: 'button',
          scopeEnabled: true,
        },
      ],
      tx,
    )

    expect(upserts).toHaveLength(1)
    expect(upserts[0]?.where).toEqual({ code: 'customer:view' })
    expect(upserts[0]?.create).not.toHaveProperty('id')
    expect(upserts[0]?.update).not.toHaveProperty('id')
    expect(upserts[0]?.create).toEqual(
      expect.objectContaining({
        name: '查看',
        code: 'customer:view',
        menuId: 'menu-customer',
        type: PermissionType.BUTTON,
        resource: 'customer',
        action: 'view',
        scopeEnabled: true,
      }),
    )
    expect(upserts[0]?.update).toEqual(
      expect.objectContaining({
        name: '查看',
        menuId: 'menu-customer',
        type: PermissionType.BUTTON,
        resource: 'customer',
        action: 'view',
        scopeEnabled: true,
      }),
    )
    expect(upserts[0]?.update).not.toHaveProperty('code')
  })

  it('loads menus once outside the permission loop', async () => {
    const { tx, menu } = createTx({
      menus: [
        { id: 'menu-customer', path: 'customer' },
        { id: 'menu-department', path: 'department' },
      ],
    })

    await create_additional_permissions(
      [
        { name: '查看', code: 'view', resource: 'customer', type: 'button', scopeEnabled: true },
        { name: '详情', code: 'detail', resource: 'customer', type: 'button', scopeEnabled: true },
        { name: '查看', code: 'view', resource: 'department', type: 'button' },
      ],
      tx,
    )

    expect(menu.findMany).toHaveBeenCalledTimes(1)
    expect(menu.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { path: { in: expect.arrayContaining(['customer', 'department']) } },
      }),
    )
    expect(menu.findFirst).not.toHaveBeenCalled()
  })

  it('creates the customer menu when missing so incremental permission seed can run', async () => {
    const { upserts, tx } = createTx({ menus: [] })

    await create_additional_permissions(
      [{ name: '查看', code: 'view', resource: 'customer', type: 'button', scopeEnabled: true }],
      tx,
    )

    expect(upserts[0]?.create).toEqual(expect.objectContaining({ menuId: 'menu-customer', code: 'customer:view' }))
  })

  it('throws when a non-customer menu is missing', async () => {
    const { tx } = createTx({ menus: [] })

    await expect(
      create_additional_permissions([{ name: '查看', code: 'view', resource: 'department', type: 'button' }], tx),
    ).rejects.toThrow('Menu department not found')
  })
})

describe('customer menu seed shape', () => {
  it('uses an independent customer page path for permission resource lookup', () => {
    expect(CUSTOMER_MENU).toEqual(
      expect.objectContaining({
        name: 'Customer',
        path: 'customer',
        type: MenuType.MENU,
        component: 'views/Customer/Customer',
      }),
    )
  })
})

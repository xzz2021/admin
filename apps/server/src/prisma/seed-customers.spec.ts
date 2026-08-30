import type { Prisma } from './generated/prisma/client'
import { CustomerStatus } from './generated/prisma/enums'
import { _customer, create_customers } from './seed-customers'

interface SeedUser {
  id: string
  departmentId: string | null
  enabled: boolean
  createdAt: Date
}

interface SeedDepartment {
  id: string
  name: string
}

function createTx(opts: { customers?: string[]; users?: SeedUser[]; departments?: SeedDepartment[] }) {
  const created: Array<Record<string, unknown>> = []
  const existing = new Set(opts.customers ?? [])
  const users = opts.users ?? []
  const departments = opts.departments ?? []

  const tx = {
    customer: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } }; select: { id: true } }) =>
        Promise.resolve((where.id.in ?? []).filter(id => existing.has(id)).map(id => ({ id }))),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        created.push(data)
        existing.add(String(data.id))
        return Promise.resolve(data)
      }),
    },
    user: {
      findMany: jest.fn(({ where }: { where: { enabled: boolean; departmentId: { not: null } } }) =>
        Promise.resolve(
          users
            .filter(user => user.enabled === where.enabled && user.departmentId != null)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        ),
      ),
      findFirst: jest.fn(() =>
        Promise.resolve([...users].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null),
      ),
    },
    department: {
      findFirst: jest.fn((args?: { where?: { name?: string } }) => {
        if (args?.where?.name) {
          return Promise.resolve(departments.find(department => department.name === args.where?.name) ?? null)
        }
        return Promise.resolve(departments[0] ?? null)
      }),
    },
  }

  return { created, tx: tx as unknown as Prisma.TransactionClient }
}

describe('create_customers', () => {
  it('writes the eight documented demo customers with documented statuses and amounts', async () => {
    expect(_customer).toHaveLength(8)
    expect(_customer.map(row => row.id)).toEqual([
      'demo_customer_001',
      'demo_customer_002',
      'demo_customer_003',
      'demo_customer_004',
      'demo_customer_005',
      'demo_customer_006',
      'demo_customer_007',
      'demo_customer_008',
    ])
    expect(
      _customer.map(row => ({
        name: row.name,
        status: row.status,
        dealAmount: row.dealAmount,
        confidential: row.confidential,
      })),
    ).toEqual([
      { name: '演示客户·线索小额', status: CustomerStatus.LEAD, dealAmount: '28000.00', confidential: false },
      { name: '演示客户·线索敏感', status: CustomerStatus.LEAD, dealAmount: '180000.00', confidential: true },
      { name: '演示客户·跟进普通', status: CustomerStatus.FOLLOWING, dealAmount: '99999.99', confidential: false },
      { name: '演示客户·跟进高额', status: CustomerStatus.FOLLOWING, dealAmount: '100000.00', confidential: true },
      { name: '演示客户·成交普通', status: CustomerStatus.WON, dealAmount: '86000.00', confidential: false },
      { name: '演示客户·成交敏感', status: CustomerStatus.WON, dealAmount: '360000.00', confidential: true },
      { name: '演示客户·冻结普通', status: CustomerStatus.FROZEN, dealAmount: '45000.00', confidential: false },
      { name: '演示客户·冻结敏感', status: CustomerStatus.FROZEN, dealAmount: '580000.00', confidential: true },
    ])

    const { created, tx } = createTx({
      users: [
        { id: 'user-a', departmentId: 'dept-a', enabled: true, createdAt: new Date('2026-01-01') },
        { id: 'user-b', departmentId: 'dept-b', enabled: true, createdAt: new Date('2026-01-02') },
      ],
    })

    await create_customers(_customer, tx)

    expect(created).toHaveLength(8)
    expect(created.map(row => row.id)).toEqual(_customer.map(row => row.id))
    expect(created[0]).toEqual(
      expect.objectContaining({
        ownerId: 'user-a',
        departmentId: 'dept-a',
        createdById: 'user-a',
      }),
    )
    expect(created[1]).toEqual(
      expect.objectContaining({
        ownerId: 'user-b',
        departmentId: 'dept-b',
        createdById: 'user-b',
      }),
    )
  })

  it('does not recreate customers that already exist', async () => {
    const { created, tx } = createTx({
      customers: _customer.map(row => row.id),
      users: [{ id: 'user-a', departmentId: 'dept-a', enabled: true, createdAt: new Date('2026-01-01') }],
    })

    await create_customers(_customer, tx)

    expect(created).toHaveLength(0)
  })

  it('falls back to the first user and 销售部 when no user has a department', async () => {
    const { created, tx } = createTx({
      users: [{ id: 'admin', departmentId: null, enabled: true, createdAt: new Date('2026-01-01') }],
      departments: [
        { id: 'hq', name: '总部' },
        { id: 'sales', name: '销售部' },
      ],
    })

    await create_customers(_customer, tx)

    expect(created).toHaveLength(8)
    expect(created.every(row => row.ownerId === 'admin' && row.departmentId === 'sales')).toBe(true)
  })

  it('throws when there is no user or department to attach customers to', async () => {
    const { tx } = createTx({ users: [], departments: [] })

    await expect(create_customers(_customer, tx)).rejects.toThrow('无法写入客户种子：需要至少一个用户和一个部门')
  })
})

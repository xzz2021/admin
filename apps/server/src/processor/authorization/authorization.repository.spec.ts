import type { PgService } from '@/prisma/pg.service'
import { AuthorizationRepository } from './authorization.repository'

describe('AuthorizationRepository', () => {
  it('loads enabled user, department, roles, permissions and custom department state in one query', async () => {
    const findUnique = jest.fn().mockResolvedValue(null)
    const findMany = jest.fn().mockResolvedValue([])
    const repository = new AuthorizationRepository({
      user: { findUnique },
      permission: { findMany },
    } as unknown as PgService)

    await repository.loadUserAuthorization('user-1')

    expect(findUnique).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      select: { code: true, scopeEnabled: true },
      orderBy: { code: 'asc' },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1', enabled: true },
      select: {
        id: true,
        department: {
          select: { id: true, enabled: true },
        },
        roles: {
          where: { role: { enabled: true } },
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  where: { permission: { enabled: true } },
                  select: {
                    dataScope: true,
                    permission: {
                      select: { code: true, scopeEnabled: true },
                    },
                    customDepartments: {
                      select: {
                        department: {
                          select: { id: true, enabled: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it('normalizes disabled current department to null', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      department: { id: 'dept-1', enabled: false },
      roles: [],
    })
    const repository = new AuthorizationRepository({
      user: { findUnique },
      permission: { findMany: jest.fn().mockResolvedValue([{ code: 'customer:list', scopeEnabled: true }]) },
    } as unknown as PgService)

    await expect(repository.loadUserAuthorization('user-1')).resolves.toEqual({
      userId: 'user-1',
      departmentId: null,
      roles: [],
      permissionCatalog: [{ code: 'customer:list', scopeEnabled: true }],
    })
  })
})

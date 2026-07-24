import { PERMISSION_KEY } from '@/processor/decorator'
import { DepartmentController } from './department.controller'

jest.mock('./department.service', () => ({
  DepartmentService: class DepartmentService {},
}))

describe('DepartmentController permission boundary', () => {
  it.each([
    ['department:add', 'add'],
    ['department:view', 'findAll'],
    ['department:update', 'update'],
    ['department:delete', 'delete'],
    ['department:seed', 'generateDepartmentSeed'],
  ] as const)('requires %s on %s', (permission, methodName) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, DepartmentController.prototype[methodName])).toBe(permission)
  })
})

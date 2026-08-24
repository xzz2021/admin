import { PERMISSION_KEY } from '@/processor/decorator'
import { PermissionController } from './permission.controller'

jest.mock('./permission.service', () => ({
  PermissionService: class PermissionService {},
}))

describe('PermissionController permission boundary', () => {
  it.each([
    ['menu:add', 'create'],
    ['menu:update', 'update'],
    ['menu:delete', 'remove'],
  ] as const)('requires %s on %s', (permission, methodName) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, PermissionController.prototype[methodName])).toBe(permission)
  })
})

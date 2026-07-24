import { PERMISSION_KEY } from '@/processor/decorator'
import { LoggerController } from './logger.controller'

jest.mock('./logger.service', () => ({
  LogService: class LogService {},
}))

describe('LoggerController permission boundary', () => {
  it.each([
    ['userLog:view', 'getUserOperationLogList'],
    ['userLog:delete', 'deleteUserOperationLog'],
  ] as const)('requires %s on %s', (permission, methodName) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, LoggerController.prototype[methodName])).toBe(
      permission,
    )
  })
})

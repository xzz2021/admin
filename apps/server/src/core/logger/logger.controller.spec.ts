import { PERMISSION_KEY } from '@/processor/decorator'
import { LoggerController } from './logger.controller'

jest.mock('./logger.service', () => ({
  LogService: class LogService {},
}))

jest.mock('./audit-log.service', () => ({
  AuditLogService: class AuditLogService {},
}))

describe('LoggerController permission boundary', () => {
  it.each([
    ['userLog:view', 'getUserOperationLogList'],
    ['userLog:delete', 'deleteUserOperationLog'],
    ['auditLog:view', 'getAuditLogList'],
  ] as const)('requires %s on %s', (permission, methodName) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, LoggerController.prototype[methodName])).toBe(permission)
  })

  it('does not expose a delete endpoint for domain audit logs', () => {
    expect(LoggerController.prototype).not.toHaveProperty('deleteAuditLog')
  })
})

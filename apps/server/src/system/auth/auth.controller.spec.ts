import { IS_PUBLIC_KEY, PERMISSION_KEY } from '@/processor/decorator'
import { AuthController } from './auth.controller'

jest.mock('./auth.service', () => ({
  AuthService: class AuthService {},
}))

jest.mock('@/processor/guard', () => ({
  CaptchaGuard: class CaptchaGuard {},
  JwtRefreshAuthGuard: class JwtRefreshAuthGuard {},
}))

describe('AuthController authentication boundary', () => {
  it('does not expose the entire controller', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController)).toBeUndefined()
  })

  it.each(['create', 'login', 'rtLogin', 'refresh'] as const)('marks %s as public', methodName => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype[methodName])).toBe(true)
  })

  it.each(['logout', 'forceLogout'] as const)('keeps %s protected', methodName => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype[methodName])).toBeUndefined()
  })

  it('requires user update permission for force logout', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, AuthController.prototype['forceLogout'])).toBe(
      'user:update',
    )
  })
})

import { PERMISSION_KEY } from '@/processor/decorator'
import { StaticfileController } from './staticfile.controller'

jest.mock('./staticfile.service', () => ({
  StaticfileService: class StaticfileService {},
}))

jest.mock('./multer.config', () => ({
  generateMulterConfig: () => ({}),
}))

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {
    get() {
      return '/static'
    }
  },
}))

describe('StaticfileController permission boundary', () => {
  it.each([
    ['fileList:view', 'getFile2'],
    ['fileList:view', 'getFile3'],
    ['fileList:view', 'getFileList'],
    ['fileList:add', 'uploadFile'],
    ['fileList:delete', 'deleteFile'],
  ] as const)('requires %s on %s', (permission, methodName) => {
    expect(Reflect.getMetadata(PERMISSION_KEY, StaticfileController.prototype[methodName])).toBe(permission)
  })
})

import { RoleController } from '@/system/role/role.controller'
import { RoleService } from '@/system/role/role.service'
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger'
import { Test } from '@nestjs/testing'
import { createSwagger } from './swagger'

function collectRefs(value: unknown, refs: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach(item => collectRefs(item, refs))
    return refs
  }
  if (!value || typeof value !== 'object') return refs
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') refs.push(child)
    else collectRefs(child, refs)
  }
  return refs
}

function resolvesJsonPointer(document: OpenAPIObject, ref: string): boolean {
  if (!ref.startsWith('#/')) return true
  const parts = ref
    .slice(2)
    .split('/')
    .map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))
  let current: unknown = document
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return false
    current = (current as Record<string, unknown>)[part]
  }
  return true
}

describe('createSwagger', () => {
  it('cleans recursive zod definitions so every final role response ref resolves', async () => {
    const module = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [{ provide: RoleService, useValue: {} }],
    }).compile()
    const app = module.createNestApplication()
    await app.init()
    const setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined)

    try {
      createSwagger(app, { username: 'swagger', password: 'secret1' })
      const documentOrFactory = setup.mock.calls[0]?.[2]
      expect(documentOrFactory).toBeDefined()
      if (!documentOrFactory) throw new Error('Swagger document was not passed to setup')
      const document = typeof documentOrFactory === 'function' ? documentOrFactory() : documentOrFactory

      const serialized = JSON.stringify(document)
      const refs = collectRefs(document)
      expect(serialized).toContain('RoleAuthorizationTreeRes')
      expect(serialized).not.toContain('"$defs"')
      expect(refs.length).toBeGreaterThan(0)
      expect(refs.filter(ref => !resolvesJsonPointer(document, ref))).toEqual([])
    } finally {
      setup.mockRestore()
      await app.close()
    }
  })
})

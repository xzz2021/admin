/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { CanActivate, Controller, Get, Injectable } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import express from 'express'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import request from 'supertest'
import { createStaticFileMiddleware, StaticAssetsModule } from './server.static'

describe('createStaticFileMiddleware', () => {
  let diskRoot: string

  beforeEach(() => {
    diskRoot = join(tmpdir(), `static-mw-${Date.now()}`)
    mkdirSync(join(diskRoot, 'avatar'), { recursive: true })
    writeFileSync(join(diskRoot, 'avatar', 'me.txt'), 'ok')
  })

  afterEach(() => {
    rmSync(diskRoot, { recursive: true, force: true })
  })

  it('serves files under the configured prefix without falling through', async () => {
    const app = express()
    app.use(createStaticFileMiddleware(diskRoot, 'public'))
    app.get('/public/avatar/me.txt', (_req, res) => {
      res.status(200).send('leaked')
    })

    const res = await request(app).get('/public/avatar/me.txt')
    expect(res.status).toBe(200)
    expect(res.text).toBe('ok')
  })

  it('does not fall through to later handlers for missing files', async () => {
    const app = express()
    app.use(createStaticFileMiddleware(diskRoot, 'public'))
    app.get('/public/secret-api', (_req, res) => {
      res.status(200).send('leaked-api')
    })

    const res = await request(app).get('/public/secret-api')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('leaked-api')
  })

  it('does not treat similar prefixes as static files', async () => {
    const app = express()
    app.use(createStaticFileMiddleware(diskRoot, 'public'))
    app.get('/public-api/x', (_req, res) => {
      res.status(200).send('api')
    })

    const res = await request(app).get('/public-api/x')
    expect(res.status).toBe(200)
    expect(res.text).toBe('api')
  })

  it('never serves upload temp chunks under file/tmp', async () => {
    mkdirSync(join(diskRoot, 'file', 'tmp', 'session-1'), { recursive: true })
    writeFileSync(join(diskRoot, 'file', 'tmp', 'session-1', '0'), 'secret-chunk')

    const app = express()
    app.use(createStaticFileMiddleware(diskRoot, 'public'))

    const res = await request(app).get('/public/file/tmp/session-1/0')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('secret-chunk')
  })
})

describe('StaticAssetsModule', () => {
  @Injectable()
  class DenyAllGuard implements CanActivate {
    canActivate(): boolean {
      return false
    }
  }

  it('serves files before Nest guards and does not expose same-prefix controllers', async () => {
    const urlPrefix = `public-test-${Date.now()}`
    const diskRoot = join(process.cwd(), urlPrefix)
    mkdirSync(diskRoot, { recursive: true })
    writeFileSync(join(diskRoot, 'hello.txt'), 'static-ok')

    @Controller(urlPrefix)
    class SamePrefixController {
      @Get('secret')
      secret() {
        return 'leaked-api'
      }
    }

    try {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            load: [() => ({ staticFileRootPath: urlPrefix })],
          }),
          StaticAssetsModule,
        ],
        controllers: [SamePrefixController],
        providers: [{ provide: APP_GUARD, useClass: DenyAllGuard }],
      }).compile()

      const app = moduleRef.createNestApplication()
      await app.init()

      const fileRes = await request(app.getHttpServer()).get(`/${urlPrefix}/hello.txt`)
      expect(fileRes.status).toBe(200)
      expect(fileRes.text).toBe('static-ok')

      const apiRes = await request(app.getHttpServer()).get(`/${urlPrefix}/secret`)
      expect(apiRes.status).toBe(404)
      expect(apiRes.text).not.toContain('leaked-api')

      await app.close()
    } finally {
      rmSync(diskRoot, { recursive: true, force: true })
    }
  })
})

import { PgService } from '@/prisma/pg.service'
import { RequiredPermission } from '@/processor/decorator'
import { JwtRefreshAuthGuard, PermissionGuard } from '@/processor/guard'
import { RbacPermissionCacheService } from '@/processor/rbac'
import { RtTokenService } from '@/system/auth/rt.token.service'
import { StaticfileController } from '@/system/staticfile/staticfile.controller'
import { StaticfileService } from '@/system/staticfile/staticfile.service'
import { Controller, Get, INestApplication, Post, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import request from 'supertest'
import type { App } from 'supertest/types'

@Controller('security-test')
class SecurityTestController {
  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  refresh() {
    return { refreshed: true }
  }

  @Get('permission')
  @RequiredPermission('fileList:view')
  protectedRoute() {
    return { allowed: true }
  }
}

describe('Security boundaries (e2e)', () => {
  let app: INestApplication<App>
  let uploadRoot: string
  let permissions: string[]
  const originalStaticRoot = process.env.STATIC_FILE_ROOT_PATH
  const isBlacklisted = jest.fn()
  const listSessions = jest.fn()
  const getFileList = jest.fn()
  const uploadFile = jest.fn()
  const deleteFile = jest.fn()

  beforeAll(async () => {
    uploadRoot = mkdtempSync(join(tmpdir(), 'admin2-upload-e2e-'))
    process.env.STATIC_FILE_ROOT_PATH = uploadRoot
    jest.spyOn(AuthGuard('jwt-refresh').prototype, 'canActivate').mockResolvedValue(true)

    const moduleFixture = await Test.createTestingModule({
      controllers: [SecurityTestController, StaticfileController],
      providers: [
        JwtRefreshAuthGuard,
        PermissionGuard,
        {
          provide: APP_GUARD,
          useExisting: PermissionGuard,
        },
        {
          provide: RtTokenService,
          useValue: { isBlacklisted, listSessions },
        },
        {
          provide: ConfigService,
          useValue: { get: () => '/static' },
        },
        {
          provide: StaticfileService,
          useValue: { getFileList, uploadFile, deleteFile },
        },
        {
          provide: PgService,
          useValue: { user: { findUnique: jest.fn() } },
        },
        {
          provide: RbacPermissionCacheService,
          useValue: {
            get: jest.fn(() => Promise.resolve(permissions)),
            set: jest.fn(),
          },
        },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const authenticatedRequest = req as Request & {
        user?: { id: string; jti?: string; phone: string }
      }
      authenticatedRequest.user = {
        id: req.header('x-user-id') ?? 'user-1',
        jti: req.header('x-token-jti') ?? undefined,
        phone: '13800138000',
      }
      next()
    })
    await app.init()
  })

  beforeEach(() => {
    permissions = []
    jest.clearAllMocks()
    isBlacklisted.mockResolvedValue(false)
    listSessions.mockResolvedValue(['active-jti'])
    getFileList.mockResolvedValue([])
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await app.close()
    rmSync(uploadRoot, { recursive: true, force: true })
    if (originalStaticRoot === undefined) {
      delete process.env.STATIC_FILE_ROOT_PATH
    } else {
      process.env.STATIC_FILE_ROOT_PATH = originalStaticRoot
    }
  })

  it('rejects a blacklisted refresh token over HTTP', async () => {
    isBlacklisted.mockResolvedValue(true)

    await request(app.getHttpServer())
      .post('/security-test/refresh')
      .set('x-token-jti', 'revoked-jti')
      .expect(401)
  })

  it('rejects a refresh token missing from the active session list', async () => {
    listSessions.mockResolvedValue(['other-jti'])

    await request(app.getHttpServer())
      .post('/security-test/refresh')
      .set('x-token-jti', 'inactive-jti')
      .expect(401)
  })

  it('allows an active refresh token', async () => {
    await request(app.getHttpServer())
      .post('/security-test/refresh')
      .set('x-token-jti', 'active-jti')
      .expect(201)
      .expect({ refreshed: true })
  })

  it('returns 403 when a management permission is missing', async () => {
    await request(app.getHttpServer()).get('/security-test/permission').expect(403)
  })

  it('allows a request with the required management permission', async () => {
    permissions = ['fileList:view']

    await request(app.getHttpServer())
      .get('/security-test/permission')
      .expect(200)
      .expect({ allowed: true })
  })

  it('rejects a dangerous upload type before calling the service', async () => {
    permissions = ['fileList:add']

    await request(app.getHttpServer())
      .post('/staticfile/upload')
      .attach('file', Buffer.from('malicious'), {
        filename: 'payload.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400)

    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('rejects an oversized management upload', async () => {
    permissions = ['fileList:add']

    await request(app.getHttpServer())
      .post('/staticfile/upload')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'large.txt',
        contentType: 'text/plain',
      })
      .expect(413)

    expect(uploadFile).not.toHaveBeenCalled()
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { AppController } from './../src/app.controller'
import { AppService } from './../src/app.service'
import { PgService } from './../src/prisma/pg.service'
import { RedisHealthService } from './../src/core/cache/redis-health.service'

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: { getHello: () => 'Hello World!' },
        },
        {
          provide: PgService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) },
        },
        {
          provide: RedisHealthService,
          useValue: { ping: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!')
  })

  afterEach(async () => {
    await app.close()
  })
})
